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
