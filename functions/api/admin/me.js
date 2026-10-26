import { json, fail } from '../../lib/http.js';
import { getSessionUser } from '../../lib/auth.js';

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
