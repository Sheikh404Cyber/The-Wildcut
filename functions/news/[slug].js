import { html } from '../lib/http.js';
import { renderArticle, renderNotFound } from '../lib/render.js';

// GET /news/<slug> — server-rendered article page (Facebook/SEO friendly).
export async function onRequestGet({ request, env, params }) {
  const origin = new URL(request.url).origin;
  try {
    const news = await env.DB.prepare(
      `SELECT n.*, c.name AS category_name, c.slug AS category_slug
         FROM news n LEFT JOIN categories c ON c.id = n.category_id
        WHERE n.slug = ? AND n.status = 'published'`
    )
      .bind(params.slug)
      .first();
    if (!news) return html(renderNotFound(origin), 404, 'no-store');

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
