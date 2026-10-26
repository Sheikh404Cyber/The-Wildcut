import { json, fail } from '../../lib/http.js';

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, slug, description FROM categories ORDER BY sort_order ASC, id ASC'
    ).all();
    return json({ ok: true, categories: results }, 200, { 'Cache-Control': 'public, max-age=120' });
  } catch {
    return fail(500, 'Server error');
  }
}
