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

// Update your OWN profile: display name + avatar (avatar files are uploaded
// separately through /api/admin/upload; here we only store the URL).
export async function onRequestPut({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const user = await getSessionUser(request, env);
    if (!user) return fail(401, 'Login required');

    const body = await readJson(request);
    const name = cleanStr(body?.name, 100);
    if (!name) return fail(400, 'নাম দিতে হবে');
    const avatar = cleanStr(body?.avatar_url, 500);
    if (avatar && !avatar.startsWith('/media/') && !isSafeUrl(avatar)) {
      return fail(400, 'ছবির URL সঠিক নয়');
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
