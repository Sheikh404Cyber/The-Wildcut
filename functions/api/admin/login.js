import { json, fail, readJson, sameOrigin, sessionCookieHeader, clientIp } from '../../lib/http.js';
import {
  verifyPassword,
  createSession,
  SESSION_TTL_SECONDS,
  loginRateLimited,
  recordFailedLogin,
  clearFailedLogins,
} from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const ip = clientIp(request);
    if (await loginRateLimited(env.DB, ip)) {
      return fail(429, 'অনেকবার ভুল চেষ্টা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।');
    }

    const body = await readJson(request);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) return fail(400, 'ইমেইল ও পাসওয়ার্ড দিতে হবে');

    const user = await env.DB.prepare(
      'SELECT * FROM admin_users WHERE email = ? AND is_active = 1'
    )
      .bind(email)
      .first();

    const ok = user ? await verifyPassword(password, user.password_hash, user.password_salt) : false;
    if (!ok) {
      await recordFailedLogin(env.DB, ip);
      return fail(401, 'ইমেইল বা পাসওয়ার্ড ভুল');
    }

    await clearFailedLogins(env.DB, ip);
    const token = await createSession(env.DB, user.id);
    return json(
      { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
      200,
      { 'Set-Cookie': sessionCookieHeader(token, SESSION_TTL_SECONDS) }
    );
  } catch {
    return fail(500, 'Server error');
  }
}
