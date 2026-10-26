import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireRole, hashPassword } from '../../lib/auth.js';
import { cleanStr, isEmail } from '../../lib/util.js';

const ROLES = ['owner', 'admin', 'editor'];

// Owner-only user management (per Amin Sheikh's multi-access amendment).
export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireRole(request, env, ['owner']);
    if (auth.response) return auth.response;
    const { results } = await env.DB.prepare(
      'SELECT id, name, email, role, is_active, created_at FROM admin_users ORDER BY id ASC'
    ).all();
    return json({ ok: true, users: results });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ['owner']);
    if (auth.response) return auth.response;

    const body = await readJson(request);
    const name = cleanStr(body?.name, 100);
    const email = cleanStr(body?.email, 150).toLowerCase();
    const password = String(body?.password || '');
    const role = ROLES.includes(body?.role) ? body.role : 'editor';
    if (!name) return fail(400, 'নাম দিতে হবে');
    if (!isEmail(email)) return fail(400, 'সঠিক ইমেইল দিতে হবে');
    if (password.length < 8) return fail(400, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে');

    const dupe = await env.DB.prepare('SELECT id FROM admin_users WHERE email = ?').bind(email).first();
    if (dupe) return fail(409, 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে');

    const { hash, salt } = await hashPassword(password);
    const res = await env.DB.prepare(
      'INSERT INTO admin_users (name, email, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(name, email, hash, salt, role)
      .run();
    return json({ ok: true, id: res.meta.last_row_id }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}
