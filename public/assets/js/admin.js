// The Wildcut — admin panel logic.

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function bnDate(sqlTs) {
  if (!sqlTs) return '—';
  const d = new Date(String(sqlTs).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' }).format(d);
  } catch { return sqlTs; }
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2600);
}

function showMsg(el, text, ok) {
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'error');
  el.classList.remove('hidden');
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || data.ok === false) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

const state = { user: null, newsPage: 1, extraImages: [], slugManual: false, editingId: null, editorDirty: false };

/* ---------------- Boot ---------------- */
async function boot() {
  try {
    const probe = await api('/api/admin/me', { method: 'POST' });
    if (probe.setupOpen) {
      $('setup-view').classList.remove('hidden');
      return;
    }
  } catch { /* fall through to session check */ }
  try {
    const me = await api('/api/admin/me');
    enterApp(me.user);
  } catch {
    $('login-view').classList.remove('hidden');
  }
}

function enterApp(user) {
  state.user = user;
  $('login-view').classList.add('hidden');
  $('setup-view').classList.add('hidden');
  $('app-view').classList.remove('hidden');
  $('who-line').textContent = `${user.name} · ${user.role} · `;
  loadDashboard();
  loadCategoryOptions();
}

/* ---------------- Auth forms ---------------- */
$('setup-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = $('setup-msg');
  try {
    await api('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify({
        setup_token: $('setup-token').value,
        name: $('setup-name').value,
        email: $('setup-email').value,
        password: $('setup-password').value,
      }),
    });
    $('setup-view').classList.add('hidden');
    $('login-view').classList.remove('hidden');
    showMsg($('login-msg'), 'Owner অ্যাকাউন্ট তৈরি হয়েছে। এখন লগইন করুন।', true);
  } catch (err) {
    showMsg(msg, err.message, false);
  }
});

$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('login-email').value, password: $('login-password').value }),
    });
    enterApp(data.user);
  } catch (err) {
    showMsg($('login-msg'), err.message, false);
  }
});

$('logout-btn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* ignore */ }
  location.reload();
});

/* ---------------- Tabs ---------------- */
document.querySelectorAll('#tabs button').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  ['dashboard', 'news', 'editor', 'analytics', 'settings'].forEach((t) => {
    $('tab-' + t).classList.toggle('hidden', t !== name);
  });
  if (name === 'dashboard') loadDashboard();
  if (name === 'news') { state.newsPage = 1; loadNewsList(true); }
  if (name === 'analytics') loadAnalytics();
  if (name === 'settings') loadSettingsTab();
}

/* ---------------- Dashboard ---------------- */
async function loadDashboard() {
  try {
    const data = await api('/api/admin/stats');
    $('st-published').textContent = data.counts.published;
    $('st-drafts').textContent = data.counts.drafts;
    $('st-total').textContent = data.counts.total_news;
    $('st-cats').textContent = data.counts.categories;
    $('st-users').textContent = data.counts.users;
    $('latest-list').innerHTML = data.latest.length
      ? data.latest.map((n) => `<div class="recent-row"><span class="badge ${n.status}">${n.status}</span><a href="#" data-edit="${n.id}">${esc(n.title)}</a><time>${esc(bnDate(n.updated_at))}</time></div>`).join('')
      : '<p class="muted">এখনো কোনো খবর নেই।</p>';
    $('latest-list').querySelectorAll('[data-edit]').forEach((a) =>
      a.addEventListener('click', (ev) => { ev.preventDefault(); openEditor(a.dataset.edit); })
    );
    // Analytics (admin-only — these numbers never appear on the public site)
    $('st-views').textContent = data.total_views ?? data.counts.total_views ?? 0;
    $('top-posts').innerHTML = (data.top_posts || []).length
      ? data.top_posts.map((p, i) => `<div class="analytics-row"><span class="analytics-rank">${i + 1}</span><a href="/news/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">${esc(p.title)}</a><strong>${p.views} ভিউ</strong></div>`).join('')
      : '<p class="muted">এখনো কোনো ভিউ নেই।</p>';
  } catch (err) { toast(err.message); }
}

