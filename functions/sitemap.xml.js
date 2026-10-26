// Dynamic sitemap — homepage, static pages, categories and every published news URL.
export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const urls = [
    { loc: `${origin}/`, changefreq: 'hourly', priority: '1.0' },
    { loc: `${origin}/about.html`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${origin}/contact.html`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${origin}/privacy.html`, changefreq: 'yearly', priority: '0.3' },
  ];
  try {
    const { results: cats } = await env.DB.prepare('SELECT slug FROM categories ORDER BY id').all();
    for (const c of cats) {
      urls.push({ loc: `${origin}/category.html?slug=${encodeURIComponent(c.slug)}`, changefreq: 'daily', priority: '0.7' });
    }
    const { results: news } = await env.DB.prepare(
      `SELECT slug, updated_at FROM news WHERE status = 'published' ORDER BY published_at DESC LIMIT 1000`
    ).all();
    for (const n of news) {
      urls.push({
        loc: `${origin}/news/${encodeURIComponent(n.slug)}`,
        lastmod: (n.updated_at || '').slice(0, 10),
        changefreq: 'weekly',
        priority: '0.8',
      });
    }
  } catch {
    // If the DB is not ready yet, still return the static part of the sitemap.
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (u) =>
        `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
    )
    .join('\n')}\n</urlset>`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}
