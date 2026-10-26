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

const state = { user: null, newsPage: 1, extraImages: [], slugManual: false, editingId: null };

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
  if (user.role === 'editor') $('tab-categories').style.display = 'none';
  if (user.role !== 'owner') $('tab-users').style.display = 'none';
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
  ['dashboard', 'news', 'editor', 'categories', 'users'].forEach((t) => {
    $('tab-' + t).classList.toggle('hidden', t !== name);
  });
  if (name === 'dashboard') loadDashboard();
  if (name === 'news') { state.newsPage = 1; loadNewsList(true); }
  if (name === 'categories') loadCategories();
  if (name === 'users') loadUsers();
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
      ? data.latest.map((n) => `<p style="margin:0.35rem 0"><span class="badge ${n.status}">${n.status}</span> <a href="#" data-edit="${n.id}">${esc(n.title)}</a> <span class="muted">${esc(bnDate(n.updated_at))}</span></p>`).join('')
      : '<p class="muted">এখনো কোনো খবর নেই।</p>';
    $('latest-list').querySelectorAll('[data-edit]').forEach((a) =>
      a.addEventListener('click', (ev) => { ev.preventDefault(); openEditor(a.dataset.edit); })
    );
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
        <td><strong>${esc(n.title)}</strong><br><span class="muted">/news/${esc(n.slug)}</span></td>
        <td>${esc(n.category_name || '—')}</td>
        <td><span class="badge ${n.status}">${n.status}</span>${n.featured ? ' ⭐' : ''}</td>
        <td>${esc(bnDate(n.updated_at))}</td>
        <td><div class="row-actions">
          <button class="btn ghost small" data-act="edit" data-id="${n.id}">Edit</button>
          ${n.status === 'published' ? `<button class="btn ghost small" data-act="copy" data-slug="${esc(n.slug)}">লিংক কপি</button>
          <a class="btn ghost small" href="/news/${encodeURIComponent(n.slug)}" target="_blank">দেখুন</a>` : ''}
          <button class="btn danger small" data-act="del" data-id="${n.id}" data-title="${esc(n.title)}">Delete</button>
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

async function uploadFile(file, alt = '') {
  const form = new FormData();
  form.append('file', file);
  form.append('alt', alt);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

$('f-cover-file').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    toast('ছবি আপলোড হচ্ছে…');
    const data = await uploadFile(file);
    $('f-cover-url').value = data.url;
    const prev = $('cover-preview');
    prev.src = data.url; prev.classList.remove('hidden');
    toast('কভার ছবি আপলোড হয়েছে');
  } catch (err) { toast(err.message); }
  ev.target.value = '';
});

$('f-extra-file').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    toast('ছবি আপলোড হচ্ছে…');
    const data = await uploadFile(file);
    state.extraImages.push({ url: data.url, alt: '' });
    renderExtraImages();
  } catch (err) { toast(err.message); }
  ev.target.value = '';
});

function jsSlug(text) {
  return String(text || '').trim().toLowerCase().replace(/[''ʼ]/g, '').replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}
$('f-title').addEventListener('input', () => {
  if (!state.slugManual) $('f-slug').value = jsSlug($('f-title').value);
});
$('f-slug').addEventListener('input', () => { state.slugManual = true; });

async function openEditor(id) {
  state.editingId = id;
  state.slugManual = !!id;
  state.extraImages = [];
  renderExtraImages();
  $('editor-form').reset();
  $('cover-preview').classList.add('hidden');
  $('editor-msg').classList.add('hidden');
  $('editor-heading').textContent = id ? 'খবর সম্পাদনা' : 'নতুন খবর';
  $('btn-unpublish').classList.add('hidden');
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
      if (n.published_at) {
        const d = new Date(n.published_at.replace(' ', 'T') + 'Z');
        $('f-published-at').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
      setEditorStatus(`বর্তমান অবস্থা: ${n.status}${n.status === 'published' ? ' · লিংক: ' + location.origin + '/news/' + n.slug : ''}`);
      if (n.status === 'published') $('btn-unpublish').classList.remove('hidden');
    } catch (err) { toast(err.message); }
  }
  switchTab('editor');
}

$('btn-cancel-edit').addEventListener('click', () => switchTab('news'));

