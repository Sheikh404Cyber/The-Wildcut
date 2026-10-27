import { json, fail } from '../../../lib/http.js';
import { publishDue } from '../../../lib/publishDue.js';

// Public single article (JSON) — published only. The human-facing page is /news/<slug> (SSR).
export async function onRequestGet({ params, env }) {
  try {
    await publishDue(env.DB);
    const news = await env.DB.prepare(
      `SELECT n.*, c.name AS category_name, c.slug AS category_slug,
              COALESCE(NULLIF(n.author, ''), u.name) AS author_name,
              CASE WHEN n.author <> '' THEN '' ELSE COALESCE(u.avatar_url, '') END AS author_avatar
         FROM news n
         LEFT JOIN categories c ON c.id = n.category_id
         LEFT JOIN admin_users u ON u.id = n.created_by
        WHERE n.slug = ? AND n.status = 'published'`
    )
      .bind(params.slug)
      .first();
    if (!news) return fail(404, 'News not found');

    const { results: related } = await env.DB.prepare(
      `SELECT id, title, slug, cover_image_url, published_at
         FROM news
        WHERE status = 'published' AND category_id IS ? AND id != ?
        ORDER BY published_at DESC LIMIT 3`
    )
      .bind(news.category_id, news.id)
      .all();

    return json({ ok: true, news, related }, 200, { 'Cache-Control': 'public, max-age=60' });
  } catch {
    return fail(500, 'Server error');
  }
}
