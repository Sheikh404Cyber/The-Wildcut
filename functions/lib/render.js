// Server-rendered article page. Facebook's crawler does not run JavaScript,
// so the full HTML (with Open Graph tags) must be produced here on the server.

import { escapeHtml as e, bnDate, paragraphs, parseExtraImages, autoExcerpt } from './util.js';

const FB_PAGE = 'https://www.facebook.com/thewildcutbd';

/** Applies the saved theme (or the OS preference) before first paint. */
const THEME_SCRIPT =
  "<script>(function(){try{var t=localStorage.getItem('wc-theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();</script>";

/** Branded placeholder shown when an image fails to load. */
const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#2A661C"/><text x="400" y="238" font-family="serif" font-size="46" fill="#FFFFFF" text-anchor="middle">The Wildcut</text></svg>'
  );
const IMG_FALLBACK = `onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"`;

const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700&family=Noto+Serif+Bengali:wght@400;600;700;800&display=swap" rel="stylesheet">`;

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
    author: [{ '@type': 'Person', name: news.author_name || news.author || 'The Wildcut' }],
    publisher: {
      '@type': 'Organization',
      name: 'The Wildcut',
      logo: { '@type': 'ImageObject', url: `${origin}/assets/img/logo-dark.png` },
    },
    mainEntityOfPage: canonical,
  };

  const readingWords = String(news.content ?? '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(readingWords / 200));
  const bnDigits = (value) => String(value).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  const readingTime = `পড়তে ~${bnDigits(readingMinutes)} মিনিট`;

  const bodyHtml = paragraphs(news.content)
    .map((p) => `<p>${e(p)}</p>`)
    .join('\n');

  const extrasHtml = extras
    .map(
      (img) =>
        `<figure class="article-figure"><img src="${e(absolute(origin, img.url))}" alt="${e(img.alt)}" loading="lazy" ${IMG_FALLBACK}>${
          img.alt ? `<figcaption>${e(img.alt)}</figcaption>` : ''
        }</figure>`
    )
    .join('\n');

  const relatedHtml = related.length
    ? `<section class="related"><h2>সম্পর্কিত খবর</h2><div class="card-grid">${related
        .map(
          (r) => `<a class="card" href="/news/${e(r.slug)}">
            ${r.cover_image_url ? `<img class="card-img" src="${e(absolute(origin, r.cover_image_url))}" alt="" loading="lazy" decoding="async" ${IMG_FALLBACK}>` : ''}
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
${FONT_LINKS}
${THEME_SCRIPT}
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<header class="site-header">
  <div class="header-bar">
  <a class="brand" href="/">
    <img class="logo-light" src="/assets/img/logo-dark.png" alt="The Wildcut — Voice of the Wild">
    <img class="logo-dark" src="/assets/img/logo-white.png" alt="The Wildcut — Voice of the Wild">
  </a>
  <div class="header-actions">
    <form class="search-box" id="site-search" action="/" method="get" role="search">
      <input type="search" name="q" id="site-search-input" placeholder="খবর খুঁজুন…" aria-label="খবর খুঁজুন">
    </form>
    <button class="icon-btn" id="search-toggle" type="button" aria-label="খুঁজুন" aria-expanded="false">🔍</button>
    <button class="icon-btn" id="theme-toggle" type="button" aria-label="ডার্ক / লাইট মোড">🌙</button>
    <button class="icon-btn nav-toggle" id="nav-toggle" type="button" aria-label="মেনু" aria-expanded="false">☰</button>
  </div>
  </div>
  <nav class="main-nav" id="main-nav" aria-label="প্রধান নেভিগেশন">
    <a href="/">হোম</a>
    <span class="nav-category-links" data-category-links>
      <a href="/category.html?slug=bangladesh">বাংলাদেশ</a>
      <a href="/category.html?slug=international">আন্তর্জাতিক</a>
      <a href="/category.html?slug=conservation-environment">প্রকৃতি ও পরিবেশ</a>
      <a href="/category.html?slug=science-nature">বিজ্ঞান ও গবেষণা</a>
      <a href="/category.html?slug=law-policy">আইন ও নীতিমালা</a>
    </span>
    <a class="nav-facebook" href="${FB_PAGE}" target="_blank" rel="noopener"><svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.2-.1-2.2-.1-2.3 0-3.9 1.4-3.9 4V11H8v3h2.3v7h3.2Z"/></svg><span>Facebook</span><svg class="icon icon-external" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></svg></a>
  </nav>
</header>
<div class="ticker" id="news-ticker" hidden>
  <span class="ticker-label">সর্বশেষ</span>
  <div class="ticker-viewport"><div class="ticker-track" id="ticker-track"></div></div>
</div>

<main class="article-wrap">
  <article class="article">
    ${category ? `<a class="chip" href="/category.html?slug=${e(category.slug)}">${e(category.name)}</a>` : ''}
    <h1>${e(news.title)}</h1>
    <div class="byline">
      <img class="byline-avatar" src="${e(absolute(origin, news.author_avatar) || `${origin}/assets/img/logo-cream.jpg`)}" alt="" ${IMG_FALLBACK}>
      <div class="byline-text">
        ${news.author_name ? `<span>লিখেছেন <span class="byline-name">${e(news.author_name)}</span></span>` : ''}
        <time>${e(bnDate(news.published_at, true))}</time>
        <span class="reading-time">${e(readingTime)}</span>
      </div>
    </div>
    ${cover ? `<img class="article-cover" src="${e(cover)}" alt="${e(news.title)}" ${IMG_FALLBACK}>` : ''}
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
      <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}" target="_blank" rel="noopener"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg><span>Facebook-এ শেয়ার করুন</span></a>
    </div>
  </article>
  ${relatedHtml}