async function saveNews(status) {
  const id = $('f-id').value;
  const pubInput = $('f-published-at').value;
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
    published_at: status === 'published' && pubInput ? new Date(pubInput).toISOString() : '',
  };
  try {
    const data = id
      ? await api(`/api/admin/news/${id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/api/admin/news', { method: 'POST', body: JSON.stringify(body) });
    if (status === 'published') {
      toast('প্রকাশ হয়েছে!');
      showMsg($('editor-msg'), `লাইভ লিংক: ${location.origin}/news/${data.slug} — Facebook কমেন্টে এই লিংকটি শেয়ার করুন।`, true);
    } else {
      toast('Draft সংরক্ষণ হয়েছে');
      showMsg($('editor-msg'), 'Draft হিসেবে রাখা হয়েছে — পাঠক এখনো দেখতে পাবেন না।', true);
    }
    if (!id && data.id) { $('f-id').value = data.id; state.editingId = data.id; }
    setEditorStatus(`বর্তমান অবস্থা: ${status}`);
    if (status === 'published') $('btn-unpublish').classList.remove('hidden');
  } catch (err) {
    showMsg($('editor-msg'), err.message, false);
  }
}

$('btn-publish').addEventListener('click', () => saveNews('published'));
$('btn-draft').addEventListener('click', () => saveNews('draft'));
$('btn-unpublish').addEventListener('click', () => saveNews('draft'));

/* ---------------- Categories ---------------- */
async function loadCategories() {
  try {
    const data = await api('/api/admin/categories');
    $('categories-tbody').innerHTML = data.categories.map((c) => `
      <tr>
        <td><strong>${esc(c.name)}</strong>${c.description ? `<br><span class="muted">${esc(c.description)}</span>` : ''}</td>
        <td>${esc(c.slug)}</td>
        <td>${c.news_count}</td>
        <td><div class="row-actions">
          <button class="btn ghost small" data-cedit="${c.id}" data-name="${esc(c.name)}" data-desc="${esc(c.description || '')}">Edit</button>
          <button class="btn danger small" data-cdel="${c.id}" data-name="${esc(c.name)}" data-count="${c.news_count}">Delete</button>
        </div></td>
      </tr>`).join('') || '<tr><td colspan="4" class="muted">কোনো ক্যাটাগরি নেই।</td></tr>';
    $('categories-tbody').querySelectorAll('[data-cedit]').forEach((btn) => {
      btn.onclick = async () => {
        const name = prompt('ক্যাটাগরির নাম:', btn.dataset.name);
        if (name === null) return;
        const description = prompt('বিবরণ:', btn.dataset.desc);
        if (description === null) return;
        try {
          await api(`/api/admin/categories/${btn.dataset.cedit}`, { method: 'PUT', body: JSON.stringify({ name, description }) });
          toast('হালনাগাদ হয়েছে');
          loadCategories(); loadCategoryOptions();
        } catch (err) { toast(err.message); }
      };
    });
    $('categories-tbody').querySelectorAll('[data-cdel]').forEach((btn) => {
      btn.onclick = async () => {
        const warn = Number(btn.dataset.count) > 0 ? `\nসতর্কতা: এই ক্যাটাগরিতে ${btn.dataset.count}টি খবর আছে — সেগুলো "ক্যাটাগরি ছাড়া" হয়ে যাবে (মুছে যাবে না)।` : '';
        if (!confirm(`"${btn.dataset.name}" ক্যাটাগরি মুছে ফেলতে চান?${warn}`)) return;
        try {
          await api(`/api/admin/categories/${btn.dataset.cdel}`, { method: 'DELETE' });
          toast('মুছে ফেলা হয়েছে');
          loadCategories(); loadCategoryOptions();
        } catch (err) { toast(err.message); }
      };
    });
  } catch (err) { toast(err.message); }
}

$('category-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    await api('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: $('c-name').value, slug: $('c-slug').value, description: $('c-desc').value }),
    });
    ev.target.reset();
    toast('ক্যাটাগরি যোগ হয়েছে');
    loadCategories(); loadCategoryOptions();
  } catch (err) { showMsg($('category-msg'), err.message, false); }
});

/* ---------------- Users (owner) ---------------- */
async function loadUsers() {
  try {
    const data = await api('/api/admin/users');
    $('users-tbody').innerHTML = data.users.map((u) => `
      <tr>
        <td><strong>${esc(u.name)}</strong></td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.role)}</td>
        <td>${u.is_active ? 'সক্রিয়' : 'বন্ধ'}</td>
        <td><div class="row-actions">
          <button class="btn ghost small" data-urole="${u.id}" data-role="${esc(u.role)}">Role বদলান</button>
          <button class="btn ghost small" data-utoggle="${u.id}" data-active="${u.is_active}">${u.is_active ? 'বন্ধ করুন' : 'চালু করুন'}</button>
          <button class="btn ghost small" data-upass="${u.id}">নতুন পাসওয়ার্ড</button>
          <button class="btn danger small" data-udel="${u.id}" data-name="${esc(u.name)}">Delete</button>
        </div></td>
      </tr>`).join('');
    const bind = (attr, fn) => $('users-tbody').querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => fn(b)));
    bind('data-urole', async (b) => {
      const role = prompt('নতুন role লিখুন (owner / admin / editor):', b.dataset.role);
      if (!role) return;
      try { await api(`/api/admin/users/${b.dataset.urole}`, { method: 'PUT', body: JSON.stringify({ role: role.trim() }) }); toast('Role বদল হয়েছে'); loadUsers(); }
      catch (err) { toast(err.message); }
    });
    bind('data-utoggle', async (b) => {
      try { await api(`/api/admin/users/${b.dataset.utoggle}`, { method: 'PUT', body: JSON.stringify({ is_active: b.dataset.active !== '1' }) }); loadUsers(); }
      catch (err) { toast(err.message); }
    });
    bind('data-upass', async (b) => {
      const password = prompt('নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর):');
      if (!password) return;
      try { await api(`/api/admin/users/${b.dataset.upass}`, { method: 'PUT', body: JSON.stringify({ password }) }); toast('পাসওয়ার্ড বদল হয়েছে'); }
      catch (err) { toast(err.message); }
    });
    bind('data-udel', async (b) => {
      if (!confirm(`"${b.dataset.name}" এর অ্যাকাউন্ট মুছে ফেলতে চান?`)) return;
      try { await api(`/api/admin/users/${b.dataset.udel}`, { method: 'DELETE' }); toast('মুছে ফেলা হয়েছে'); loadUsers(); }
      catch (err) { toast(err.message); }
    });
  } catch (err) { toast(err.message); }
}

$('user-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    await api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        name: $('u-name').value, email: $('u-email').value,
        password: $('u-password').value, role: $('u-role').value,
      }),
    });
    ev.target.reset();
    toast('অ্যাকাউন্ট তৈরি হয়েছে');
    loadUsers();
  } catch (err) { showMsg($('user-msg'), err.message, false); }
});

document.addEventListener('DOMContentLoaded', boot);
