// Shared company-name helpers used by both the graph component (ID generation)
// and the API service (directory → group_key resolution). Kept in one place so
// name normalization can never drift between the two paths.

// Trailing legal-form spellings → dotless canonical code, longest first.
// JS port of borme_v3_enricher/normalize.py::_LEGAL_FORM_DOTLESS (the
// canonicalizer applied to STORED v3 officer/company names) — keep the two
// lists in sync. Needed client-side because autocomplete returns raw BORME
// spellings ("... SOCIEDAD LIMITADA") while v3 stores the code ("... SL"),
// and the graph's exact-name filter must treat them as the same entity.
const LEGAL_FORM_DOTLESS = [
  ['SOCIEDAD\\s+LIMITADA\\s+NUEVA\\s+EMPRESA', 'SLNE'],
  ['SOCIEDAD\\s+LIMITADA\\s+UNIPERSONAL', 'SLU'],
  ['SOCIEDAD\\s+AN[OÓ]NIMA\\s+UNIPERSONAL', 'SAU'],
  ['SOCIEDAD\\s+LIMITADA\\s+LABORAL', 'SLL'],
  ['SOCIEDAD\\s+AN[OÓ]NIMA\\s+LABORAL', 'SAL'],
  ['SOCIEDAD\\s+LIMITADA\\s+PROFESIONAL', 'SLP'],
  ['SOCIEDAD\\s+DE\\s+RESPONSABILIDAD\\s+LIMITADA', 'SL'],
  ['SOCIEDAD\\s+LIMITADA', 'SL'],
  ['SOCIEDAD\\s+AN[OÓ]NIMA', 'SA'],
  ['SOCIEDAD\\s+COOPERATIVA', 'SCOOP'],
  ['AGRUPACI[OÓ]N\\s+DE\\s+INTER[EÉ]S\\s+ECON[OÓ]MICO', 'AIE'],
  ['S\\.?\\s?L\\.?\\s?N\\.?\\s?E', 'SLNE'],
  ['S\\.?\\s?L\\.?\\s?U', 'SLU'],
  ['S\\.?\\s?A\\.?\\s?U', 'SAU'],
  ['S\\.?\\s?L\\.?\\s?P', 'SLP'],
  ['S\\.?\\s?L\\.?\\s?L', 'SLL'],
  ['S\\.?\\s?A\\.?\\s?L', 'SAL'],
  ['A\\.?\\s?I\\.?\\s?E', 'AIE'],
  ['U\\.?\\s?T\\.?\\s?E', 'UTE'],
  // Foreign S.R.L. (IT/AR/RO): spelling collapse only — deliberately NOT
  // mapped to SL, or foreign entities would merge with Spanish SLs.
  ['S\\.?\\s?R\\.?\\s?L', 'SRL'],
  ['S\\.?\\s?COOP', 'SCOOP'],
  ['S\\.?\\s?L', 'SL'],
  ['S\\.?\\s?A', 'SA'],
  ['S\\.?\\s?C', 'SC'],
].map(([pat, code]) => [new RegExp(`\\s+${pat}\\.?\\s*$`, 'i'), ` ${code}`]);

/**
 * Rewrite a trailing legal-form suffix (any spelling: long "SOCIEDAD
 * LIMITADA", dotted "S.L.", spaced "S. L.", dotless "SL") to its dotless
 * canonical code. Different forms stay distinct (SL != SA != SLU).
 * @param {string} name
 * @returns {string}
 */
export const canonLegalForm = name => {
  const trimmed = (name || '').trim();
  for (const [pat, repl] of LEGAL_FORM_DOTLESS) {
    if (pat.test(trimmed)) return trimmed.replace(pat, repl).trim();
  }
  return trimmed;
};

/**
 * Punctuation/legal-form-insensitive identity key. Mirrors the backend's
 * name_fold_key: canonicalize the trailing legal form FIRST ("S.A" → "SA" —
 * token-splitting alone would leave "S A"), then compare in analyzer token
 * space (accents folded, punctuation/whitespace runs collapsed to one space).
 * The canonical company name may keep BORME punctuation ("BANCO SANTANDER,
 * SA") that officer spellings never print — one entity, one key.
 * @param {string} name
 * @returns {string}
 */
export const entityNameKey = name =>
  canonLegalForm((name || '').trim())
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

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
