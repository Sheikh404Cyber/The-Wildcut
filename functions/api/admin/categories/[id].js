import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireRole } from '../../../lib/auth.js';
import { cleanStr, slugify, sqlTime } from '../../../lib/util.js';

export async function onRequestPut({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ['owner', 'admin']);
    if (auth.response) return auth.response;

    const existing = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(params.id).first();
    if (!existing) return fail(404, 'Category not found');

    const body = await readJson(request);
    const name = cleanStr(body?.name, 100) || existing.name;
    // Slug is a public URL — keep it stable unless the admin explicitly changes it.
    const slug = body?.slug ? slugify(cleanStr(body.slug, 120)) : existing.slug;
    if (slug !== existing.slug) {
      const dupe = await env.DB.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?')
        .bind(slug, existing.id)
        .first();
      if (dupe) return fail(409, 'এই slug দিয়ে আগেই একটি ক্যাটাগরি আছে');
    }

    await env.DB.prepare(
      'UPDATE categories SET name = ?, slug = ?, description = ?, sort_order = ?, updated_at = ? WHERE id = ?'
    )
      .bind(
        name,
        slug,
        body?.description !== undefined ? cleanStr(body.description, 300) : existing.description,
        body?.sort_order !== undefined ? parseInt(body.sort_order, 10) || 0 : existing.sort_order,
        sqlTime(),
        existing.id
      )
      .run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ['owner', 'admin']);
    if (auth.response) return auth.response;

    const existing = await env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(params.id).first();
    if (!existing) return fail(404, 'Category not found');
    // News in this category keep existing; their category_id becomes NULL (schema FK).
    await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(params.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}
