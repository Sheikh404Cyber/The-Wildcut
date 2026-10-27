import { json, fail } from '../../lib/http.js';

// Public site settings — the contact details and the site's editable texts
// (footer line, About page body, Contact page intro) the pages hydrate.
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM site_settings WHERE key IN ('contact_email', 'contact_phone', 'footer_text', 'about_text', 'contact_text')"
    ).all();
    const map = {};
    for (const r of results) map[r.key] = r.value;
    return json(
      {
        ok: true,
        contact_email: map.contact_email || '',
        contact_phone: map.contact_phone || '',
        footer_text: map.footer_text || '',
        about_text: map.about_text || '',
        contact_text: map.contact_text || '',
      },
      200,
      { 'Cache-Control': 'public, max-age=60' }
    );
  } catch {
    return fail(500, 'Server error');
  }
}
