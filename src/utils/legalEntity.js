/**
 * Pure legal-entity name classifier.
 *
 * Distinguishes a company/legal-entity name ("CAJAMAR GESTION SGIIC SA")
 * from a plain individual/person name ("GARCIA LOPEZ JUAN") by checking for
 * a known Spanish or foreign legal-form suffix.
 *
 * Deliberately conservative: only matches a legal form as the trailing
 * whole-word token (or the last two tokens joined, to catch spaced-out forms
 * like "S. COOP." -> "S" + "COOP" -> "SCOOP"), so a person's surname that
 * happens to contain matching letters mid-string ("CASADO", "MASSA") never
 * false-positives.
 */

// Known legal-form suffix tokens (normalized: uppercase, periods stripped).
const LEGAL_FORM_TOKENS = new Set([
  // Spanish
  'SL',
  'SLU',
  'SA',
  'SAU',
  'SLL',
  'SLP',
  'SC',
  'SCP',
  'SCR',
  'SCOOP',
  'COOP',
  'AIE',
  'UTE',
  'SGIIC',
  'SICAV',
  // Foreign (common)
  'LTD',
  'LIMITED',
  'INC',
  'CORP',
  'CORPORATION',
  'LLC',
  'PLC',
  'GMBH',
  'AG',
  'KG',
  'OHG',
  'SAS',
  'SARL',
  'EURL',
  'BV',
  'NV',
  'SPA',
]);

const normalize = name =>
  (name || '')
    .toUpperCase()
    .replace(/[.,]/g, '') // "S.L." -> "SL", "S. COOP." -> "S COOP"
    .replace(/\s+/g, ' ')
    .trim();

/**
 * @param {string} name - a raw registry name (officer or company).
 * @returns {boolean} true when the name carries a recognized legal-entity
 *   suffix (i.e. it names a company, not a plain individual).
 */
export function isLegalEntityName(name) {
  const normalized = normalize(name);
  if (!normalized) return false;

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return false;

  const lastToken = tokens[tokens.length - 1];
  if (LEGAL_FORM_TOKENS.has(lastToken)) return true;

  // Catch spaced-out forms whose parts only form a known token when joined,
  // e.g. ["...", "S", "COOP"] -> "SCOOP".
  if (tokens.length >= 2) {
    const lastTwoJoined = tokens.slice(-2).join('');
    if (LEGAL_FORM_TOKENS.has(lastTwoJoined)) return true;
  }

  return false;
}

export default isLegalEntityName;