/* ---------------- News list ---------------- */
async function loadNewsList(reset = false) {
  try {
    const q = encodeURIComponent($('news-search').value.trim());
    const status = encodeURIComponent($('news-status-filter').value);
    const data = await api(`/api/admin/news?limit=15&page=${state.newsPage}&q=${q}&status=${status}`);
    const rows = data.news.map((n) => `
      <tr>
        <td class="news-title-cell"><strong>${esc(n.title)}</strong><span class="slug-line">/news/${esc(n.slug)}</span></td>
        <td><span class="category-label">${esc(n.category_name || '—')}</span></td>
        <td><span class="badge ${n.status}">${n.status}</span>${n.featured ? ' ⭐' : ''}${n.status === 'scheduled' && n.published_at ? `<br><span class="muted">${esc(bnDate(n.published_at))}</span>` : ''}</td>
        <td>${esc(bnDate(n.updated_at))}</td>
        <td><div class="row-actions">
          <button class="btn ghost small" data-act="edit" data-id="${n.id}">সম্পাদনা</button>
          ${n.status === 'published' ? `<button class="btn ghost small" data-act="copy" data-slug="${esc(n.slug)}">লিংক কপি</button>
          <a class="btn ghost small" href="/news/${encodeURIComponent(n.slug)}" target="_blank" rel="noopener">প্রিভিউ</a>` : ''}
          <button class="btn danger small" data-act="del" data-id="${n.id}" data-title="${esc(n.title)}">মুছুন</button>
        </div></td>
      </tr>`).join('');
    $('news-tbody').innerHTML = reset ? rows : $('news-tbody').innerHTML + rows;
    if (reset && !data.news.length) $('news-tbody').innerHTML = '<tr><td colspan="5" class="muted">কোনো খবর পাওয়া যায়নি।</td></tr>';
    $('news-more').style.display = data.hasMore ? 'inline-block' : 'none';
    bindNewsActions();
  } catch (err) { toast(err.message); }
}

function bindNewsActions() {
  $('news-tbody').querySelectorAll('button[data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const act = btn.dataset.act;
      if (act === 'edit') openEditor(btn.dataset.id);
      if (act === 'copy') {
        const link = `${location.origin}/news/${btn.dataset.slug}`;
        try { await navigator.clipboard.writeText(link); toast('লিংক কপি হয়েছে: ' + link); }
        catch { prompt('লিংকটি কপি করুন:', link); }
      }
      if (act === 'del') {
        if (!confirm(`সত্যিই মুছে ফেলতে চান?\n"${btn.dataset.title}"\nএটি আর ফেরত আনা যাবে না।`)) return;
        try {
          await api(`/api/admin/news/${btn.dataset.id}`, { method: 'DELETE' });
          toast('মুছে ফেলা হয়েছে');
          state.newsPage = 1;
          loadNewsList(true);
        } catch (err) { toast(err.message); }
      }
    };
  });
}

$('news-more').addEventListener('click', () => { state.newsPage += 1; loadNewsList(false); });
$('news-status-filter').addEventListener('change', () => { state.newsPage = 1; loadNewsList(true); });
let searchTimer;
$('news-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.newsPage = 1; loadNewsList(true); }, 350);
});
$('news-new-btn').addEventListener('click', () => openEditor(null));

/* ---------------- Editor ---------------- */
async function loadCategoryOptions(selectedId = null) {
  try {
    const data = await api('/api/admin/categories');
    $('f-category').innerHTML =
      '<option value="">— কোনো ক্যাটাগরি নয় —</option>' +
      data.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    if (selectedId) $('f-category').value = String(selectedId);
  } catch { /* editor role cannot list categories via admin endpoint fallback below */ 
    try {
      const pub = await (await fetch('/api/public/categories')).json();
      $('f-category').innerHTML =
        '<option value="">— কোনো ক্যাটাগরি নয় —</option>' +
        pub.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
      if (selectedId) $('f-category').value = String(selectedId);
    } catch { /* leave empty */ }
  }
}

function setEditorStatus(text) { $('editor-status-line').textContent = text; }

$('editor-form').addEventListener('input', () => { state.editorDirty = true; });
$('editor-form').addEventListener('change', () => { state.editorDirty = true; });
window.addEventListener('beforeunload', (event) => {
  if (!state.editorDirty) return;
  event.preventDefault();
  event.returnValue = '';
});

/** Show the date/time input only when the status needs one. */
function syncPublishedAt() {
  const st = $('f-status').value;
  $('published-at-wrap').style.display = st === 'published' || st === 'scheduled' ? 'block' : 'none';
  $('published-at-label').textContent =
    st === 'scheduled' ? 'কখন প্রকাশ হবে (Schedule)' : 'প্রকাশের তারিখ ও সময়';
}
$('f-status').addEventListener('change', syncPublishedAt);

