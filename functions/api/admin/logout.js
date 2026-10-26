import { json, fail, sameOrigin, clearCookieHeader } from '../../lib/http.js';
import { destroySession } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    await destroySession(request, env);
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader() });
  } catch {
    return fail(500, 'Server error');
  }
}
