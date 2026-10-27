import { json, fail } from '../../lib/http.js';
import { requireRole } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireRole(request, env, ['owner', 'admin', 'editor']);
    if (auth.response) return auth.response;

    const counts = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM news WHERE status = 'published') AS published,
         (SELECT COUNT(*) FROM news WHERE status = 'draft') AS drafts,
         (SELECT COUNT(*) FROM news) AS total_news,
         (SELECT COUNT(*) FROM categories) AS categories,
         (SELECT COUNT(*) FROM admin_users WHERE is_active = 1) AS users,
         (SELECT COALESCE(SUM(views), 0) FROM news) AS total_views`
    ).first();

    const { results: latest } = await env.DB.prepare(
      `SELECT n.id, n.title, n.slug, n.status, n.updated_at, c.name AS category_name
         FROM news n LEFT JOIN categories c ON c.id = n.category_id
        ORDER BY n.updated_at DESC LIMIT 5`
    ).all();

    // Analytics (admin-only): the 5 most-viewed published articles.
    const { results: topPosts } = await env.DB.prepare(
      `SELECT title, slug, views FROM news
        WHERE status = 'published'
        ORDER BY views DESC, id DESC LIMIT 5`
    ).all();

    return json({ ok: true, counts, total_views: counts.total_views, latest, top_posts: topPosts });
  } catch {
    return fail(500, 'Server error');
  }
}
