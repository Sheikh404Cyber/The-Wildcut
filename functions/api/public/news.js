import { json, fail } from '../../lib/http.js';
import { clampInt } from '../../lib/util.js';

// Public list — ONLY published news, ever.
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const page = clampInt(url.searchParams.get('page'), 1, 10000, 1);
    const limit = clampInt(url.searchParams.get('limit'), 1, 24, 9);
    const categorySlug = url.searchParams.get('category') || '';
    const featuredOnly = url.searchParams.get('featured') === '1';
    const offset = (page - 1) * limit;

    const where = ["n.status = 'published'"];
    const binds = [];
    if (categorySlug) {
      where.push('c.slug = ?');
      binds.push(categorySlug);
    }
    if (featuredOnly) where.push('n.featured = 1');

    const sql = `
      SELECT n.id, n.title, n.slug, n.excerpt, n.cover_image_url, n.author,
             n.featured, n.published_at, c.name AS category_name, c.slug AS category_slug
        FROM news n LEFT JOIN categories c ON c.id = n.category_id
       WHERE ${where.join(' AND ')}
       ORDER BY n.published_at DESC, n.id DESC
       LIMIT ? OFFSET ?`;

    const { results } = await env.DB.prepare(sql).bind(...binds, limit + 1, offset).all();
    const hasMore = results.length > limit;
    return json(
      { ok: true, news: results.slice(0, limit), page, hasMore },
      200,
      { 'Cache-Control': 'public, max-age=60' }
    );
  } catch {
    return fail(500, 'Server error');
  }
}
