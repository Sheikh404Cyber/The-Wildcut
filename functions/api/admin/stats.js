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
         (SELECT COUNT(*) FROM admin_users WHERE is_active = 1) AS users`
    ).first();

    const { results: latest } = await env.DB.prepare(
      `SELECT n.id, n.title, n.slug, n.status, n.updated_at, c.name AS category_name
         FROM news n LEFT JOIN categories c ON c.id = n.category_id
        ORDER BY n.updated_at DESC LIMIT 5`
    ).all();

    return json({ ok: true, counts, latest });
  } catch {
    return fail(500, 'Server error');
  }
}
