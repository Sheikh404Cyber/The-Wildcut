// The Wildcut — public site logic (header, ticker, homepage, category, contact).

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Branded placeholder used when a cover image fails to load.
const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#2A661C"/><text x="400" y="238" font-family="serif" font-size="46" fill="#FFFFFF" text-anchor="middle">The Wildcut</text></svg>'
  );
const IMG_FALLBACK = `onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'"`;

function bnDate(sqlTs) {
  if (!sqlTs) return '';
  const d = new Date(String(sqlTs).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(d);
  } catch {
    return '';
  }
}

async function getJSON(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data;
}

function cardHtml(n) {
  return `<a class="card reveal" href="/news/${encodeURIComponent(n.slug)}">
    ${
      n.cover_image_url
        ? `<img class="card-img" src="${esc(n.cover_image_url)}" alt="" loading="lazy" decoding="async" ${IMG_FALLBACK}>`
        : `<div class="card-ph">WILDCUT</div>`
    }
    <div class="card-body">
      ${n.category_name ? `<span class="card-cat">${esc(n.category_name)}</span>` : ''}
      <h3>${esc(n.title)}</h3>
      ${n.excerpt ? `<p>${esc(n.excerpt)}</p>` : ''}
      <time>${esc(bnDate(n.published_at))}</time>
    </div>
  </a>`;
}

function skeletonHtml(count = 6) {
  return Array.from(
    { length: count },
    () => `<div class="card skel"><div class="skel-img"></div><div class="card-body">
      <div class="skel-line w40"></div><div class="skel-line w90"></div><div class="skel-line w70"></div>
    </div></div>`
  ).join('');
}

const revealObserver =
  'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => entries.forEach((en) => en.isIntersecting && (en.target.classList.add('in'), revealObserver.unobserve(en.target))),
        { threshold: 0.08 }
      )
    : null;

function watchReveals(scope) {
  scope.querySelectorAll('.reveal:not(.in)').forEach((el) => (revealObserver ? revealObserver.observe(el) : el.classList.add('in')));
}

/* ---------------- Shared header: menu, search, theme ---------------- */
function hydrateCategoryLinks(categories) {
  if (!Array.isArray(categories)) return;
  const links = categories
    .map((c) => `<a href="/category.html?slug=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`)
    .join('');
  document.querySelectorAll('[data-category-links], [data-footer-category-links]').forEach((el) => {
    el.innerHTML = links;
  });
}

async function initDynamicCategories() {
  try {
    const data = await getJSON('/api/public/categories');
    hydrateCategoryLinks(data.categories);
    return data.categories;
  } catch {
    // The server-rendered fallback links stay usable if the API is unavailable.
    return null;
  }
}

function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const navToggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  const setNavOpen = (open) => {
    if (!nav || !navToggle) return;
    nav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  };
  if (navToggle && nav) {
    navToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      setNavOpen(!nav.classList.contains('open'));
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setNavOpen(false);
    });
    document.addEventListener('click', (event) => {
      if (nav.classList.contains('open') && !header.contains(event.target)) setNavOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        setNavOpen(false);
        navToggle.focus();
      }
    });
  }

  const searchForm = document.getElementById('site-search');
  const searchInput = document.getElementById('site-search-input');
  const searchToggle = document.getElementById('search-toggle');
  if (searchToggle) {
    searchToggle.addEventListener('click', () => {
      const isOpen = header.classList.contains('search-open');
      if (isOpen && searchInput?.value.trim()) {
        searchForm?.requestSubmit();
        return;
      }
      const open = header.classList.toggle('search-open');
      searchToggle.setAttribute('aria-expanded', String(open));
      if (open) searchInput?.focus();
    });
  }

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const paint = () => {
      themeToggle.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙';
    };
    paint();
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('wc-theme', next); } catch { /* private mode */ }
      paint();
    });
  }
}

