import { json, fail } from '../../lib/http.js';
import { requireRole } from '../../lib/auth.js';
import { sqlTime } from '../../lib/util.js';

// Time ranges for the Analytics tab. Buckets are UTC (viewed_at is stored in
// UTC): '24h' = the last 24 hour-buckets, the rest = that many calendar days
// including today. The cutoff is computed here and bound as a plain timestamp
// so every query below measures exactly the same window as the series labels.
const RANGE_DEFS = {
  '24h': { unit: 'hour', buckets: 24 },
  '7d': { unit: 'day', buckets: 7 },
  '28d': { unit: 'day', buckets: 28 },
  '60d': { unit: 'day', buckets: 60 },
  '90d': { unit: 'day', buckets: 90 },
};

/** Bucket start times (oldest → newest) + the range cutoff, all UTC. */
function rangeWindow(def) {
  const start = new Date();
  if (def.unit === 'hour') {
    start.setUTCMinutes(0, 0, 0);
    start.setUTCHours(start.getUTCHours() - (def.buckets - 1));
  } else {
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (def.buckets - 1));
  }
  const labels = [];
  for (let i = 0; i < def.buckets; i++) {
    const d = new Date(start.getTime() + i * (def.unit === 'hour' ? 3600000 : 86400000));
    labels.push(def.unit === 'hour' ? sqlTime(d).slice(0, 13) : sqlTime(d).slice(0, 10));
  }
  return { cutoff: sqlTime(start), labels };
}

// GET /api/admin/analytics?range=24h|7d|28d|60d|90d (default 7d)
// Everything range-based comes from the news_views event log (which only
// exists from the day view logging was switched on — numbers are never
// invented for earlier days); all-time totals come from the news.views
// counter, which has been counting since launch.
export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireRole(request, env, ['owner', 'admin', 'editor']);
    if (auth.response) return auth.response;

    const rangeParam = new URL(request.url).searchParams.get('range') || '7d';
    const range = RANGE_DEFS[rangeParam] ? rangeParam : '7d';
    const def = RANGE_DEFS[range];
    const { cutoff, labels } = rangeWindow(def);
    const DB = env.DB;

    const viewsRow = await DB.prepare(
      'SELECT COUNT(*) AS views_in_range FROM news_views WHERE viewed_at >= ?'
    ).bind(cutoff).first();
    const postsRow = await DB.prepare(
      'SELECT COUNT(DISTINCT news_id) AS posts_in_range FROM news_views WHERE viewed_at >= ?'
    ).bind(cutoff).first();
    const allTimeRow = await DB.prepare(
      'SELECT COALESCE(SUM(views), 0) AS total_views_all_time, COUNT(*) AS total_posts FROM news'
    ).first();

    const seriesSql = def.unit === 'hour'
      ? `SELECT strftime('%Y-%m-%d %H', viewed_at) AS bucket, COUNT(*) AS views
           FROM news_views WHERE viewed_at >= ? GROUP BY bucket ORDER BY bucket`
      : `SELECT date(viewed_at) AS bucket, COUNT(*) AS views
           FROM news_views WHERE viewed_at >= ? GROUP BY bucket ORDER BY bucket`;
    const { results: seriesRows } = await DB.prepare(seriesSql).bind(cutoff).all();
    const byBucket = new Map(seriesRows.map((r) => [r.bucket, r.views]));
    const series = labels.map((label) => ({ label, views: byBucket.get(label) || 0 }));

    const { results: topPosts } = await DB.prepare(
      `SELECT n.title AS title, n.slug AS slug, COUNT(*) AS views
         FROM news_views v JOIN news n ON n.id = v.news_id
        WHERE v.viewed_at >= ?
        GROUP BY v.news_id ORDER BY views DESC, n.id DESC LIMIT 8`
    ).bind(cutoff).all();

    const { results: byCategory } = await DB.prepare(
      `SELECT COALESCE(c.name, 'ক্যাটাগরি ছাড়া') AS category_name, COUNT(*) AS views
         FROM news_views v
         JOIN news n ON n.id = v.news_id
         LEFT JOIN categories c ON c.id = n.category_id
        WHERE v.viewed_at >= ?
        GROUP BY n.category_id ORDER BY views DESC`
    ).bind(cutoff).all();

    return json({
      ok: true,
      range,
      unit: def.unit,
      totals: {
        views_in_range: viewsRow?.views_in_range ?? 0,
        total_views_all_time: allTimeRow?.total_views_all_time ?? 0,
        posts_in_range: postsRow?.posts_in_range ?? 0,
        total_posts: allTimeRow?.total_posts ?? 0,
      },
      series,
      top_posts_in_range: topPosts,
      by_category_in_range: byCategory,
    });
  } catch {
    return fail(500, 'Server error');
  }
}
