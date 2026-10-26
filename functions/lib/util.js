// Shared utilities — pure functions, no I/O. Safe in Workers and in Node (for tests).

/** SQL-friendly UTC timestamp: 'YYYY-MM-DD HH:MM:SS' (matches SQLite datetime('now')). */
export function sqlTime(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export function sqlTimePlus(ms) {
  return sqlTime(new Date(Date.now() + ms));
}

/** Escape a string for safe insertion into HTML. Everything user-controlled goes through this. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a URL slug from a Bangla or English title.
 * Keeps Latin letters, digits and Bangla letters; everything else becomes a hyphen.
 */
export function slugify(input) {
  const s = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[''ʼ]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');
  return s || 'news';
}

/** Format an SQL timestamp as a Bangla date, e.g. '২৬ অক্টোবর ২০২৬'. */
export function bnDate(sqlTs, withTime = false) {
  if (!sqlTs) return '';
  const d = new Date(String(sqlTs).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  const opts = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' };
  if (withTime) { opts.hour = 'numeric'; opts.minute = '2-digit'; }
  try {
    return new Intl.DateTimeFormat('bn-BD', opts).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** First ~160 chars of content as an excerpt fallback. */
export function autoExcerpt(content, len = 160) {
  const text = String(content ?? '').replace(/\s+/g, ' ').trim();
  return text.length > len ? text.slice(0, len - 1) + '…' : text;
}

/** True only for http/https URLs (blocks javascript:, data:, etc.). */
export function isSafeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(String(url));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Parse the extra_images JSON column into a clean [{url, alt}] array. */
export function parseExtraImages(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.url === 'string' && x.url)
      .map((x) => ({ url: String(x.url).slice(0, 500), alt: String(x.alt || '').slice(0, 200) }));
  } catch {
    return [];
  }
}

/** Split plain-text content into paragraphs. */
export function paragraphs(content) {
  return String(content ?? '')
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function cleanStr(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(value) {
  return EMAIL_RE.test(String(value ?? '').trim());
}
