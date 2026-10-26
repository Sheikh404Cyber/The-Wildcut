import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { hashPassword } from '../../lib/auth.js';
import { cleanStr, isEmail } from '../../lib/util.js';

// First-owner creation. Works ONLY while admin_users is empty AND the caller
// presents the SETUP_TOKEN secret (set in Cloudflare → Settings → Variables).
// After the first account exists this endpoint refuses forever. No default password exists.
export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    if (!env.SETUP_TOKEN) return fail(503, 'SETUP_TOKEN is not configured');

    const body = await readJson(request);
    if (!body) return fail(400, 'Invalid request');
    if (String(body.setup_token || '') !== String(env.SETUP_TOKEN)) {
      return fail(403, 'Setup token সঠিক নয়');
    }

    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first();
    if ((count?.n ?? 0) > 0) return fail(409, 'Admin account ইতিমধ্যে তৈরি হয়েছে');

    const name = cleanStr(body.name, 100);
    const email = cleanStr(body.email, 150).toLowerCase();
    const password = String(body.password || '');
    if (!name) return fail(400, 'নাম দিতে হবে');
    if (!isEmail(email)) return fail(400, 'সঠিক ইমেইল দিতে হবে');
    if (password.length < 10) return fail(400, 'পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে');

    const { hash, salt } = await hashPassword(password);
    const res = await env.DB.prepare(
      `INSERT INTO admin_users (name, email, password_hash, password_salt, role)
       VALUES (?, ?, ?, ?, 'owner')`
    )
      .bind(name, email, hash, salt)
      .run();

    return json({ ok: true, id: res.meta.last_row_id, message: 'Owner account তৈরি হয়েছে। এখন লগইন করুন।' }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}
