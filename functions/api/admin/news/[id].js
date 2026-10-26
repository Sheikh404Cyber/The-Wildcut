import { json, fail, readJson, sameOrigin } from '../../../lib/http.js';
import { requireRole } from '../../../lib/auth.js';
import { extractNewsFields, uniqueSlug } from '../../../lib/newsFields.js';
import { sqlTime } from '../../../lib/util.js';

const ROLES = ['owner', 'admin', 'editor'];

export async function onRequestGet({ request, env, params }) {
  try {
    const auth = await requireRole(request, env, ROLES);
    if (auth.response) return auth.response;
    const news = await env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(params.id).first();
    if (!news) return fail(404, 'News not found');
    return json({ ok: true, news });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestPut({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ROLES);
    if (auth.response) return auth.response;

    const existing = await env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(params.id).first();
    if (!existing) return fail(404, 'News not found');

    const body = await readJson(request);
    const { fields, error } = extractNewsFields(body, existing);
    if (error) return fail(400, error);

    if (fields.category_id) {
      const cat = await env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(fields.category_id).first();
      if (!cat) return fail(400, 'ক্যাটাগরি পাওয়া যায়নি');
    }

    const slug = await uniqueSlug(env.DB, fields.slugInput || fields.titleForSlug, existing.id);
    await env.DB.prepare(
      `UPDATE news SET title = ?, slug = ?, excerpt = ?, content = ?, cover_image_url = ?,
         extra_images = ?, category_id = ?, author = ?, source_name = ?, source_url = ?,
         seo_title = ?, seo_description = ?, featured = ?, status = ?, published_at = ?,
         updated_at = ?
       WHERE id = ?`
    )
      .bind(
        fields.title, slug, fields.excerpt, fields.content, fields.cover_image_url,
        fields.extra_images, fields.category_id, fields.author, fields.source_name,
        fields.source_url, fields.seo_title, fields.seo_description, fields.featured,
        fields.status, fields.published_at, sqlTime(), existing.id
      )
      .run();

    return json({ ok: true, slug });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ROLES);
    if (auth.response) return auth.response;

    const existing = await env.DB.prepare('SELECT id FROM news WHERE id = ?').bind(params.id).first();
    if (!existing) return fail(404, 'News not found');
    await env.DB.prepare('DELETE FROM news WHERE id = ?').bind(params.id).run();
    return json({ ok: true });
  } catch {
    return fail(500, 'Server error');
  }
}
