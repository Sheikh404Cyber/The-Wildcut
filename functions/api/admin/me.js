import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { getSessionUser } from '../../lib/auth.js';
import { cleanStr, isSafeUrl, sqlTime } from '../../lib/util.js';

export async function onRequestGet({ request, env }) {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return fail(401, 'Login required');
    // Also tell the panel whether first-time setup is still open (no users yet).
    return json({ ok: true, user });
  } catch {
    return fail(500, 'Server error');
  }
}

// Update your OWN profile: display name + avatar. The avatar is stored once on
// the account and then shown automatically with every news byline — either a
// /media/ path, a safe http(s) URL, or a small image sent as a data URL
// (there is no file storage, so the panel downscales photos to a ≤256px JPEG
// data URL; it is stored as-is and served via /api/public/avatar/<id>).
const AVATAR_DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_DATA_URL_MAX = 200000;

export async function onRequestPut({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const user = await getSessionUser(request, env);
    if (!user) return fail(401, 'Login required');

    const body = await readJson(request);
    const name = cleanStr(body?.name, 100);
    if (!name) return fail(400, 'নাম দিতে হবে');
    let avatar = String(body?.avatar_url ?? '').trim();
    if (avatar.startsWith('data:image/')) {
      if (avatar.length > AVATAR_DATA_URL_MAX || !AVATAR_DATA_URL_RE.test(avatar)) {
        return fail(400, 'ছবিটি সঠিক নয় বা বেশি বড়');
      }
    } else {
      avatar = cleanStr(avatar, 500);
      if (avatar && !avatar.startsWith('/media/') && !isSafeUrl(avatar)) {
        return fail(400, 'ছবির URL সঠিক নয়');
      }
    }

    await env.DB.prepare('UPDATE admin_users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?')
      .bind(name, avatar, sqlTime(), user.id)
      .run();

    return json({ ok: true, user: { ...user, name, avatar_url: avatar } });
  } catch {
    return fail(500, 'Server error');
  }
}

// The admin page calls this (unauthenticated OK) to decide whether to show the
// "create owner account" form: setup is open only while zero admin users exist.
export async function onRequestPost({ env }) {
  try {
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first();
    return json({ ok: true, setupOpen: (count?.n ?? 0) === 0 });
  } catch {
    return fail(500, 'Server error');
  }
}