function renderExtraImages() {
  $('extra-list').innerHTML = state.extraImages.map((img, i) => `
    <div class="extra-item">
      <img src="${esc(img.url)}" alt="">
      <input type="text" placeholder="ছবির বিবরণ (alt text)" value="${esc(img.alt)}" data-alt="${i}">
      <button class="btn danger small" type="button" data-rm="${i}">সরান</button>
    </div>`).join('');
  $('extra-list').querySelectorAll('[data-alt]').forEach((inp) =>
    inp.addEventListener('input', () => { state.extraImages[Number(inp.dataset.alt)].alt = inp.value; })
  );
  $('extra-list').querySelectorAll('[data-rm]').forEach((btn) =>
    btn.addEventListener('click', () => { state.extraImages.splice(Number(btn.dataset.rm), 1); renderExtraImages(); })
  );
}

// Direct photo upload is unavailable (no file storage), so the editor works
// with image URLs only — the upload inputs were replaced by a locked notice.

$('f-cover-url').addEventListener('input', () => {
  const value = $('f-cover-url').value.trim();
  const preview = $('cover-preview');
  if (value) {
    preview.src = value;
    preview.classList.remove('hidden');
  } else {
    preview.removeAttribute('src');
    preview.classList.add('hidden');
  }
});

$('btn-extra-add').addEventListener('click', () => {
  const url = $('f-extra-url').value.trim();
  if (!url) { toast('আগে অতিরিক্ত ছবির URL বসান'); return; }
  state.extraImages.push({ url, alt: '' });
  $('f-extra-url').value = '';
  renderExtraImages();
});

/* -------- Author info row (editor) — profile photo shows automatically -------- */
function paintAuthorInfo() {
  const u = state.user;
  if (!u) return;
  $('author-info-name').textContent = u.name || '';
  const img = $('author-info-avatar');
  const fallback = '/assets/img/logo-cream.jpg';
  img.onerror = () => { if (!img.src.endsWith('logo-cream.jpg')) img.src = fallback; };
  img.src = u.avatar_url || fallback;
}

