/**
 * Currency-confirmation logic + rendering for the public company pages.
 * Self-contained (own esc/i18n) so it stays unit-testable and never imports
 * from _lib.js (which imports this — a cycle). The `_` prefix means Cloudflare
 * Pages does not route this file.
 */

const DAY_MS = 86_400_000;

// Age (whole days, never negative) of a 'YYYY-MM-DD' confirmation at nowMs,
// mapped to a decay level. null if the date can't be parsed.
export function confirmationStatus(confirmedAt, nowMs = Date.now()) {
  const t = Date.parse(`${confirmedAt}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  const ageDays = Math.max(0, Math.floor((nowMs - t) / DAY_MS));
  const level = ageDays <= 90 ? 'fresh' : ageDays <= 365 ? 'aging' : 'stale';
  return { ageDays, level };
}
