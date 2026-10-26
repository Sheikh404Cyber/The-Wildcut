// The Wildcut — public site logic (homepage + category page).

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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
        ? `<img class="card-img" src="${esc(n.cover_image_url)}" alt="" loading="lazy">`
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

/* ---------------- Homepage ---------------- */
async function initHome() {
  const heroEl = document.getElementById('hero');
  const chipsEl = document.getElementById('category-chips');
  const latestGrid = document.getElementById('latest-grid');
  const loadMoreBtn = document.getElementById('load-more');
  const sectionsEl = document.getElementById('category-sections');
  if (!latestGrid) return;

  // Categories → chips + sections
  let categories = [];
  try {
    categories = (await getJSON('/api/public/categories')).categories;
    chipsEl.innerHTML = categories
      .map((c) => `<a class="chip" href="/category.html?slug=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`)
      .join('');
  } catch { /* categories are optional decoration on the homepage */ }

  // Hero: featured news, else latest
  try {
    let hero = (await getJSON('/api/public/news?featured=1&limit=1')).news[0];
    if (!hero) hero = (await getJSON('/api/public/news?limit=1')).news[0];
    if (hero) {
      heroEl.innerHTML = `
        ${hero.cover_image_url ? `<img class="hero-bg" src="${esc(hero.cover_image_url)}" alt="">` : ''}
        <div class="hero-content">
          ${hero.category_name ? `<span class="chip">${esc(hero.category_name)}</span>` : ''}
          <h1>${esc(hero.title)}</h1>
          ${hero.excerpt ? `<p>${esc(hero.excerpt)}</p>` : ''}
          <p><time>${esc(bnDate(hero.published_at))}</time></p>
        </div>`;
      heroEl.href = `/news/${encodeURIComponent(hero.slug)}`;
    } else {
      heroEl.style.display = 'none';
    }
  } catch {
    heroEl.style.display = 'none';
  }

  // Latest grid with Load More
  let page = 1;
  async function loadLatest() {
    try {
      const data = await getJSON(`/api/public/news?limit=9&page=${page}`);
      if (page === 1 && data.news.length === 0) {
        latestGrid.innerHTML = '<p class="empty-note">এখনো কোনো খবর প্রকাশ হয়নি।</p>';
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

  let page = 1;
  async function load() {
    try {
      const data = await getJSON(`/api/public/news?category=${encodeURIComponent(slug)}&limit=9&page=${page}`);
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

document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initCategory();
});