$('btn-change-photo').addEventListener('click', () => {
  switchTab('settings');
  const card = $('profile-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function jsSlug(text) {
  return String(text || '').trim().toLowerCase().replace(/[''ʼ]/g, '').replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}
$('f-title').addEventListener('input', () => {
  if (!state.slugManual) $('f-slug').value = jsSlug($('f-title').value);
});
$('f-slug').addEventListener('input', () => { state.slugManual = true; });

async function openEditor(id) {
  state.editorDirty = false;
  state.editingId = id;
  state.slugManual = !!id;
  state.extraImages = [];
  renderExtraImages();
  $('editor-form').reset();
  $('cover-preview').classList.add('hidden');
  $('editor-msg').classList.add('hidden');
  $('editor-heading').textContent = id ? 'খবর সম্পাদনা' : 'নতুন খবর';
  $('btn-unpublish').classList.add('hidden');
  $('f-status').value = 'draft';
  syncPublishedAt();
  setEditorStatus('');
  await loadCategoryOptions();
  if (id) {
    try {
      const data = await api(`/api/admin/news/${id}`);
      const n = data.news;
      $('f-id').value = n.id;
      $('f-title').value = n.title || '';
      $('f-slug').value = n.slug || '';
      $('f-category').value = n.category_id ? String(n.category_id) : '';
      $('f-excerpt').value = n.excerpt || '';
      $('f-content').value = n.content || '';
      $('f-cover-url').value = n.cover_image_url || '';
      if (n.cover_image_url) { const p = $('cover-preview'); p.src = n.cover_image_url; p.classList.remove('hidden'); }
      try { state.extraImages = JSON.parse(n.extra_images || '[]'); } catch { state.extraImages = []; }
      renderExtraImages();
      $('f-author').value = n.author || '';
      $('f-source-name').value = n.source_name || '';
      $('f-source-url').value = n.source_url || '';
      $('f-seo-title').value = n.seo_title || '';
      $('f-seo-desc').value = n.seo_description || '';
      $('f-featured').checked = !!n.featured;
      $('f-status').value = n.status || 'draft';
      syncPublishedAt();
      if (n.published_at) {
        const d = new Date(n.published_at.replace(' ', 'T') + 'Z');
        $('f-published-at').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
      setEditorStatus(`বর্তমান অবস্থা: ${n.status}${n.status === 'published' ? ' · লিংক: ' + location.origin + '/news/' + n.slug : ''}`);
      if (n.status === 'published' || n.status === 'scheduled') $('btn-unpublish').classList.remove('hidden');
    } catch (err) { toast(err.message); }
  }
  state.editorDirty = false;
  paintAuthorInfo();
  switchTab('editor');
}

$('btn-cancel-edit').addEventListener('click', () => switchTab('news'));

async function saveNews() {
  const saveBtn = $('btn-save');
  const saveLabel = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'সংরক্ষণ হচ্ছে…';
  const id = $('f-id').value;
  const status = $('f-status').value;
  const pubInput = $('f-published-at').value;
  // The datetime-local value is Dhaka-local; toISOString() converts to UTC —
  // the server stores the UTC equivalent in sqlTime format.
  const body = {
    title: $('f-title').value,
    slug: $('f-slug').value,
    category_id: $('f-category').value || '',
    excerpt: $('f-excerpt').value,
    content: $('f-content').value,
    cover_image_url: $('f-cover-url').value,
    extra_images: state.extraImages,
    author: $('f-author').value,
    source_name: $('f-source-name').value,
    source_url: $('f-source-url').value,
    seo_title: $('f-seo-title').value,
    seo_description: $('f-seo-desc').value,
    featured: $('f-featured').checked,
    status,
    published_at: status !== 'draft' && pubInput ? new Date(pubInput).toISOString() : '',
  };
  try {
    const data = id
      ? await api(`/api/admin/news/${id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/api/admin/news', { method: 'POST', body: JSON.stringify(body) });
    if (status === 'published') {
      toast('প্রকাশ হয়েছে!');
      showMsg($('editor-msg'), `লাইভ লিংক: ${location.origin}/news/${data.slug} — Facebook কমেন্টে এই লিংকটি শেয়ার করুন।`, true);
    } else if (status === 'scheduled') {
      toast('Schedule করা হয়েছে');
      showMsg($('editor-msg'), `নির্ধারিত সময়ে (${bnDate(body.published_at ? new Date(body.published_at).toISOString().replace('T', ' ').slice(0, 19) : '')}) খবরটি নিজে নিজে প্রকাশ হয়ে যাবে।`, true);
    } else {
      toast('Draft সংরক্ষণ হয়েছে');
      showMsg($('editor-msg'), 'Draft হিসেবে রাখা হয়েছে — পাঠক এখনো দেখতে পাবেন না।', true);
    }
    if (!id && data.id) { $('f-id').value = data.id; state.editingId = data.id; }
    state.editorDirty = false;
    setEditorStatus(`বর্তমান অবস্থা: ${status}`);
    if (status === 'published' || status === 'scheduled') $('btn-unpublish').classList.remove('hidden');
    else $('btn-unpublish').classList.add('hidden');
  } catch (err) {
    showMsg($('editor-msg'), err.message, false);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = saveLabel;
  }
}

$('btn-save').addEventListener('click', () => saveNews());
$('btn-unpublish').addEventListener('click', () => {
  $('f-status').value = 'draft';
  syncPublishedAt();
  saveNews();
});

/* ---------------- Analytics tab ---------------- */
let analyticsRange = '7d';

document.querySelectorAll('#analytics-ranges button').forEach((btn) => {
  btn.addEventListener('click', () => { analyticsRange = btn.dataset.range; loadAnalytics(); });
});

/** Animate a KPI number counting up to its real value. */
function countUp(el, to) {
  const target = Number(to) || 0;
  const duration = 700;
  const t0 = performance.now();
  function frame(t) {
    const p = Math.min(1, (t - t0) / duration);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function chartLabelText(label, unit) {
  if (unit === 'hour') return `${label.slice(11)}:00`;
  const d = new Date(`${label}T00:00:00Z`);
  try {
    return new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
  } catch { return label; }
}

async function loadAnalytics() {
  document.querySelectorAll('#analytics-ranges button').forEach((b) =>
    b.classList.toggle('active', b.dataset.range === analyticsRange));
  try {
    const data = await api(`/api/admin/analytics?range=${encodeURIComponent(analyticsRange)}`);
    countUp($('an-views'), data.totals.views_in_range);
    countUp($('an-alltime'), data.totals.total_views_all_time);
    countUp($('an-posts'), data.totals.posts_in_range);
    countUp($('an-total-posts'), data.totals.total_posts);
    // Honest empty state: view logging only started today, so a range with no
    // tracked views yet says so instead of dressing up invented numbers.
    $('analytics-empty').classList.toggle('hidden', data.totals.views_in_range > 0);

    const chart = $('analytics-chart');
    chart.classList.toggle('wide', data.series.length > 31);
    const max = Math.max(1, ...data.series.map((p) => p.views));
    const showVals = data.series.length <= 31;
    chart.innerHTML = data.series.map((p) => `
      <div class="chart-col" title="${esc(chartLabelText(p.label, data.unit))}: ${p.views} ভিউ">
        ${showVals ? `<span class="chart-val">${p.views || ''}</span>` : ''}
        <div class="chart-bar" data-h="${Math.max(2, Math.round((p.views / max) * 92))}"></div>
        <span class="chart-label">${esc(chartLabelText(p.label, data.unit))}</span>
      </div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      chart.querySelectorAll('.chart-bar').forEach((b) => { b.style.height = `${b.dataset.h}%`; });
    }));

    $('analytics-top').innerHTML = data.top_posts_in_range.length
      ? data.top_posts_in_range.map((p, i) => `<div class="analytics-row"><span class="analytics-rank">${i + 1}</span><a href="/news/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">${esc(p.title)}</a><strong>${p.views} ভিউ</strong></div>`).join('')
      : '<p class="muted">এই সময়ে এখনো কোনো ভিউ আসেনি।</p>';

    const cmax = Math.max(1, ...data.by_category_in_range.map((c) => c.views));
    $('analytics-cats').innerHTML = data.by_category_in_range.length
      ? data.by_category_in_range.map((c) => `
        <div class="catbar-row">
          <span class="catbar-name">${esc(c.category_name)}</span>
          <span class="catbar-track"><span class="catbar-fill" data-w="${Math.round((c.views / cmax) * 100)}"></span></span>
          <strong>${c.views}</strong>
        </div>`).join('')
      : '<p class="muted">এই সময়ে কোনো ক্যাটাগরিতে ভিউ আসেনি।</p>';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $('analytics-cats').querySelectorAll('.catbar-fill').forEach((b) => { b.style.width = `${b.dataset.w}%`; });
    }));
  } catch (err) { toast(err.message); }
}

