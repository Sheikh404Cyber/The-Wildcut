import { json, fail, sameOrigin } from '../../lib/http.js';
import { requireRole } from '../../lib/auth.js';
import { cleanStr } from '../../lib/util.js';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Image upload → R2. The file itself never goes into the database;
// only its URL is stored (media table + referenced from news rows).
export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ['owner', 'admin', 'editor']);
    if (auth.response) return auth.response;

    if (!env.MEDIA) return fail(503, 'Image storage (R2) is not configured');

    const form = await request.formData();
    const file = form.get('file');
    const alt = cleanStr(form.get('alt'), 200);
    if (!file || typeof file === 'string') return fail(400, 'ছবি সিলেক্ট করুন');

    const ext = TYPES[file.type];
    if (!ext) return fail(400, 'শুধু JPG, PNG, WebP বা GIF ছবি দেওয়া যাবে');
    if (file.size > MAX_BYTES) return fail(400, 'ছবি 5MB এর বেশি বড় হতে পারবে না');
    if (file.size === 0) return fail(400, 'ফাইলটি খালি');

    const now = new Date();
    const folder = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const key = `${folder}/${crypto.randomUUID()}.${ext}`;

    await env.MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const url = `/media/${key}`;
    await env.DB.prepare(
      'INSERT INTO media (r2_key, url, alt, size_bytes, created_by) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(key, url, alt, file.size, auth.user.id)
      .run();

    return json({ ok: true, url, alt }, 201);
  } catch {
    return fail(500, 'Server error');
  }
}
