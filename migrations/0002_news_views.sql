-- The Wildcut — migration 0002: per-view event log for the admin Analytics tab.
-- The news.views counter stays the all-time total; news_views gives real
-- time-range data (last 24 hours / 7 / 28 / 60 / 90 days) from this day on.
-- Run once against the live D1 database (safe to re-run).

CREATE TABLE IF NOT EXISTS news_views (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  news_id   INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_views_at      ON news_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_news_views_news_at ON news_views(news_id, viewed_at);
