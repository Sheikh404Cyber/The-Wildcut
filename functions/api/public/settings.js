import { json, fail } from '../../lib/http.js';

// Public site settings — only the contact details the contact page displays.
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM site_settings WHERE key IN ('contact_email', 'contact_phone')"
    ).all();
    const map = {};
    for (const r of results) map[r.key] = r.value;
    return json(
      { ok: true, contact_email: map.contact_email || '', contact_phone: map.contact_phone || '' },
      200,
      { 'Cache-Control': 'public, max-age=60' }
    );
  } catch {
    return fail(500, 'Server error');
  }
}
