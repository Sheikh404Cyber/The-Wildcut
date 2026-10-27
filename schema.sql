-- The Wildcut — D1 database schema
-- Run once when setting up (see DEPLOYMENT_GUIDE_BN.md).
-- Safe to re-run: tables use IF NOT EXISTS, seed uses INSERT OR IGNORE.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','admin','editor')),
  avatar_url    TEXT NOT NULL DEFAULT '',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS news (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  excerpt          TEXT DEFAULT '',
  content          TEXT NOT NULL DEFAULT '',
  cover_image_url  TEXT DEFAULT '',
  extra_images     TEXT NOT NULL DEFAULT '[]',   -- JSON: [{"url":"...","alt":"..."}]
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  author           TEXT DEFAULT '',
  source_name      TEXT DEFAULT '',
  source_url       TEXT DEFAULT '',
  seo_title        TEXT DEFAULT '',
  seo_description  TEXT DEFAULT '',
  featured         INTEGER NOT NULL DEFAULT 0,
  views            INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled')),
  created_by       INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  published_at     TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ip           TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS media (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key      TEXT NOT NULL UNIQUE,
  url         TEXT NOT NULL,
  alt         TEXT DEFAULT '',
  size_bytes  INTEGER DEFAULT 0,
  created_by  INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_slug        ON news(slug);
CREATE INDEX IF NOT EXISTS idx_news_status_pub  ON news(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category    ON news(category_id);
CREATE INDEX IF NOT EXISTS idx_news_featured    ON news(featured, status);
CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_attempts_ip_time ON login_attempts(ip, attempted_at);

-- Starting categories (from the project brief). Slugs are stable URLs — do not rename later.
INSERT OR IGNORE INTO categories (name, slug, description, sort_order) VALUES
  ('বাংলাদেশ',              'bangladesh',               'বাংলাদেশের বন্যপ্রাণী সংবাদ',        1),
  ('আন্তর্জাতিক',           'international',            'বিশ্বের বন্যপ্রাণী সংবাদ',           2),
  ('আইন ও নীতিমালা',         'law-policy',               'বন্যপ্রাণী আইন ও নীতিমালা বিষয়ক সংবাদ', 3),
  ('প্রকৃতি ও পরিবেশ',       'conservation-environment', 'প্রকৃতি, সংরক্ষণ ও পরিবেশ',          4),
  ('বিজ্ঞান ও গবেষণা',       'science-nature',           'বিজ্ঞান ও গবেষণা বিষয়ক সংবাদ',       5);
