// Client for the corrections-overlay API (POST/GET/DELETE /bormes/corrections).
//
// Corrections are per-user (client_id) officer edits scoped to a company group
// (group_key = the company's v3 id, e.g. "H:V-178351"). They feed the "Custom"
// (amended) DD; they never mutate the registry-derived data. Actions:
//   - hide(name_a)
//   - merge(name_a -> name_b)         (name_a is a duplicate spelling of name_b)
//   - mark_resigned(name_a, resigned_date?)
//
// All calls go through the env-configurable API base (src/config.js).

import { API_URL } from '../config';
import { getClientId } from '../utils/clientId';
import { spanishCompaniesService } from './spanishCompaniesService';

const BASE = `${API_URL}/bormes/corrections`;

const _normName = (s) => (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

/**
 * Resolve a company's group_key (its v3 doc id, e.g. "H:V-178351") from its
 * name, via the directory autocomplete (whose suggestions carry `id`). The
 * graph identifies companies by a name-derived node id, NOT the group_key, so
 * we resolve on demand at the point corrections are written / a Custom DD is
 * generated. Returns null if no confident match — callers then let the backend
 * resolve by name (amended_officer_lists falls back to the resolved doc's id).
 */
export async function resolveGroupKey(companyName) {
  if (!companyName) return null;
  try {
    const res = await spanishCompaniesService.autocompleteCompanies(companyName, { limit: 1 });
    const top = (res.suggestions || [])[0];
    if (!top || !top.id) return null;
    // Guard: only trust the id when the top suggestion's name matches the input,
    // so we never scope a correction to the wrong company.
    const topName = top.company_name || top.name || top.label || '';
    return _normName(topName) === _normName(companyName) ? top.id : null;
  } catch {
    return null;
  }
}

/**
 * Persist one correction. Returns { id } on success.
 * @param {object} c - { groupKey, action, nameA, nameB?, resignedDate? }
 */
export async function postCorrection({ groupKey, action, nameA, nameB, resignedDate }) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: getClientId(),
      group_key: groupKey,
      action,
      name_a: nameA,
      ...(nameB ? { name_b: nameB } : {}),
      ...(resignedDate ? { resigned_date: resignedDate } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `Correction save failed (${res.status})`);
  }
  return res.json(); // { success: true, id }
}

/**
 * List the current user's corrections for a company group (for the "My
 * corrections" / undo panel). Returns an array of
 * { id, action, name_a, name_b, resigned_date, created_at }.
 */
export async function listCorrections(groupKey) {
  const url = `${BASE}?client_id=${encodeURIComponent(getClientId())}&group_key=${encodeURIComponent(groupKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load corrections (${res.status})`);
  }
  const data = await res.json();
  return data.corrections || [];
}

/**
 * Delete (undo) one correction by id, scoped to the current user. Returns true
 * if a row was removed.
 */
export async function deleteCorrection(correctionId) {
  const url = `${BASE}/${correctionId}?client_id=${encodeURIComponent(getClientId())}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error(`Could not delete correction (${res.status})`);
  }
  const data = await res.json().catch(() => ({}));
  return data.deleted !== false;
}
