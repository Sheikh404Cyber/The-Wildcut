# The Wildcut — Architecture & File Structure

## System overview

```
Reader ──► Cloudflare Pages (static frontend, public/)
              │
              ├─► Pages Functions (functions/) ──► D1 database (news, categories, users, sessions)
              │                                  └─► R2 bucket (uploaded images, served via /media/*)
Admin  ──► /admin (static panel) ──► /api/admin/* (session-cookie protected)
Facebook ─► /news/<slug> is SERVER-RENDERED by a Function so the FB crawler
            gets real Open Graph title/description/image without running JS.
```

- **No build step.** Plain HTML/CSS/JS + Pages Functions. Upload the folder to
  GitHub, connect to Cloudflare Pages, done. Framework preset: *None*.
- **Why server-rendered news pages:** Facebook's link crawler does not run
  JavaScript. If the article page were a JS shell, FB previews would be empty.
  `functions/news/[slug].js` returns complete HTML with OG tags + JSON-LD.
- **Public API only ever returns `status='published'` rows.** Drafts are
  invisible to readers and to search engines.

## Stack (all free tier)

| Piece | Service | Binding / name |
|---|---|---|
| Hosting + frontend | Cloudflare Pages | project `thewildcut` |
| Backend / API | Pages Functions | `functions/` |
| Database | Cloudflare D1 (SQLite) | binding `DB`, db `wildcut-db` |
| Image storage | Cloudflare R2 | binding `MEDIA`, bucket `wildcut-media` |
| Code | GitHub repo | upload via web UI |
| URL | `https://thewildcut.pages.dev` (Pages default) | HTTPS free |

## File structure

```
thewildcut/
├── ARCHITECTURE.md            ← this file
├── README.md                  ← project overview + quick start
├── DEPLOYMENT_GUIDE_BN.md     ← step-by-step Bangla deploy guide
├── TESTING_CHECKLIST.md       ← what was tested locally / what to test live
├── wrangler.toml              ← Pages + D1 + R2 bindings
├── package.json               ← local dev scripts only (no dependencies needed to deploy)
├── .gitignore
├── schema.sql                 ← full D1 schema (also in migrations/)
├── migrations/
│   └── 0001_init.sql          ← same schema, for `wrangler d1 migrations`
├── seed-demo.sql              ← OPTIONAL sample news for first test (delete after)
├── scripts/
│   └── create-admin.mjs       ← alternative first-admin method (prints SQL)
├── public/                    ← everything here is served as static files
│   ├── index.html             ← homepage (featured + latest + categories)
│   ├── category.html          ← category listing (reads ?slug=)
│   ├── about.html
│   ├── contact.html
│   ├── privacy.html
│   ├── 404.html
│   ├── robots.txt
│   ├── admin/
│   │   └── index.html         ← admin panel (login + dashboard + editor + users)
│   └── assets/
│       ├── css/style.css      ← public site design (brand palette)
│       ├── css/admin.css      ← admin panel design
│       ├── js/app.js          ← homepage + category logic
│       ├── js/admin.js        ← admin panel logic
│       └── img/               ← logos (dark on white / white on green / cream)
└── functions/                 ← server code (never visible to visitors)
    ├── lib/
    │   ├── auth.js            ← PBKDF2 password hash, sessions, rate limit, guards
    │   ├── http.js            ← JSON responses, cookies, security headers
    │   ├── util.js            ← slugify, HTML escaping, Bangla dates, validation
    │   └── render.js          ← server-rendered article page (OG + JSON-LD)
    ├── news/[slug].js         ← GET /news/<slug>  → full HTML article
    ├── sitemap.xml.js         ← GET /sitemap.xml  → dynamic sitemap
    ├── media/[[key]].js       ← GET /media/<key>  → image from R2
    └── api/
        ├── public/
        │   ├── news.js        ← GET /api/public/news (list, paginate, filter)
        │   ├── news/[slug].js ← GET /api/public/news/<slug> (JSON, published only)
        │   └── categories.js  ← GET /api/public/categories
        └── admin/
            ├── setup.js       ← POST first-owner creation (only while 0 users; needs SETUP_TOKEN)
            ├── login.js       ← POST login (rate-limited)
            ├── logout.js      ← POST logout
            ├── me.js          ← GET current admin + role
            ├── stats.js       ← GET dashboard counts
            ├── news.js        ← GET list (all statuses) / POST create
            ├── news/[id].js   ← GET one / PUT update / DELETE
            ├── categories.js  ← GET / POST
            ├── categories/[id].js ← PUT / DELETE
            ├── users.js       ← GET / POST            (owner only)
            ├── users/[id].js  ← PUT role/password / DELETE (owner only)
            └── upload.js      ← POST image → R2 (type/size validated)
```

## Database tables (D1)

- `categories` — id, name, slug (unique), description, sort_order, timestamps
- `news` — id, title, slug (unique), excerpt, content, cover_image_url,
  extra_images (JSON), category_id (FK), author, source_name, source_url,
  seo_title, seo_description, featured (0/1), status ('draft'|'published'),
  created_at, updated_at, published_at
- `admin_users` — id, name, email (unique), password_hash, password_salt,
  role ('owner'|'admin'|'editor'), is_active, timestamps
- `sessions` — id, user_id (FK), token_hash (unique), expires_at, created_at
- `login_attempts` — id, ip, attempted_at (for brute-force rate limiting)
- `media` — id, r2_key, url, alt, size_bytes, created_by, created_at

All queries use prepared statements with bound parameters. Indexes on
`news(slug)`, `news(status, published_at)`, `news(category_id)`, `sessions(token_hash)`.

## Security model

- Passwords: PBKDF2-HMAC-SHA256, 100,000 iterations, random 16-byte salt per
  user. Plain passwords are never stored or logged.
- Sessions: random 256-bit token; only its SHA-256 hash is stored. Cookie is
  `HttpOnly; Secure; SameSite=Lax`, 7-day expiry. Logout deletes the session.
- Login rate limit: max 5 failed attempts per IP per 15 minutes (D1 table).
- Mutating admin requests must come from the same origin (Origin check) and
  carry the session cookie — CSRF protection on top of SameSite.
- Roles: **owner** = everything incl. user management; **admin** = news +
  categories; **editor** = news only.
- First admin: created only while the users table is empty, and only with the
  `SETUP_TOKEN` secret set in Cloudflare. No default password exists anywhere.
- Public errors are generic; no stack traces or SQL details leak.

## Brand system

- Primary `#2A661C`, secondary `#FFFFFF`, accents `#7CAF31`, charcoal
  `#2D2D2D`, light grey `#D1D1D1`.
- Fonts: Hind Siliguri (Bangla) + Archivo/Inter (Latin), loaded from Google Fonts.
- Dates rendered in Bangla via `Intl.DateTimeFormat('bn-BD')`.
- Motion: purposeful only — hero fade, card reveal on scroll, hover lift;
  `prefers-reduced-motion` respected. Cinematic hero with deep-green gradient.
