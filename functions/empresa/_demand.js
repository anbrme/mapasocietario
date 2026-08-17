/**
 * Storage helpers for demand-based company indexing.
 *
 * A company page is `noindex` until real product usage proves it is worth
 * indexing. Promotion is the only thing that lifts that, so everything here
 * errs towards NOT promoting: unknown state, a contested slug or an exhausted
 * daily budget all resolve to "leave it as a candidate".
 */

const PROMOTED_STATUS = 'promoted';

// A promoted profile is re-checked against the BORME API at most this often;
// a candidate that failed verification backs off for this long before retrying.
export const REVALIDATE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
export const RETRY_VALIDATION_AFTER_MS = 24 * 60 * 60 * 1000;

// Ceiling on how fast the indexable surface may grow. Sized well above real
// demand (~40 visits/day) so it only ever bites on abuse.
export const MAX_PROMOTIONS_PER_DAY = 250;

/**
 * v3 identities are `<prefix>:<value>` — `H:M-396846` for a registry sheet and
 * `N:<normalized name>` for a company with no hoja. The name form legitimately
 * carries accents, ampersands and punctuation ("N:HERMANOS MUÑOZ MUÑOZ SL"), so
 * only control characters are rejected; the value never reaches SQL or a URL
 * unescaped (parameterized binds and encodeURIComponent respectively).
 */
export function isStableCompanyGroupKey(value) {
  if (typeof value !== 'string') return false;
  return /^[A-Za-z]:[^\u0000-\u001F\u007F]{2,180}$/.test(value.trim());
}

export function shouldPromoteCompany({ searchRenderCount = 0, fullProfileClickCount = 0 } = {}) {
  return Number(fullProfileClickCount) >= 1 || Number(searchRenderCount) >= 2;
}

function ageMs(timestamp) {
  if (!timestamp) return Infinity;
  // SQLite CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" in UTC.
  const parsed = Date.parse(`${String(timestamp).replace(' ', 'T')}Z`);
  return Number.isNaN(parsed) ? Infinity : Date.now() - parsed;
}

/**
 * Should this row be verified against the BORME API on THIS request?
 *
 * Verification is the expensive part (an upstream round-trip), so it runs only
 * where it changes an outcome: a candidate that has just earned promotion, or a
 * promoted page whose verification has gone stale and may need demoting.
 */
export function shouldValidateCompany(row) {
  if (!row) return false;
  const age = ageMs(row.validated_at);
  if (row.status === PROMOTED_STATUS) return age >= REVALIDATE_AFTER_MS;
  if (row.status === 'rejected') return false;
  if (!shouldPromoteCompany({
    searchRenderCount: row.search_render_count,
    fullProfileClickCount: row.full_profile_click_count,
  })) return false;
  return age >= RETRY_VALIDATION_AFTER_MS;
}

export async function findPromotedCompanyBySlug(db, slug) {
  if (!db || !slug) return null;
  try {
    return await db.prepare(
      `SELECT group_key, slug, canonical_name, province, hoja, nif, promoted_at
       FROM company_index_candidates
       WHERE slug = ? AND status = ?
       LIMIT 1`,
    ).bind(slug, PROMOTED_STATUS).first();
  } catch (error) {
    console.error('[company-index] promoted lookup failed:', error?.message || error);
    return null;
  }
}

/** True when a DIFFERENT registry identity already owns this indexable URL. */
export async function isSlugClaimedByAnother(db, slug, groupKey) {
  const row = await db.prepare(
    `SELECT group_key FROM company_index_candidates
     WHERE slug = ? AND status = ? AND group_key <> ?
     LIMIT 1`,
  ).bind(slug, PROMOTED_STATUS, groupKey).first();
  return Boolean(row);
}

export async function countPromotionsToday(db) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS total FROM company_index_candidates
     WHERE status = ? AND promoted_at >= date('now')`,
  ).bind(PROMOTED_STATUS).first();
  return Number(row?.total || 0);
}

export async function countPromotedCompanies(db) {
  if (!db) return 0;
  const row = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM company_index_candidates
     WHERE status = ?`,
  ).bind(PROMOTED_STATUS).first();
  return Number(row?.total || 0);
}

export async function listPromotedCompanies(db, { limit, offset }) {
  if (!db) return [];
  const result = await db.prepare(
    `SELECT slug, promoted_at
     FROM company_index_candidates
     WHERE status = ?
     ORDER BY promoted_at ASC, slug ASC
     LIMIT ? OFFSET ?`,
  ).bind(PROMOTED_STATUS, limit, offset).all();
  return result?.results || [];
}

/** Distinct provinces of promoted companies with their page counts. */
export async function listPromotedProvinceCounts(db) {
  if (!db) return [];
  const result = await db.prepare(
    `SELECT province, COUNT(*) AS total
     FROM company_index_candidates
     WHERE status = ? AND province IS NOT NULL AND province <> ''
     GROUP BY province`,
  ).bind(PROMOTED_STATUS).all();
  return result?.results || [];
}

/**
 * Promoted companies for a set of province spellings (the same province can
 * be stored under case variants coming from different upstream sources).
 */
export async function listPromotedByProvinces(db, provinces, { limit = 2000 } = {}) {
  if (!db || !provinces.length) return [];
  const placeholders = provinces.map(() => '?').join(', ');
  const result = await db.prepare(
    `SELECT slug, canonical_name, nif
     FROM company_index_candidates
     WHERE status = ? AND province IN (${placeholders})
     ORDER BY canonical_name ASC
     LIMIT ?`,
  ).bind(PROMOTED_STATUS, ...provinces, limit).all();
  return result?.results || [];
}

/**
 * Record that verification ran. Stamping the timestamp on FAILURE too is what
 * makes the retry back-off work: without it, a candidate stuck above the
 * promotion threshold would re-hit the BORME API on every single signal.
 */
export async function markValidationAttempt(db, groupKey) {
  await db.prepare(
    `UPDATE company_index_candidates
     SET validated_at = CURRENT_TIMESTAMP
     WHERE group_key = ?`,
  ).bind(groupKey).run();
}

/** Pull a page back out of the index (renamed, dissolved or no longer found). */
export async function demoteCompany(db, groupKey) {
  await db.prepare(
    `UPDATE company_index_candidates
     SET status = 'candidate', promoted_at = NULL, validated_at = CURRENT_TIMESTAMP
     WHERE group_key = ?`,
  ).bind(groupKey).run();
}
