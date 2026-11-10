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
  if (!Array.isArray(gallery.photos) || gallery.photos.length === 0) return json({ error: 'Cette galerie ne contient aucune photo.' }, 404);

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      'INSERT INTO gallery_download_emails (email, gallery_slug, first_download_at, last_download_at) VALUES (?, ?, ?, ?) ON CONFLICT(email, gallery_slug) DO UPDATE SET last_download_at = excluded.last_download_at'
    ).bind(email, slug, now, now).run();
  } catch {
    return json({ error: 'Le registre des téléchargements est momentanément indisponible.' }, 503);
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if ((incoming.hostname === 'remiproduction.fr' || incoming.hostname.endsWith(SUFFIX)) && incoming.pathname === '/api/gallery-download') {
      return recordDownload(request, env);
    }

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
    ctx.waitUntil(env.DB.prepare("DELETE FROM gallery_download_emails WHERE last_download_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-12 months')").run());
  }
};
