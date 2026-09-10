/**
 * Normalisers for GA4 custom-definition fields.
 *
 * The Admin API rejects the entire createCustomDimension/Metric request when
 * either field is out of bounds, so one bad row fails a whole tier. Kept in
 * their own module so they can be unit-tested: the caller is a top-level-await
 * CLI that would hit the API on import.
 */

// GA4 accepts only alphanumerics, underscore and space in a displayName.
// A hyphen is the one that looks harmless and 400s the request.
const NAME_ALLOWED = /[^A-Za-z0-9_ ]+/g;

const DESC_LIMIT = 150;
const ELLIPSIS = '…';

export function safeName(displayName) {
  return String(displayName ?? '')
    .replace(NAME_ALLOWED, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function safeDesc(description) {
  const text = String(description ?? '').trim();
  if (text.length <= DESC_LIMIT) return text;

  const cut = text.slice(0, DESC_LIMIT - ELLIPSIS.length);
  const lastSpace = cut.lastIndexOf(' ');
  const body = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}${ELLIPSIS}`;
}
