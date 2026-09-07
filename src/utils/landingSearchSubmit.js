/**
 * What Enter or the Search button on the landing page should open.
 *
 * The autocomplete ranks by prefix, not prominence: "endesa" puts ENDESA
 * ENERGIA SA above ENDESA SA. A visitor who typed a whole name and pressed
 * Enter meant that name, so an exact match wins over the first row; the first
 * row is only the fallback when nothing matches exactly.
 */

// Legal forms a visitor drops when typing a company name from memory.
const LEGAL_FORM_SUFFIX = /\s+(S\s*A\s*U?|S\s*L\s*U?|S\s*L\s*L|S\s*C\s*O{0,2}P|S\s*A\s*D|A\s*I\s*E|S\s*C|S\s*R\s*L)$/;

export function normalizeSearchName(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function withoutLegalForm(normalized) {
  return normalized.replace(LEGAL_FORM_SUFFIX, '').trim();
}

function optionName(option) {
  return option?.name || option?.label || option?.value || '';
}

function isExactMatch(query, option) {
  const wanted = normalizeSearchName(query);
  if (!wanted) return false;
  const candidate = normalizeSearchName(optionName(option));
  if (candidate === wanted) return true;
  return withoutLegalForm(candidate) === withoutLegalForm(wanted);
}

/**
 * @returns {{ option: object, match: 'exact' | 'first', rank: number } | null}
 *   `rank` is 1-based, matching the selection_rank GA4 parameter.
 */
export function resolveSubmitTarget(query, options) {
  const list = Array.isArray(options) ? options : [];
  if (list.length === 0) return null;

  const exactIndex = list.findIndex(option => isExactMatch(query, option));
  if (exactIndex >= 0) return { option: list[exactIndex], match: 'exact', rank: exactIndex + 1 };

  return { option: list[0], match: 'first', rank: 1 };
}