/* ---------------- Settings tab: profile ---------------- */
// null = unchanged; '' = clear; anything else = the value to save.
const profileState = { avatar: null };

function fillProfile() {
  const u = state.user;
  if (!u) return;
  $('prof-name').value = u.name || '';
  profileState.avatar = null;
  const av = u.avatar_url || '';
  $('prof-avatar-url').value = av.startsWith('data:') ? '' : av;
  $('prof-avatar-preview').src = av || '/assets/img/logo-cream.jpg';
}

/** Read a photo file, center-crop it square at ≤256px, return a JPEG data URL. */
function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('bad image'));
      img.onload = () => {
        try {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - side) / 2;
          const sy = (img.naturalHeight - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (err) { reject(err); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$('prof-avatar-file').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const dataUrl = await fileToAvatarDataUrl(file);
    profileState.avatar = dataUrl;
    $('prof-avatar-preview').src = dataUrl;
    $('prof-avatar-url').value = '';
    toast('ছবি তৈরি হয়েছে — এখন "প্রোফাইল সংরক্ষণ করুন" চাপুন');
  } catch { toast('ছবিটি পড়া যায়নি — অন্য একটি ছবি চেষ্টা করুন'); }
});

$('prof-avatar-url').addEventListener('input', () => {
  const v = $('prof-avatar-url').value.trim();
  profileState.avatar = v;
  $('prof-avatar-preview').src = v || '/assets/img/logo-cream.jpg';
});

$('prof-save').addEventListener('click', async () => {
  const msg = $('prof-msg');
  const name = $('prof-name').value.trim();
  if (!name) { showMsg(msg, 'নাম দিতে হবে', false); return; }
  const avatar = profileState.avatar !== null ? profileState.avatar : (state.user?.avatar_url || '');
  try {
    const data = await api('/api/admin/me', {
      method: 'PUT',
      body: JSON.stringify({ name, avatar_url: avatar }),
    });
    state.user = data.user;
    $('who-line').textContent = `${data.user.name} · ${data.user.role} · `;
    fillProfile();
    paintAuthorInfo();
    showMsg(msg, 'প্রোফাইল সেভ হয়েছে। এই ছবিই এখন থেকে আপনার সব খবরে নিজে নিজে দেখা যাবে।', true);
  } catch (err) { showMsg(msg, err.message, false); }
});

