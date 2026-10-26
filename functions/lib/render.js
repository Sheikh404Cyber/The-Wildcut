// Server-rendered article page. Facebook's crawler does not run JavaScript,
// so the full HTML (with Open Graph tags) must be produced here on the server.

import { escapeHtml as e, bnDate, paragraphs, parseExtraImages, autoExcerpt } from './util.js';

const FB_PAGE = 'https://www.facebook.com/thewildcutbd';

function absolute(origin, url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return origin + (url.startsWith('/') ? url : '/' + url);
}

export function renderArticle({ news, category, related, origin }) {
  const title = news.seo_title || news.title;
  const desc = news.seo_description || news.excerpt || autoExcerpt(news.content, 200);
  const canonical = `${origin}/news/${news.slug}`;
  const cover = absolute(origin, news.cover_image_url);
  const ogImage = cover || `${origin}/assets/img/logo-white-green.jpg`;
  const extras = parseExtraImages(news.extra_images);
  const publishedIso = news.published_at ? news.published_at.replace(' ', 'T') + 'Z' : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: news.title,
    description: desc,
    image: ogImage ? [ogImage] : [],
    datePublished: publishedIso,
    dateModified: (news.updated_at || '').replace(' ', 'T') + 'Z',
    author: [{ '@type': 'Person', name: news.author || 'The Wildcut' }],
    publisher: {
      '@type': 'Organization',
      name: 'The Wildcut',
      logo: { '@type': 'ImageObject', url: `${origin}/assets/img/logo-dark.png` },
    },
    mainEntityOfPage: canonical,
  };

  const bodyHtml = paragraphs(news.content)
    .map((p) => `<p>${e(p)}</p>`)
    .join('\n');

  const extrasHtml = extras
    .map(
      (img) =>
        `<figure class="article-figure"><img src="${e(absolute(origin, img.url))}" alt="${e(img.alt)}" loading="lazy">${
          img.alt ? `<figcaption>${e(img.alt)}</figcaption>` : ''
        }</figure>`
    )
    .join('\n');

  const relatedHtml = related.length
    ? `<section class="related"><h2>সম্পর্কিত খবর</h2><div class="card-grid">${related
        .map(
          (r) => `<a class="card" href="/news/${e(r.slug)}">
            ${r.cover_image_url ? `<img class="card-img" src="${e(absolute(origin, r.cover_image_url))}" alt="" loading="lazy">` : ''}
            <div class="card-body"><h3>${e(r.title)}</h3><time>${e(bnDate(r.published_at))}</time></div></a>`
        )
        .join('')}</div></section>`
    : '';

  return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(title)} | The Wildcut</title>
<meta name="description" content="${e(desc)}">
<link rel="canonical" href="${e(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="The Wildcut">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(canonical)}">
<meta property="og:image" content="${e(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(desc)}">
<meta name="twitter:image" content="${e(ogImage)}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
<link rel="icon" href="/assets/img/logo-dark.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Archivo:wght@600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="/"><img src="/assets/img/logo-dark.png" alt="The Wildcut — Voice of the Wild"></a>
  <nav class="main-nav">
    <a href="/">হোম</a>
    <a href="/category.html?slug=bangladesh">বাংলাদেশ</a>
    <a href="/category.html?slug=wildlife-rescue">বন্যপ্রাণী উদ্ধার</a>
    <a href="/category.html?slug=conservation-environment">সংরক্ষণ</a>
    <a href="${FB_PAGE}" target="_blank" rel="noopener">Facebook</a>
  </nav>
</header>

<main class="article-wrap">
  <article class="article">
    ${category ? `<a class="chip" href="/category.html?slug=${e(category.slug)}">${e(category.name)}</a>` : ''}
    <h1>${e(news.title)}</h1>
    <div class="article-meta">
      ${news.author ? `<span>✍ ${e(news.author)}</span>` : ''}
      <time>${e(bnDate(news.published_at, true))}</time>
    </div>
    ${cover ? `<img class="article-cover" src="${e(cover)}" alt="${e(news.title)}">` : ''}
    <div class="article-body">
${bodyHtml}
    </div>
    ${extrasHtml}
    ${
      news.source_name || news.source_url
        ? `<p class="source-line">তথ্যসূত্র: ${
            news.source_url
              ? `<a href="${e(news.source_url)}" target="_blank" rel="noopener nofollow">${e(news.source_name || news.source_url)}</a>`
              : e(news.source_name)
          }</p>`
        : ''
    }
    <div class="share-row">
      <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}" target="_blank" rel="noopener">Facebook-এ শেয়ার করুন</a>
    </div>
  </article>
  ${relatedHtml}
</main>

<footer class="site-footer">
  <img class="footer-logo" src="/assets/img/logo-white-green.jpg" alt="The Wildcut">
  <nav><a href="/about.html">আমাদের সম্পর্কে</a> · <a href="/contact.html">যোগাযোগ</a> · <a href="/privacy.html">Privacy Policy</a></nav>
  <p>© 2026–2031 The Wildcut. All rights reserved.</p>
  <p>Developed by AMIN SHEIKH</p>
</footer>
</body>
</html>`;
}

export function renderNotFound(origin) {
  return `<!DOCTYPE html>
<html lang="bn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>পাওয়া যায়নি | The Wildcut</title><link rel="stylesheet" href="/assets/css/style.css"></head>
<body><main class="article-wrap"><article class="article">
<h1>দুঃখিত, এই খবরটি পাওয়া যায়নি</h1>
<p>লিংকটি ভুল হতে পারে, অথবা খবরটি সরিয়ে নেওয়া হয়েছে।</p>
<p><a class="share-btn" href="/">হোমপেজে ফিরুন</a></p>
</article></main></body></html>`;
}
