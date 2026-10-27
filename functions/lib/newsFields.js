// Validation + normalisation for news create/update payloads.

import { cleanStr, slugify, isSafeUrl, parseExtraImages, sqlTime } from './util.js';

/**
 * Returns { fields } or { error }.
 * fields.status is 'draft' | 'published' | 'scheduled'; fields.published_at is
 * SQL time (UTC, 'YYYY-MM-DD HH:MM:SS') or null. For 'scheduled', published_at
 * is the future moment the scheduled-publish job will flip it to 'published'.
 */
export function extractNewsFields(body, existing = null) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' };

  const title = cleanStr(body.title, 200);
  if (!title || title.length < 3) return { error: 'শিরোনাম দিতে হবে (কমপক্ষে ৩ অক্ষর)' };

  const status =
    body.status === 'published' ? 'published' : body.status === 'scheduled' ? 'scheduled' : 'draft';
  const content = String(body.content ?? '').slice(0, 100000);
  if (status !== 'draft' && content.trim().length < 10) {
    return { error: 'Publish করতে হলে খবরের মূল লেখা দিতে হবে' };
  }

  const cover = cleanStr(body.cover_image_url, 500);
  if (cover && !isSafeUrl(cover) && !cover.startsWith('/media/')) {
    return { error: 'কভার ছবির URL সঠিক নয়' };
  }
  const sourceUrl = cleanStr(body.source_url, 500);
  if (sourceUrl && !isSafeUrl(sourceUrl)) return { error: 'তথ্যসূত্রের URL সঠিক নয়' };

  let categoryId = null;
  if (body.category_id !== null && body.category_id !== undefined && body.category_id !== '') {
    categoryId = parseInt(body.category_id, 10);
    if (Number.isNaN(categoryId)) return { error: 'ক্যাটাগরি সঠিক নয়' };
  }

  let publishedAt = existing ? existing.published_at : null;
  if (status === 'scheduled') {
    // The editor sends an ISO string (converted from the Dhaka-local
    // datetime-local input in admin.js); store its UTC equivalent.
    const d = body.published_at ? new Date(body.published_at) : null;
    if (!d || Number.isNaN(d.getTime())) {
      return { error: 'Schedule করতে হলে প্রকাশের তারিখ ও সময় দিতে হবে' };
    }
    publishedAt = sqlTime(d);
  } else if (status === 'published') {
    if (body.published_at) {
      const d = new Date(body.published_at);
      if (Number.isNaN(d.getTime())) return { error: 'প্রকাশের তারিখ সঠিক নয়' };
      publishedAt = sqlTime(d);
    } else if (!publishedAt) {
      publishedAt = sqlTime();
    }
  }

  return {
    fields: {
      title,
      slugInput: cleanStr(body.slug, 120),
      titleForSlug: title,
      excerpt: cleanStr(body.excerpt, 400),
      content,
      cover_image_url: cover,
      extra_images: JSON.stringify(
        parseExtraImages(typeof body.extra_images === 'string' ? body.extra_images : JSON.stringify(body.extra_images ?? []))
      ),
      category_id: categoryId,
      author: cleanStr(body.author, 100),
      source_name: cleanStr(body.source_name, 150),
      source_url: sourceUrl,
      seo_title: cleanStr(body.seo_title, 200),
      seo_description: cleanStr(body.seo_description, 320),
      featured: body.featured ? 1 : 0,
      status,
      published_at: publishedAt,
    },
  };
}

/** Find a free slug: base, base-2, base-3, ... (excluding one news id when updating). */
export async function uniqueSlug(DB, base, excludeId = null) {
  let slug = slugify(base) || 'news';
  let candidate = slug;
  let n = 1;
  for (;;) {
    const row = excludeId
      ? await DB.prepare('SELECT id FROM news WHERE slug = ? AND id != ?').bind(candidate, excludeId).first()
      : await DB.prepare('SELECT id FROM news WHERE slug = ?').bind(candidate).first();
    if (!row) return candidate;
    n += 1;
    candidate = `${slug}-${n}`;
  }
}
