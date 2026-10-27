import { fail } from '../../../lib/http.js';

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

// GET /api/public/avatar/<user id> — serves an author's profile photo.
// Avatars are stored on the admin_users row: small photos live there as data
// URLs (no file storage exists), anything else is a URL/path we redirect to.
export async function onRequestGet({ request, env, params }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return fail(404, 'Not found');
    const row = await env.DB.prepare('SELECT avatar_url FROM admin_users WHERE id = ?')
      .bind(id)
      .first();
    const avatar = String(row?.avatar_url || '');
    if (!avatar) return fail(404, 'Not found');

    if (avatar.startsWith('data:')) {
      const m = avatar.match(DATA_URL_RE);
      if (!m) return fail(404, 'Not found');
      const bin = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': m[1],
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Normal URL or site path — hand the browser over to it.
    const target = new URL(avatar, new URL(request.url).origin);
    return Response.redirect(target.href, 302);
  } catch {
    return fail(500, 'Server error');
  }
}
