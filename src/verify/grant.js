/**
 * A grant is an ACCESS TOKEN, not evidence of who read the page. Links get
 * forwarded, and email scanners and link previewers fetch them unprompted, so a
 * grant labelled "Banco X" records accesses through that link and nothing more.
 * No surface may describe it otherwise (spec section 7).
 *
 * Every non-valid state renders identically to the caller as 404: a 403 would
 * confirm the record exists.
 */
export function grantState(row, nowMs = Date.now()) {
  if (!row) return 'missing';
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && Date.parse(row.expires_at) <= nowMs) return 'expired';
  return 'valid';
}

/**
 * A grant's kind decides which ROUTE its token opens, and each token has
 * exactly one meaning: a preview token opens only /verificacion/p/, a
 * counterparty token only /verificacion/g/. Mixing them would let a link issued
 * to a company for a look at its own badge also address the attestation record.
 *
 * SQLite cannot add a CHECK via ALTER TABLE, so this is the enforcement.
 */
export const GRANT_KINDS = ['counterparty', 'preview'];

export const DEFAULT_TTL_DAYS = 90;
// Short on purpose: a preview is shown while a decision is being made, not
// retained. Revisit if the first pilot companies find it tight.
export const PREVIEW_TTL_DAYS = 14;

// null means INVALID (the caller should reject); absent means the default.
export function normalizeGrantKind(raw) {
  if (raw === undefined || raw === null || raw === '') return 'counterparty';
  return GRANT_KINDS.includes(raw) ? raw : null;
}

export const grantPath = (kind, token) =>
  `/verificacion/${kind === 'preview' ? 'p' : 'g'}/${token}`;
