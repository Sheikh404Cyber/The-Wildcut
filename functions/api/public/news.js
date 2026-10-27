import { json, fail } from '../../lib/http.js';
import { clampInt } from '../../lib/util.js';
import { publishDue } from '../../lib/publishDue.js';

/** Escape LIKE wildcards so reader input can never act as a pattern. */
function likePattern(q) {
  return `%${q.replace(/[!%_]/g, '!$&')}%`;
}

// Public list — ONLY published news, ever.
export async function onRequestGet({ request, env }) {
  try {
    await publishDue(env.DB);
    const url = new URL(request.url);
    const page = clampInt(url.searchParams.get('page'), 1, 10000, 1);
    const limit = clampInt(url.searchParams.get('limit'), 1, 24, 9);
    const categorySlug = url.searchParams.get('category') || '';
    const featuredOnly = url.searchParams.get('featured') === '1';
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const offset = (page - 1) * limit;

    const where = ["n.status = 'published'"];
    const binds = [];
    if (categorySlug) {
      where.push('c.slug = ?');
      binds.push(categorySlug);
    }
    if (featuredOnly) where.push('n.featured = 1');
    if (q) {
      where.push("(n.title LIKE ? ESCAPE '!' OR n.excerpt LIKE ? ESCAPE '!' OR n.content LIKE ? ESCAPE '!')");
      const like = likePattern(q);
      binds.push(like, like, like);
    }

    const sql = `
      SELECT n.id, n.title, n.slug, n.excerpt, n.cover_image_url, n.author, n.created_by,
             COALESCE(NULLIF(n.author, ''), u.name) AS author_name,
             CASE WHEN n.author <> '' THEN '' ELSE COALESCE(u.avatar_url, '') END AS author_avatar,
             n.featured, n.published_at, c.name AS category_name, c.slug AS category_slug
        FROM news n
        LEFT JOIN categories c ON c.id = n.category_id
        LEFT JOIN admin_users u ON u.id = n.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY n.published_at DESC, n.id DESC
       LIMIT ? OFFSET ?`;

    const { results } = await env.DB.prepare(sql).bind(...binds, limit + 1, offset).all();
    const hasMore = results.length > limit;
    // Avatars stored as data URLs are served through the avatar endpoint
    // instead (a raw data URL would be huge in list JSON); created_by is an
    // internal id and is not exposed in the public response.
    const news = results.slice(0, limit).map((row) => {
      const { created_by, ...rest } = row;
      if (rest.author_avatar && rest.author_avatar.startsWith('data:') && created_by) {
        rest.author_avatar = `/api/public/avatar/${created_by}`;
      }
      return rest;
    });
    return json(
      { ok: true, news, page, hasMore },
      200,
      { 'Cache-Control': 'public, max-age=60' }
    );
  } catch {
    return fail(500, 'Server error');
  }
}
