/**
 * GET /api/verify/admin/lookup?q=NAME — find a company and see who the registry
 * says runs it.
 *
 * Inviting needs a group_key AND a representative name matching an
 * officers_active row exactly (sorted-token equality, see src/verify/seat.js).
 * Without this the operator had to know the key already and guess the spelling,
 * learning of a mismatch only from the invite endpoint's refusal.
 *
 * The upstream search parameter is `query`, not `q`, and its results already
 * carry officers_active - so this is one upstream call, not one per hit.
 */
import { requireAdmin, jsonResponse } from '../_db.js';

const API_BASE = 'https://api.ncdata.eu';
const MAX_HITS = 6;

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 3) return jsonResponse({ ok: false, error: 'query_too_short' }, 400);

  try {
    const r = await fetch(
      `${API_BASE}/bormes/v3/search?query=${encodeURIComponent(q)}&size=${MAX_HITS}`,
      { headers: env.INTERNAL_API_KEY ? { 'X-Internal-Key': env.INTERNAL_API_KEY } : {},
        signal: AbortSignal.timeout(8000) });
    if (!r.ok) return jsonResponse({ ok: false, error: `search_${r.status}` }, 502);

    const data = await r.json();
    const items = (data.results || []).map((c) => ({
      group_key: c.group_key || c._id || c.id,
      name: c.company_name || c.company_name_normalized,
      province: c.province || null,
      // Surfaced so a dissolved or insolvent company is visible BEFORE an
      // invitation goes out, not after the representative has filled the form.
      is_dissolved: !!c.is_dissolved,
      is_in_concurso: !!c.is_in_concurso,
      officers: (c.officers_active || []).map((o) => ({
        name: o.name || o.name_normalized,
        position: o.position_normalized || o.position || null,
        appointed_date: o.appointed_date || null,
      })),
    })).filter((c) => c.group_key && c.name);

    return jsonResponse({ ok: true, count: items.length, items });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e.message || e) }, 502);
  }
}
