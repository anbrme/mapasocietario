/**
 * GET /api/verify/admin/lookup?q=NAME — find a company and see who the registry
 * says runs it.
 *
 * Inviting requires a group_key and a representative name that matches an
 * officers_active row EXACTLY (sorted-token equality - see src/verify/seat.js).
 * Without this the operator had to know the group_key already and guess the
 * spelling, and a mismatch only surfaced as a refusal from the invite endpoint.
 *
 * Returns the officer list so the name can be picked rather than typed.
 */
import { requireAdmin, jsonResponse } from '../_db.js';

const API_BASE = 'https://api.ncdata.eu';

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 3) return jsonResponse({ ok: false, error: 'query_too_short' }, 400);

  const headers = env.INTERNAL_API_KEY ? { 'X-Internal-Key': env.INTERNAL_API_KEY } : {};
  try {
    const r = await fetch(`${API_BASE}/bormes/v3/search?q=${encodeURIComponent(q)}&size=8`,
      { headers });
    if (!r.ok) return jsonResponse({ ok: false, error: `search_${r.status}` }, 502);
    const data = await r.json();
    const hits = data.results || data.companies || data.hits || [];

    const items = [];
    for (const hit of hits.slice(0, 5)) {
      const groupKey = hit.group_key || hit._id || hit.id;
      if (!groupKey) continue;
      // The officer list is the point: the invite refuses any name that does not
      // match a seat, so the operator should choose from the registry's own
      // spelling rather than retype it.
      let officers = [];
      try {
        const c = await fetch(
          `${API_BASE}/bormes/v3/company?group_key=${encodeURIComponent(groupKey)}`, { headers });
        if (c.ok) {
          const doc = ((await c.json()) || {}).company || {};
          officers = (doc.officers_active || []).map((o) => ({
            name: o.name || o.name_normalized,
            position: o.position_normalized || o.position || null,
            appointed_date: o.appointed_date || null,
          }));
        }
      } catch { /* a company we cannot read is simply not offered */ }
      items.push({
        group_key: groupKey,
        name: hit.company_name || hit.company_name_normalized || hit.name,
        province: hit.province || null,
        officers,
      });
    }
    return jsonResponse({ ok: true, count: items.length, items });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e.message || e) }, 502);
  }
}
