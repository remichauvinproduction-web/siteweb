/**
 * Cloudflare Worker: maps gallery subdomains to Pages and records download emails.
 * Set PAGES_ORIGIN and bind the D1 database named by wrangler.toml.
 */
const RESERVED = new Set(['www', 'admin', 'mail', 'smtp', 'imap', 'ftp', 'autodiscover', 'oauth-proxy']);
const SUFFIX = '.remiproduction.fr';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function recordDownload(request, env) {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      const sourceHost = new URL(origin).hostname.toLowerCase();
      if (sourceHost !== 'remiproduction.fr' && !sourceHost.endsWith(SUFFIX)) return json({ error: 'Origine non autorisée.' }, 403);
    } catch { return json({ error: 'Origine non autorisée.' }, 403); }
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  const slug = String(body.slug || '').trim().toLowerCase();
  const action = String(body.action || '');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Saisissez une adresse e-mail valide.' }, 400);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !['single', 'all'].includes(action)) return json({ error: 'Galerie ou action invalide.' }, 400);

  const galleryUrl = new URL('/data/galeries/' + encodeURIComponent(slug) + '.json', 'https://' + env.PAGES_ORIGIN);
  const galleryResponse = await fetch(galleryUrl);
  if (!galleryResponse.ok) return json({ error: 'Cette galerie est introuvable.' }, 404);
  const gallery = await galleryResponse.json();
  if (gallery.allowDownloads === false || gallery.shopEnabled === true) return json({ error: 'Le téléchargement gratuit est désactivé pour cette galerie.' }, 403);
  if (!Array.isArray(gallery.photos) || gallery.photos.length === 0) return json({ error: 'Cette galerie ne contient aucune photo.' }, 404);

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      'INSERT INTO gallery_download_emails (email, gallery_slug, first_download_at, last_download_at) VALUES (?, ?, ?, ?) ON CONFLICT(email, gallery_slug) DO UPDATE SET last_download_at = excluded.last_download_at'
    ).bind(email, slug, now, now).run();
    await env.DB.prepare('INSERT INTO gallery_events (gallery_slug, event_type, created_at) VALUES (?, ?, ?)').bind(slug, action === 'single' ? 'download_single' : 'download_all', now).run();
  } catch {
    return json({ error: 'Le registre des téléchargements est momentanément indisponible.' }, 503);
  }
  return json({ ok: true });
}

function validOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'remiproduction.fr' || host.endsWith(SUFFIX);
  } catch { return false; }
}

async function galleryEvent(request, env) {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!validOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const slug = String(body.slug || '').toLowerCase();
  const type = String(body.type || '');
  const photo = Number.isInteger(body.photo) && body.photo >= 0 ? body.photo : null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !['view', 'favorite', 'unfavorite'].includes(type)) return json({ error: 'Événement invalide.' }, 400);
  try {
    await env.DB.prepare('INSERT INTO gallery_events (gallery_slug, event_type, photo_index, created_at) VALUES (?, ?, ?, ?)').bind(slug, type, photo, new Date().toISOString()).run();
    return json({ ok: true });
  } catch { return json({ error: 'Statistiques momentanément indisponibles.' }, 503); }
}

async function gallerySelection(request, env) {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!validOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const slug = String(body.slug || '').toLowerCase();
  const email = String(body.email || '').trim().toLowerCase();
  const photos = [...new Set((Array.isArray(body.photos) ? body.photos : []).filter((n) => Number.isInteger(n) && n >= 0))].slice(0, 500);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || photos.length < 1) return json({ error: 'Sélection invalide.' }, 400);
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ error: 'Adresse e-mail invalide.' }, 400);
  const url = new URL('/data/galeries/' + encodeURIComponent(slug) + '.json', 'https://' + env.PAGES_ORIGIN);
  const response = await fetch(url);
  if (!response.ok) return json({ error: 'Cette galerie est introuvable.' }, 404);
  const gallery = await response.json();
  if (!Array.isArray(gallery.photos) || photos.some((i) => i >= gallery.photos.length)) return json({ error: 'La sélection contient une photo invalide.' }, 400);
  try {
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO gallery_selections (gallery_slug, client_email, selected_photos, created_at) VALUES (?, ?, ?, ?)').bind(slug, email || null, JSON.stringify(photos), now).run();
    await env.DB.prepare('INSERT INTO gallery_events (gallery_slug, event_type, created_at) VALUES (?, ?, ?)').bind(slug, 'selection', now).run();
    return json({ ok: true });
  } catch { return json({ error: 'Envoi de la sélection indisponible.' }, 503); }
}