/* ---------------- News ticker ---------------- */
async function initTicker() {
  const wrap = document.getElementById('news-ticker');
  const track = document.getElementById('ticker-track');
  if (!wrap || !track) return;
  try {
    const data = await getJSON('/api/public/news?limit=10');
    if (!data.news.length) return;
    const half =
      data.news
        .map((n) => `<a class="ticker-item" href="/news/${encodeURIComponent(n.slug)}">${esc(n.title)}</a>`)
        .join('<span class="ticker-dot">•</span>') + '<span class="ticker-dot">•</span>';
    track.innerHTML = half + half; // duplicated for a seamless loop
    wrap.hidden = false;
  } catch { /* ticker is decoration — stay hidden on error */ }
}

/* ---------------- Homepage ---------------- */
async function initHome() {
  const heroEl = document.getElementById('hero');
  const chipsEl = document.getElementById('category-chips');
  const latestGrid = document.getElementById('latest-grid');
  const loadMoreBtn = document.getElementById('load-more');
  const sectionsEl = document.getElementById('category-sections');
  if (!latestGrid) return;

  const q = (new URLSearchParams(location.search).get('q') || '').trim();
  const searching = q.length > 0;

  if (searching) {
    // Search results mode: results grid only, with heading + clear link.
    heroEl.style.display = 'none';
    chipsEl.style.display = 'none';
    sectionsEl.style.display = 'none';
    const head = latestGrid.closest('.section')?.querySelector('.section-head');
    if (head) {
      head.querySelector('h2').textContent = `খুঁজেছেন: “${q}”`;
      head.insertAdjacentHTML('beforeend', '<a class="clear-search" href="/">✕ খোঁজ মুছুন</a>');
    }
    const input = document.getElementById('site-search-input');
    if (input) input.value = q;
  }

  // Categories → chips + sections
  let categories = [];
  if (!searching) {
    try {
      categories = (await getJSON('/api/public/categories')).categories;
      chipsEl.innerHTML = categories
        .map((c) => `<a class="chip" href="/category.html?slug=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`)
        .join('');
    } catch { /* categories are optional decoration on the homepage */ }
  }

  // Hero: featured news, else latest
  if (!searching) {
    try {
      let hero = (await getJSON('/api/public/news?featured=1&limit=1')).news[0];
      if (!hero) hero = (await getJSON('/api/public/news?limit=1')).news[0];
      if (hero) {
        heroEl.innerHTML = `
          ${hero.cover_image_url ? `<img class="hero-bg" src="${esc(hero.cover_image_url)}" alt="" fetchpriority="high" decoding="async" ${IMG_FALLBACK}>` : ''}
          <div class="hero-content">
            ${hero.category_name ? `<span class="chip">${esc(hero.category_name)}</span>` : ''}
            <h1>${esc(hero.title)}</h1>
            ${hero.excerpt ? `<p class="hero-excerpt">${esc(hero.excerpt)}</p>` : ''}
            ${
              hero.author_name
                ? `<p class="hero-byline"><img class="byline-avatar" src="${esc(hero.author_avatar || '/assets/img/logo-cream.jpg')}" alt="" ${IMG_FALLBACK}><span>লিখেছেন <span class="byline-name">${esc(hero.author_name)}</span></span></p>`
                : ''
            }
            <p><time>${esc(bnDate(hero.published_at))}</time></p>
          </div>`;
        heroEl.href = `/news/${encodeURIComponent(hero.slug)}`;
      } else {
        heroEl.style.display = 'none';
      }
    } catch {
      heroEl.style.display = 'none';
    }
  }

  // Latest / search-results grid with Load More
  latestGrid.innerHTML = skeletonHtml(6);
  let page = 1;
  async function loadLatest() {
    try {
      const query = searching ? `&q=${encodeURIComponent(q)}` : '';
      const data = await getJSON(`/api/public/news?limit=9&page=${page}${query}`);
      if (page === 1) latestGrid.innerHTML = '';
      if (page === 1 && data.news.length === 0) {
        latestGrid.innerHTML = searching
          ? '<p class="empty-note">দুঃখিত, এই খোঁজে কোনো খবর পাওয়া যায়নি।</p>'
          : '<p class="empty-note">এখনো কোনো খবর প্রকাশ হয়নি।</p>';
      } else {
        latestGrid.insertAdjacentHTML('beforeend', data.news.map(cardHtml).join(''));
        watchReveals(latestGrid);
      }
      loadMoreBtn.style.display = data.hasMore ? 'block' : 'none';
    } catch {
      if (page === 1) latestGrid.innerHTML = '<p class="empty-note">খবর লোড করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।</p>';
      loadMoreBtn.style.display = 'none';
    }
  }
  loadMoreBtn.addEventListener('click', () => { page += 1; loadLatest(); });
  await loadLatest();

  if (searching) return;

  // Category sections (3 cards each, only when the category has news)
  for (const c of categories) {
    try {
      const data = await getJSON(`/api/public/news?category=${encodeURIComponent(c.slug)}&limit=3`);
      if (!data.news.length) continue;
      const section = document.createElement('section');
      section.className = 'section';
      section.innerHTML = `
        <div class="section-head"><h2>${esc(c.name)}</h2>
        <a href="/category.html?slug=${encodeURIComponent(c.slug)}">সব খবর →</a></div>
        <div class="card-grid">${data.news.map(cardHtml).join('')}</div>`;
      sectionsEl.appendChild(section);
      watchReveals(section);
    } catch { /* skip section on error */ }
  }
}

