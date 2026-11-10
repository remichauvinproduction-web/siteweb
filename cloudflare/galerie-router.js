/**
 * Route wildcard client subdomains to the existing Cloudflare Pages site.
 * Configure env.PAGES_ORIGIN as the Pages hostname, e.g. "remiproduction.pages.dev".
 */
const RESERVED = new Set(['www', 'admin', 'mail', 'smtp', 'imap', 'ftp', 'autodiscover', 'oauth-proxy']);

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const host = incoming.hostname.toLowerCase();
    const suffix = '.remiproduction.fr';
    if (!host.endsWith(suffix)) return new Response('Hôte inconnu', { status: 404 });

    const slug = host.slice(0, -suffix.length);
    if (!slug || slug.includes('.') || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return new Response('Sous-domaine invalide', { status: 404 });
    }

    const upstream = new URL(incoming);
    upstream.hostname = env.PAGES_ORIGIN;
    upstream.port = '';
    if (incoming.pathname === '/' && !RESERVED.has(slug)) {
      upstream.pathname = '/galerie/' + encodeURIComponent(slug);
    }

    return fetch(new Request(upstream, request));
  }
};
