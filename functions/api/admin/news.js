import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireRole } from '../../lib/auth.js';
import { extractNewsFields, uniqueSlug } from '../../lib/newsFields.js';
import { clampInt, sqlTime } from '../../lib/util.js';

const ROLES = ['owner', 'admin', 'editor'];

// List ALL news (any status) for the admin panel.
export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireRole(request, env, ROLES);
    if (auth.response) return auth.response;

    const url = new URL(request.url);
    const page = clampInt(url.searchParams.get('page'), 1, 10000, 1);
    const limit = clampInt(url.searchParams.get('limit'), 1, 50, 15);
    const status = url.searchParams.get('status') || '';
    const q = (url.searchParams.get('q') || '').trim();
    const offset = (page - 1) * limit;

    const where = [];
    const binds = [];
    if (status === 'published' || status === 'draft') {
      where.push('n.status = ?');
      binds.push(status);
    }
    if (q) {
      where.push('n.title LIKE ?');
      binds.push(`%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { results } = await env.DB.prepare(
      `SELECT n.id, n.title, n.slug, n.status, n.featured, n.updated_at, n.published_at,
              c.name AS category_name
         FROM news n LEFT JOIN categories c ON c.id = n.category_id
         ${whereSql}
         ORDER BY n.updated_at DESC LIMIT ? OFFSET ?`
    )
      .bind(...binds, limit + 1, offset)
      .all();

    return json({ ok: true, news: results.slice(0, limit), page, hasMore: results.length > limit });
  } catch {
    return fail(500, 'Server error');
  }
}

// Create news.
export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ROLES);
    if (auth.response) return auth.response;

    const body = await readJson(request);
    const { fields, error } = extractNewsFields(body);
    if (error) return fail(400, error);

    if (fields.category_id) {
      const cat = await env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(fields.category_id).first();
      if (!cat) return fail(400, 'ক্যাটাগরি পাওয়া যায়নি');
    }

    const slug = await uniqueSlug(env.DB, fields.slugInput || fields.titleForSlug);
    const res = await env.DB.prepare(
      `INSERT INTO news (title, slug, excerpt, content, cover_image_url, extra_images,
         category_id, author, source_name, source_url, seo_title, seo_description,
         featured, status, published_at, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        fields.title, slug, fields.excerpt, fields.content, fields.cover_image_url,
        fields.extra_images, fields.category_id, fields.author, fields.source_name,
        fields.source_url, fields.seo_title, fields.seo_description, fields.featured,
        fields.status, fields.published_at, auth.user.id, sqlTime()
      )
      .run();

    return json({ ok: true, id: res.meta.last_row_id, slug }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}
