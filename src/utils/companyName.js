// Shared company-name helpers used by both the graph component (ID generation)
// and the API service (directory → group_key resolution). Kept in one place so
// name normalization can never drift between the two paths.

/**
 * Normalize a company display name for consistent matching / ID generation:
 * strips a trailing "(YYYY)" year suffix and a trailing period so that registry
 * variants like "COCUNAT S.L." and "COCUNAT S.L" compare equal.
 * @param {string} name
 * @returns {string}
 */
export const normalizeCompanyName = name =>
  (name || '')
    .replace(/\s*\(\d{4}\)\.?$/, '') // Remove year suffix like (2024).
    .replace(/\.$/, '') // Remove trailing period
    .trim();

/**
 * A stable v3 group_key looks like "H:B-441672" or "N:M-396846" (a single
 * letter prefix, a colon, then hoja-style chars). Opaque content-hash ids
 * (e.g. "2b3200b6b59d301eeaaa72f7bb9f7d07") are duplicate/garbage docs that do
 * NOT match — they carry no events and must never be preferred.
 * @param {string} value
 * @returns {boolean}
 */
export const looksLikeGroupKey = value =>
  typeof value === 'string' && /^[A-Za-z]:[A-Za-z0-9.\- ]+$/.test(value.trim());

/**
 * Choose the best directory-autocomplete suggestion for a company name and
 * return its group_key id (or null).
 *
 * Resolution order:
 *   1. Exact (punctuation-normalized) name match — when several docs share the
 *      name, prefer the one carrying a real group_key over a hash duplicate.
 *   2. No exact match — take the best-ranked *usable* suggestion, skipping the
 *      directory's nameless opaque-hash duplicates (no name AND not a
 *      group_key), which carry no events and would strand callers on undated
 *      data. Ranking order is otherwise preserved.
 *
 * @param {string} name
 * @param {Array<{id?: string, company_name_normalized?: string, name?: string}>} suggestions
 * @returns {string|null}
 */
export const selectGroupKeyId = (name, suggestions) => {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;

  const wanted = normalizeCompanyName(name).toUpperCase();
  const displayNameOf = s =>
    normalizeCompanyName(s?.company_name_normalized || s?.name || '').toUpperCase();

  const exactMatches = suggestions.filter(s => s?.id && displayNameOf(s) === wanted);
  const exact =
    exactMatches.find(s => looksLikeGroupKey(s.id)) || exactMatches[0];
  if (exact) return exact.id;

  const usable = suggestions.find(
    s => s?.id && (displayNameOf(s) || looksLikeGroupKey(s.id))
  );
  return (usable || suggestions[0])?.id || null;
};
