import { html } from '../lib/http.js';
import { renderArticle, renderNotFound } from '../lib/render.js';
import { publishDue } from '../lib/publishDue.js';

// GET /news/<slug> — server-rendered article page (Facebook/SEO friendly).
export async function onRequestGet({ request, env, params, waitUntil }) {
  const origin = new URL(request.url).origin;
  try {
    await publishDue(env.DB);
    // Pages may hand the slug over percent-encoded; match either form.
    const rawSlug = String(params.slug || '');
    let decodedSlug = rawSlug;
    try { decodedSlug = decodeURIComponent(rawSlug); } catch { /* keep raw */ }
    const news = await env.DB.prepare(
      `SELECT n.*, c.name AS category_name, c.slug AS category_slug,
              COALESCE(NULLIF(n.author, ''), u.name) AS author_name,
              CASE WHEN n.author <> '' THEN '' ELSE COALESCE(u.avatar_url, '') END AS author_avatar
         FROM news n
         LEFT JOIN categories c ON c.id = n.category_id
         LEFT JOIN admin_users u ON u.id = n.created_by
        WHERE (n.slug = ? OR n.slug = ?) AND n.status = 'published'`
    )
      .bind(rawSlug, decodedSlug)
      .first();
    if (!news) return html(renderNotFound(origin), 404, 'no-store');

    // An avatar stored as a data URL is served through the avatar endpoint
    // (render.js would otherwise mangle it into a broken absolute URL).
    if (news.author_avatar && news.author_avatar.startsWith('data:') && news.created_by) {
      news.author_avatar = `/api/public/avatar/${news.created_by}`;
    }

    // Count the view (admin analytics only — never shown on the public site).
    // Fire-and-forget: a failed count must never break the article page.
    env.DB.prepare('UPDATE news SET views = views + 1 WHERE id = ?')
      .bind(news.id)
      .run()
      .catch(() => {});

    // Log the view event for the Analytics tab's time ranges (24h / 7 / 28 /
    // 60 / 90 days). Also fire-and-forget, via waitUntil when available.
    const logView = env.DB.prepare('INSERT INTO news_views (news_id) VALUES (?)')
      .bind(news.id)
      .run()
      .catch(() => {});
    if (typeof waitUntil === 'function') waitUntil(logView);

    const category = news.category_id
      ? { name: news.category_name, slug: news.category_slug }
      : null;

    const { results: related } = await env.DB.prepare(
      `SELECT id, title, slug, cover_image_url, published_at
         FROM news
        WHERE status = 'published' AND category_id IS ? AND id != ?
        ORDER BY published_at DESC LIMIT 3`
    )
      .bind(news.category_id, news.id)
      .all();

    return html(renderArticle({ news, category, related, origin }), 200, 'public, max-age=120');
  } catch {
    return html(renderNotFound(origin), 500, 'no-store');
  }
}
