// Serves uploaded images at /media/<key>.
// Primary source: the R2 bucket (MEDIA binding). While R2 is not enabled
// (it needs a payment card on the account), existing images are bundled as
// static files under public/media/ and served through the ASSETS fallback.
export async function onRequestGet(context) {
  const { env, params, request } = context;
  try {
    const key = Array.isArray(params.key) ? params.key.join('/') : String(params.key || '');
    if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

    if (env.MEDIA) {
      const object = await env.MEDIA.get(key);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('ETag', object.httpEtag);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(object.body, { headers });
      }
    }

    // Static fallback: image bundled in public/media/<key>.
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 200) return res;
    }
    return new Response('Not found', { status: 404 });
  } catch {
    return new Response('Server error', { status: 500 });
  }
}
