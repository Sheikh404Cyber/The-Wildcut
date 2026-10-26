import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireRole, hashPassword } from '../../../lib/auth.js';
import { cleanStr, sqlTime } from '../../../lib/util.js';

const ROLES = ['owner', 'admin', 'editor'];

export async function onRequestPut({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ['owner']);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT * FROM admin_users WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'User not found');

    const body = await readJson(request);
    const isSelf = target.id === auth.user.id;

    const name = body?.name !== undefined ? cleanStr(body.name, 100) : target.name;
    if (!name) return fail(400, 'নাম দিতে হবে');

    let role = target.role;
    if (body?.role !== undefined) {
      if (!ROLES.includes(body.role)) return fail(400, 'Role সঠিক নয়');
      if (isSelf && body.role !== 'owner') return fail(400, 'নিজের owner role বদলানো যাবে না');
      role = body.role;
    }

    let isActive = target.is_active;
    if (body?.is_active !== undefined) {
      if (isSelf && !body.is_active) return fail(400, 'নিজের অ্যাকাউন্ট বন্ধ করা যাবে না');
      isActive = body.is_active ? 1 : 0;
    }

    await env.DB.prepare(
      'UPDATE admin_users SET name = ?, role = ?, is_active = ?, updated_at = ? WHERE id = ?'
    )
      .bind(name, role, isActive, sqlTime(), target.id)
      .run();

    if (body?.password) {
      const password = String(body.password);
      if (password.length < 8) return fail(400, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে');
      const { hash, salt } = await hashPassword(password);
      await env.DB.prepare('UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE id = ?')
        .bind(hash, salt, target.id)
        .run();
      // Password changed → kill that user's existing sessions.
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id).run();
    }

    if (!isActive) {
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id).run();
    }

    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ['owner']);
    if (auth.response) return auth.response;

    const target = await env.DB.prepare('SELECT id FROM admin_users WHERE id = ?').bind(params.id).first();
    if (!target) return fail(404, 'User not found');
    if (target.id === auth.user.id) return fail(400, 'নিজের অ্যাকাউন্ট মুছে ফেলা যাবে না');

    await env.DB.prepare('DELETE FROM admin_users WHERE id = ?').bind(target.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}
