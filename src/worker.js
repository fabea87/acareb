/**
 * AcadRebuttal Cloudflare Worker Entry
 * Serves pure static assets from ./dist with edge caching and SPA fallback.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Fetch static asset from binding
    let response = await env.ASSETS.fetch(request);

    // If 404 and it's a page navigation (not a direct file request like .js/.css), fallback to index.html
    if (response.status === 404 && !url.pathname.includes('.')) {
      const indexRequest = new Request(new URL('/', request.url), request);
      response = await env.ASSETS.fetch(indexRequest);
    }

    // Add security and optimal caching headers
    const newHeaders = new Headers(response.headers);
    if (url.pathname.startsWith('/assets/')) {
      // Immutable long-term cache for hashed assets
      newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // Revalidate index and data
      newHeaders.set('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'DENY');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
