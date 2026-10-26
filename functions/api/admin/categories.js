import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireRole } from '../../lib/auth.js';
import { cleanStr, slugify } from '../../lib/util.js';

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireRole(request, env, ['owner', 'admin', 'editor']);
    if (auth.response) return auth.response;
    const { results } = await env.DB.prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM news n WHERE n.category_id = c.id) AS news_count
         FROM categories c ORDER BY c.sort_order ASC, c.id ASC`
    ).all();
    return json({ ok: true, categories: results });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ['owner', 'admin']);
    if (auth.response) return auth.response;

    const body = await readJson(request);
    const name = cleanStr(body?.name, 100);
    if (!name) return fail(400, 'ক্যাটাগরির নাম দিতে হবে');
    const slug = slugify(cleanStr(body?.slug, 120) || name);
    const dupe = await env.DB.prepare('SELECT id FROM categories WHERE slug = ?').bind(slug).first();
    if (dupe) return fail(409, 'এই slug দিয়ে আগেই একটি ক্যাটাগরি আছে');

    const res = await env.DB.prepare(
      'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)'
    )
      .bind(name, slug, cleanStr(body?.description, 300), parseInt(body?.sort_order, 10) || 0)
      .run();
    return json({ ok: true, id: res.meta.last_row_id, slug }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}