/* ---------------- Settings tab: site settings + categories ---------------- */
function loadSettingsTab() {
  fillProfile();
  loadCategoriesAdmin();
  loadSiteSettings();
}

async function loadSiteSettings() {
  try {
    const s = await api('/api/admin/settings');
    $('set-contact-email').value = s.contact_email || '';
    $('set-contact-phone').value = s.contact_phone || '';
    $('set-footer-text').value = s.footer_text || '';
    $('set-about-text').value = s.about_text || '';
    $('set-contact-text').value = s.contact_text || '';
  } catch {
    const note = 'এই অংশটি শুধু owner/admin দেখতে ও বদলাতে পারেন।';
    showMsg($('contact-msg'), note, false);
    showMsg($('texts-msg'), note, false);
  }
}

$('contact-save').addEventListener('click', async () => {
  try {
    await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        contact_email: $('set-contact-email').value,
        contact_phone: $('set-contact-phone').value,
      }),
    });
    showMsg($('contact-msg'), 'সেভ হয়েছে', true);
  } catch (err) { showMsg($('contact-msg'), err.message, false); }
});

$('texts-save').addEventListener('click', async () => {
  try {
    await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        footer_text: $('set-footer-text').value,
        about_text: $('set-about-text').value,
        contact_text: $('set-contact-text').value,
      }),
    });
    showMsg($('texts-msg'), 'সেভ হয়েছে — সাইটে এখন থেকে এই লেখাই দেখাবে।', true);
  } catch (err) { showMsg($('texts-msg'), err.message, false); }
});

async function loadCategoriesAdmin() {
  const wrap = $('cat-list');
  try {
    const data = await api('/api/admin/categories');
    if (!data.categories.length) {
      wrap.innerHTML = '<p class="muted">কোনো ক্যাটাগরি নেই।</p>';
      return;
    }
    wrap.innerHTML = data.categories.map((c) => `
      <div class="cat-row">
        <div>
          <input type="text" value="${esc(c.name)}" data-f="name" maxlength="100" aria-label="ক্যাটাগরির নাম">
          <span class="cat-slug">/${esc(c.slug)} · ${c.news_count}টি খবর</span>
        </div>
        <input type="text" value="${esc(c.description || '')}" data-f="description" maxlength="300" placeholder="বিবরণ" aria-label="বিবরণ">
        <input type="number" value="${c.sort_order ?? 0}" data-f="sort_order" aria-label="ক্রম">
        <button class="btn ghost small" type="button" data-save="${c.id}">সেভ</button>
      </div>`).join('');
    wrap.querySelectorAll('[data-save]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const row = btn.closest('.cat-row');
        const body = {
          name: row.querySelector('[data-f="name"]').value,
          description: row.querySelector('[data-f="description"]').value,
          sort_order: parseInt(row.querySelector('[data-f="sort_order"]').value, 10) || 0,
        };
        try {
          await api(`/api/admin/categories/${btn.dataset.save}`, { method: 'PUT', body: JSON.stringify(body) });
          toast('ক্যাটাগরি সেভ হয়েছে');
          loadCategoriesAdmin();
          loadCategoryOptions();
        } catch (err) { toast(err.message); }
      })
    );
  } catch (err) {
    wrap.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  }
}

$('cat-new-name').addEventListener('input', () => {
  $('cat-new-slug').value = jsSlug($('cat-new-name').value);
});

$('cat-add').addEventListener('click', async () => {
  const body = {
    name: $('cat-new-name').value,
    slug: $('cat-new-slug').value,
    description: $('cat-new-desc').value,
    sort_order: parseInt($('cat-new-sort').value, 10) || 0,
  };
  try {
    await api('/api/admin/categories', { method: 'POST', body: JSON.stringify(body) });
    $('cat-new-name').value = '';
    $('cat-new-slug').value = '';
    $('cat-new-desc').value = '';
    $('cat-new-sort').value = '0';
    showMsg($('cat-msg'), 'নতুন ক্যাটাগরি যোগ হয়েছে', true);
    loadCategoriesAdmin();
    loadCategoryOptions();
  } catch (err) { showMsg($('cat-msg'), err.message, false); }
});

/* ---------------- Theme toggle (same key as the public site) ---------------- */
(function initThemeToggle() {
  const btn = $('theme-toggle');
  if (!btn) return;
  const paint = () => { btn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'; };
  paint();
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('wc-theme', next); } catch { /* private mode */ }
    paint();
  });
})();

document.addEventListener('DOMContentLoaded', boot);
