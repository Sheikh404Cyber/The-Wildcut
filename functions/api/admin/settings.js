import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireRole } from '../../lib/auth.js';
import { cleanStr, isEmail } from '../../lib/util.js';

const ROLES = ['owner', 'admin'];

async function readSettings(DB) {
  const { results } = await DB.prepare(
    "SELECT key, value FROM site_settings WHERE key IN ('contact_email', 'contact_phone')"
  ).all();
  const map = {};
  for (const r of results) map[r.key] = r.value;
  return { contact_email: map.contact_email || '', contact_phone: map.contact_phone || '' };
}

// Site settings for the panel (contact email + phone shown on the contact page).
export async function onRequestGet({ request, env }) {
  try {
    const auth = await requireRole(request, env, ROLES);
    if (auth.response) return auth.response;
    return json({ ok: true, ...(await readSettings(env.DB)) });
  } catch {
    return fail(500, 'Server error');
  }
}

export async function onRequestPut({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail(403, 'Invalid origin');
    const auth = await requireRole(request, env, ROLES);
    if (auth.response) return auth.response;

    const body = await readJson(request);
    const email = cleanStr(body?.contact_email, 120);
    const phone = cleanStr(body?.contact_phone, 30);
    if (email && !isEmail(email)) return fail(400, 'ইমেইল সঠিক নয়');

    for (const [key, value] of [['contact_email', email], ['contact_phone', phone]]) {
      await env.DB.prepare(
        'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
        .bind(key, value)
        .run();
    }
    return json({ ok: true, contact_email: email, contact_phone: phone });
  } catch {
    return fail(500, 'Server error');
  }
}