</main>

<footer class="site-footer">
  <img class="footer-logo" src="/assets/img/logo-white.png" alt="The Wildcut">
  <p class="footer-desc">বন্যপ্রাণী, প্রকৃতি, পরিবেশ ও সংরক্ষণ নিয়ে বাংলাদেশসহ বিশ্বের নির্ভরযোগ্য খবর ও মাঠপর্যায়ের গল্প।</p>
  <nav class="footer-nav" aria-label="ফুটার নেভিগেশন"><a href="/about.html">আমাদের সম্পর্কে</a><a href="/contact.html">যোগাযোগ</a><a href="/privacy.html">Privacy Policy</a><a class="footer-facebook" href="https://www.facebook.com/thewildcutbd" target="_blank" rel="noopener"><svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.2-.1-2.2-.1-2.3 0-3.9 1.4-3.9 4V11H8v3h2.3v7h3.2Z"/></svg><span>Facebook</span><svg class="icon icon-external" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></svg></a></nav>
  <div class="footer-categories">
    <h2>ক্যাটাগরি</h2>
    <div class="footer-category-links" data-footer-category-links>
        <a href="/category.html?slug=bangladesh">বাংলাদেশ</a>
        <a href="/category.html?slug=international">আন্তর্জাতিক</a>
        <a href="/category.html?slug=conservation-environment">প্রকৃতি ও পরিবেশ</a>
        <a href="/category.html?slug=science-nature">বিজ্ঞান ও গবেষণা</a>
        <a href="/category.html?slug=law-policy">আইন ও নীতিমালা</a>
    </div>
  </div>
  <p>© 2026–2031 The Wildcut. All rights reserved.</p>
</footer>
<script src="/assets/js/app.js"></script>
</body>
</html>`;
}

export function renderNotFound(origin) {
  return `<!DOCTYPE html>
<html lang="bn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>পাওয়া যায়নি | The Wildcut</title>
${FONT_LINKS}
${THEME_SCRIPT}
<link rel="stylesheet" href="/assets/css/style.css"></head>
<body><main class="article-wrap"><article class="article">
<h1>দুঃখিত, এই খবরটি পাওয়া যায়নি</h1>
<p>লিংকটি ভুল হতে পারে, অথবা খবরটি সরিয়ে নেওয়া হয়েছে।</p>
<p><a class="share-btn" href="/">হোমপেজে ফিরুন</a></p>
</article></main></body></html>`;
}