async function galleryInsights(request, env) {
  if (request.method !== 'GET') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!validOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Connexion requise.' }, 401);
  const auth = await fetch('https://api.github.com/repos/remichauvinproduction-web/siteweb', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!auth.ok) return json({ error: 'Accès au dépôt refusé.' }, 403);
  const repo = await auth.json();
  if (!repo.permissions?.push) return json({ error: 'Droits de gestion requis.' }, 403);
  const slug = new URL(request.url).searchParams.get('slug') || '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ error: 'Galerie invalide.' }, 400);
  try {
    const rows = await env.DB.prepare('SELECT event_type, COUNT(*) AS total FROM gallery_events WHERE gallery_slug = ? AND event_type NOT IN (\'favorite\', \'unfavorite\') GROUP BY event_type').bind(slug).all();
    const favoriteRows = await env.DB.prepare("SELECT photo_index AS photo, SUM(CASE event_type WHEN 'favorite' THEN 1 ELSE -1 END) AS total FROM gallery_events WHERE gallery_slug = ? AND event_type IN ('favorite', 'unfavorite') AND photo_index IS NOT NULL GROUP BY photo_index").bind(slug).all();
    const selectionRows = await env.DB.prepare('SELECT id, client_email, selected_photos, created_at, status FROM gallery_selections WHERE gallery_slug = ? ORDER BY created_at DESC LIMIT 100').bind(slug).all();
    const events = rows.results || [];
    const selections = (selectionRows.results || []).map((s) => ({ id:s.id, email:s.client_email, photos:JSON.parse(s.selected_photos), date:s.created_at, status:s.status }));
    return json({ slug, views:events.find((r) => r.event_type === 'view')?.total || 0, downloadsSingle:events.find((r) => r.event_type === 'download_single')?.total || 0, downloadsAll:events.find((r) => r.event_type === 'download_all')?.total || 0, selectedCount:selections.length, favorites:(favoriteRows.results||[]).filter((r)=>r.total>0).map((r)=>({photo:r.photo,count:r.total})).sort((a,b)=>b.count-a.count), selections });
  } catch { return json({ error: 'Statistiques indisponibles. Vérifiez la migration D1 0002.' }, 503); }
}

