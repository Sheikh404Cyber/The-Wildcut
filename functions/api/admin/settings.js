import { json, fail, readJson, sameOrigin } from '../../lib/http.js';
import { requireRole } from '../../lib/auth.js';
import { cleanStr, isEmail } from '../../lib/util.js';

const ROLES = ['owner', 'admin'];

// Every site-setting key the panel can edit, with its max length. The three
// *_text keys are the site's editable texts (footer line, About page body,
// Contact page intro) — plain text, hydrated by the public site.
const KEYS = [
  ['contact_email', 120],
  ['contact_phone', 30],
  ['footer_text', 5000],
  ['about_text', 5000],
  ['contact_text', 5000],
];
const KEY_NAMES = KEYS.map(([k]) => k);

async function readSettings(DB) {
  const { results } = await DB.prepare(
    "SELECT key, value FROM site_settings WHERE key IN ('contact_email', 'contact_phone', 'footer_text', 'about_text', 'contact_text')"
  ).all();
  const map = {};
  for (const r of results) map[r.key] = r.value;
  const out = {};
  for (const key of KEY_NAMES) out[key] = map[key] || '';
  return out;
}

// Site settings for the panel: contact details + the site's editable texts.
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
    if (!body) return fail(400, 'সঠিক তথ্য পাঠানো হয়নি');

    // Only keys actually present in the request are changed, so the panel can
    // save the যোগাযোগ and সাইটের লেখা sections independently.
    const updates = [];
    for (const [key, max] of KEYS) {
      if (body[key] === undefined) continue;
      const value = cleanStr(body[key], max);
      if (key === 'contact_email' && value && !isEmail(value)) return fail(400, 'ইমেইল সঠিক নয়');
      updates.push([key, value]);
    }
    for (const [key, value] of updates) {
      await env.DB.prepare(
        'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
        .bind(key, value)
        .run();
    }
    return json({ ok: true, ...(await readSettings(env.DB)) });
  } catch {
    return fail(500, 'Server error');
  }
}
