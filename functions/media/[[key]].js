// Serves uploaded images from the R2 bucket at /media/<key>.
// This avoids needing a custom domain or public r2.dev URL.
export async function onRequestGet({ env, params }) {
  try {
    if (!env.MEDIA) return new Response('Storage not configured', { status: 503 });
    const key = Array.isArray(params.key) ? params.key.join('/') : String(params.key || '');
    if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

    const object = await env.MEDIA.get(key);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(object.body, { headers });
  } catch {
    return new Response('Server error', { status: 500 });
  }
}