async function media(request, env) {
  const key = new URL(request.url).pathname.slice('/api/media/'.length);
  if (!/^galeries\/[a-z0-9-]+\/[a-zA-Z0-9._-]+$/.test(key) || key.includes('..')) return json({ error:'Fichier invalide.' }, 400);
  if (request.method === 'GET' || request.method === 'HEAD') {
    const object = await env.GALLERY_MEDIA.get(key);
    if (!object) return json({ error:'Fichier introuvable.' }, 404);
    if (object.customMetadata?.variant === 'original') {
      const galleryResponse = await fetch(new URL('/data/galeries/' + encodeURIComponent(key.split('/')[1]) + '.json', 'https://' + env.PAGES_ORIGIN));
      const gallery = galleryResponse.ok ? await galleryResponse.json() : null;
      if (!gallery || gallery.allowDownloads === false || gallery.shopEnabled === true) return json({ error:'Le téléchargement direct des originaux est désactivé pour cette galerie.' }, 403);
    }
    const isOriginal = object.customMetadata?.variant === 'original';
    const headers = new Headers({ 'Cache-Control':isOriginal?'private, no-store':'public, max-age=31536000, immutable', 'X-Content-Type-Options':'nosniff' });
    object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag);
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  }
  if (request.method !== 'PUT') return json({ error:'Méthode non autorisée.' }, 405);
  if (!validOrigin(request)) return json({ error:'Origine non autorisée.' }, 403);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error:'Connexion requise.' }, 401);
  const auth = await fetch('https://api.github.com/repos/remichauvinproduction-web/siteweb', { headers:{ Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' } });
  if (!auth.ok || !(await auth.json()).permissions?.push) return json({ error:'Droits de gestion requis.' }, 403);
  const type = request.headers.get('Content-Type')?.split(';')[0] || 'application/octet-stream';
  const allowed = /^(image\/(jpeg|png|webp|avif|tiff)|application\/(octet-stream|x-.*)|image\/x-.*)$/i;
  if (!allowed.test(type)) return json({ error:'Format de fichier non autorisé.' }, 415);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 500 * 1024 * 1024) return json({ error:'Fichier trop volumineux (limite 500 Mo).' }, 413);
  try {
    const variant = request.headers.get('X-Gallery-Variant') === 'original' ? 'original' : 'web';
    await env.GALLERY_MEDIA.put(key, request.body, { httpMetadata:{ contentType:type, cacheControl:'public, max-age=31536000, immutable' }, customMetadata:{ variant, gallerySlug:key.split('/')[1] } });
    return json({ ok:true, url:'/api/media/'+key });
  } catch { return json({ error:'Stockage photo indisponible. Vérifiez le binding R2 GALLERY_MEDIA.' }, 503); }
}

async function createGalleryCheckout(request, env) {
  if (request.method !== 'POST') return json({ error:'Méthode non autorisée.' }, 405);
  if (!validOrigin(request)) return json({ error:'Origine non autorisée.' }, 403);
  if (!env.STRIPE_SECRET_KEY) return json({ error:'La boutique n’est pas encore reliée à Stripe.' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error:'Requête invalide.' }, 400); }
  const slug = String(body.slug || '').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ error:'Galerie invalide.' }, 400);
  const galleryResponse = await fetch(new URL('/data/galeries/' + encodeURIComponent(slug) + '.json', 'https://' + env.PAGES_ORIGIN));
  if (!galleryResponse.ok) return json({ error:'Cette galerie est introuvable.' }, 404);
  const gallery = await galleryResponse.json();
  const amount = Number(gallery.priceCents);
  if (!gallery.shopEnabled || !Number.isInteger(amount) || amount < 50 || amount > 1000000) return json({ error:'La vente numérique n’est pas activée pour cette galerie.' }, 403);
  const selectedIndexes = [...new Set((Array.isArray(body.photos) ? body.photos : []).filter((n) => Number.isInteger(n) && n >= 0 && n < (gallery.photos || []).length))];
  const selectedOnly = gallery.shopMode === 'selection';
  const selectedPhotos = selectedOnly ? selectedIndexes.map((i) => gallery.photos[i]) : (gallery.photos || []);
  if (selectedOnly && selectedPhotos.length === 0) return json({ error:'Choisissez au moins une photo à acheter.' }, 400);
  const mediaKeys = selectedPhotos.map((p) => String(p.original || p.download || '')).map((p) => p.startsWith('/api/media/') ? p.slice('/api/media/'.length) : '').filter(Boolean);
  if (!mediaKeys.length || mediaKeys.length !== selectedPhotos.length) return json({ error:'Les originaux de cette sélection ne sont pas tous dans le stockage sécurisé.' }, 400);
  const totalAmount = amount * (selectedOnly ? mediaKeys.length : 1);
  if (totalAmount > 100000000) return json({ error:'Le montant total dépasse la limite de paiement.' }, 400);
  const host = `${slug}.remiproduction.fr`;
  const params = new URLSearchParams({ mode:'payment', success_url:`https://${host}/?session_id={CHECKOUT_SESSION_ID}&checkout=success`, cancel_url:`https://${host}/?checkout=cancelled`, 'line_items[0][quantity]':'1', 'line_items[0][price_data][currency]':'eur', 'line_items[0][price_data][unit_amount]':String(totalAmount), 'line_items[0][price_data][product_data][name]':selectedOnly?`${mediaKeys.length} photo(s) — ${gallery.title || slug}`:`Galerie numérique — ${gallery.title || slug}`, 'line_items[0][price_data][product_data][description]':`${mediaKeys.length} fichier(s) haute définition`, 'metadata[gallery_slug]':slug });
  const checkout = await fetch('https://api.stripe.com/v1/checkout/sessions', { method:'POST', headers:{ Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type':'application/x-www-form-urlencoded' }, body:params });
  const session = await checkout.json().catch(() => ({}));
  if (!checkout.ok || !session.url) return json({ error:session.error?.message || 'Stripe n’a pas pu créer le paiement.' }, 502);
  try {
    await env.DB.prepare('INSERT INTO gallery_orders (stripe_session_id, gallery_slug, media_keys, created_at) VALUES (?, ?, ?, ?)').bind(session.id, slug, JSON.stringify(mediaKeys), new Date().toISOString()).run();
    return json({ url:session.url });
  } catch { return json({ error:'Commande non enregistrée. Aucun fichier n’a été débloqué.' }, 503); }
}

async function purchasedFile(request, env) {
  if (request.method !== 'GET') return json({ error:'Méthode non autorisée.' }, 405);
  if (!validOrigin(request)) return json({ error:'Origine non autorisée.' }, 403);
  if (!env.STRIPE_SECRET_KEY) return json({ error:'La boutique n’est pas configurée.' }, 503);
  const url = new URL(request.url), sessionId = url.searchParams.get('session_id') || '', photo = Number(url.searchParams.get('photo'));
  if (!/^cs_[a-zA-Z0-9_]+$/.test(sessionId) || !Number.isInteger(photo) || photo < 0) return json({ error:'Lien de téléchargement invalide.' }, 400);
  let order;
  try { order = await env.DB.prepare('SELECT gallery_slug, media_keys FROM gallery_orders WHERE stripe_session_id = ?').bind(sessionId).first(); }
  catch { return json({ error:'Registre des commandes indisponible.' }, 503); }
  if (!order) return json({ error:'Commande introuvable.' }, 404);
  const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers:{ Authorization:`Bearer ${env.STRIPE_SECRET_KEY}` } });
  const session = await stripeResponse.json().catch(() => ({}));
  if (!stripeResponse.ok || session.payment_status !== 'paid' || session.metadata?.gallery_slug !== order.gallery_slug) return json({ error:'Paiement non confirmé.' }, 402);
  const keys = JSON.parse(order.media_keys);
  if (photo >= keys.length) return json({ error:'Fichier introuvable dans cette commande.' }, 404);
  const object = await env.GALLERY_MEDIA.get(keys[photo]);
  if (!object) return json({ error:'Fichier haute définition introuvable.' }, 404);
  const fileName = keys[photo].split('/').pop().replace(/[^a-zA-Z0-9._-]/g, '-');
  const headers = new Headers({ 'Cache-Control':'private, no-store', 'Content-Disposition':`attachment; filename="${fileName}"`, 'X-Gallery-Original-Name':fileName, 'X-Content-Type-Options':'nosniff' });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if ((incoming.hostname === 'remiproduction.fr' || incoming.hostname.endsWith(SUFFIX)) && incoming.pathname === '/api/gallery-download') {
      return recordDownload(request, env);
    }
    if (incoming.pathname === '/api/gallery-event') return galleryEvent(request, env);
    if (incoming.pathname === '/api/gallery-selection') return gallerySelection(request, env);
    if (incoming.pathname === '/api/gallery-insights') return galleryInsights(request, env);
    if (incoming.pathname === '/api/gallery-checkout') return createGalleryCheckout(request, env);
    if (incoming.pathname === '/api/purchase-file') return purchasedFile(request, env);
    if (incoming.pathname.startsWith('/api/media/')) return media(request, env);

    const host = incoming.hostname.toLowerCase();
    if (!host.endsWith(SUFFIX)) return new Response('Hôte inconnu', { status: 404 });
    const slug = host.slice(0, -SUFFIX.length);
    // A wildcard route also receives requests for pre-existing proxied hosts.
    // Preserve those hosts, and unknown subdomains, by sending them to their DNS origin.
    if (!slug || slug.includes('.') || RESERVED.has(slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return fetch(request);
    }

    // Only claim a hostname when a matching gallery has actually been published.
    const galleryCheck = await fetch(new URL('/data/galeries/' + encodeURIComponent(slug) + '.json', 'https://' + env.PAGES_ORIGIN));
    if (!galleryCheck.ok) return fetch(request);

    const upstream = new URL(incoming);
    upstream.hostname = env.PAGES_ORIGIN;
    upstream.port = '';
    if (incoming.pathname === '/') upstream.pathname = '/galerie/' + encodeURIComponent(slug);
    return fetch(new Request(upstream, request));
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(Promise.all([
      env.DB.prepare("DELETE FROM gallery_download_emails WHERE last_download_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-12 months')").run(),
      env.DB.prepare("DELETE FROM gallery_selections WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-12 months')").run(),
      env.DB.prepare("DELETE FROM gallery_orders WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-12 months')").run(),
      env.DB.prepare("DELETE FROM gallery_events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 months')").run()
    ]));
  }
};