/* ---------------- Category page ---------------- */
async function initCategory() {
  const grid = document.getElementById('category-grid');
  if (!grid) return;
  const loadMoreBtn = document.getElementById('load-more');
  const titleEl = document.getElementById('category-title');
  const slug = new URLSearchParams(location.search).get('slug') || '';

  try {
    const cats = (await getJSON('/api/public/categories')).categories;
    const cat = cats.find((c) => c.slug === slug);
    if (cat) {
      titleEl.textContent = cat.name;
      document.title = `${cat.name} | The Wildcut`;
      if (cat.description) document.getElementById('category-desc').textContent = cat.description;
    }
  } catch { /* keep default title */ }

  grid.innerHTML = skeletonHtml(6);
  let page = 1;
  async function load() {
    try {
      const data = await getJSON(`/api/public/news?category=${encodeURIComponent(slug)}&limit=9&page=${page}`);
      if (page === 1) grid.innerHTML = '';
      if (page === 1 && data.news.length === 0) {
        grid.innerHTML = '<p class="empty-note">এই ক্যাটাগরিতে এখনো কোনো খবর নেই।</p>';
      } else {
        grid.insertAdjacentHTML('beforeend', data.news.map(cardHtml).join(''));
        watchReveals(grid);
      }
      loadMoreBtn.style.display = data.hasMore ? 'block' : 'none';
    } catch {
      grid.innerHTML = '<p class="empty-note">খবর লোড করা যায়নি।</p>';
      loadMoreBtn.style.display = 'none';
    }
  }
  loadMoreBtn.addEventListener('click', () => { page += 1; load(); });
  await load();
}

/* ---------------- Contact page ---------------- */
async function initContact() {
  const emailRow = document.getElementById('contact-email-row');
  const phoneRow = document.getElementById('contact-phone-row');
  if (!emailRow && !phoneRow) return;
  try {
    const s = await getJSON('/api/public/settings');
    if (s.contact_email && emailRow) {
      const a = document.getElementById('contact-email');
      a.href = `mailto:${s.contact_email}`;
      a.textContent = s.contact_email;
      emailRow.hidden = false;
    }
    if (s.contact_phone && phoneRow) {
      const a = document.getElementById('contact-phone');
      a.href = `tel:${s.contact_phone.replace(/[\s-]/g, '')}`;
      a.textContent = s.contact_phone;
      phoneRow.hidden = false;
    }
  } catch { /* contact rows simply stay hidden */ }
}

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initDynamicCategories();
  initTicker();
  initHome();
  initCategory();
  initContact();
});
