/**
 * Storage helpers for demand-based company indexing.
 *
 * A company page is `noindex` until real product usage proves it is worth
 * indexing. Promotion is the only thing that lifts that, so everything here
 * errs towards NOT promoting: unknown state, a contested slug or an exhausted
 * daily budget all resolve to "leave it as a candidate".
 */

import { nameToSlug } from './_slug.js';
import { SIBLINGS_LIMIT } from './_siblings.js';

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

/**
 * Promoted rows in promotion order. `from` / `before` bound promoted_at as a
 * half-open [from, before) range of 'YYYY-MM-DD' strings — the demand-sitemap
 * waves (sitemaps/_waves.js); both optional.
 */
export async function listPromotedCompanies(db, { limit, offset, from = null, before = null }) {
  if (!db) return [];
  const bounds = [
    ...(from ? [{ clause: 'promoted_at >= ?', value: from }] : []),
    ...(before ? [{ clause: 'promoted_at < ?', value: before }] : []),
  ];
  const where = ['status = ?', ...bounds.map((b) => b.clause)].join(' AND ');
  const result = await db.prepare(
    `SELECT slug, promoted_at
     FROM company_index_candidates
     WHERE ${where}
     ORDER BY promoted_at ASC, slug ASC
     LIMIT ? OFFSET ?`,
  ).bind(PROMOTED_STATUS, ...bounds.map((b) => b.value), limit, offset).all();
  return result?.results || [];
}

/**
 * The newest promotions, for the "recently added" block on the directory hubs.
 *
 * Why it exists: a company from a fresh batch is otherwise four clicks from the
 * root (home -> hub -> province -> company), and province lists are alphabetical,
 * so a new arrival lands wherever its name sorts — invisible among ~1,300
 * siblings. Ordered by promoted_at DESC, this is the one edge that puts a new
 * batch one click from a page Googlebot already refetches often.
 *
 * Served by idx_company_index_candidates_status_promoted (status, promoted_at),
 * so it is an index range scan in reverse, not a sort.
 */
export async function listRecentlyPromoted(db, { limit = 30 } = {}) {
  if (!db) return [];
  const result = await db.prepare(
    `SELECT slug, canonical_name, province
     FROM company_index_candidates
     WHERE status = ? AND promoted_at IS NOT NULL
     ORDER BY promoted_at DESC, slug ASC
     LIMIT ?`,
  ).bind(PROMOTED_STATUS, limit).all();
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

/**
 * Self-heal for a promoted page whose live name no longer round-trips to its
 * slug (the page renders `noindex`, but the row still feeds the sitemap and
 * the directorio hubs). Re-point the row to the live slug when that slug is
 * free; otherwise demote it. Runs on the render path, so it must never throw.
 * Mirrors scripts/promote-batch-lib.mjs resyncSql — keep the two in step.
 */
export async function repointStaleSlug(db, { groupKey, slug, canonicalName }) {
  if (!db || !groupKey || !slug || !canonicalName) return 'skipped';
  try {
    const moved = await db.prepare(
      `UPDATE company_index_candidates
       SET slug = ?, canonical_name = ?, validated_at = CURRENT_TIMESTAMP
       WHERE group_key = ? AND status = 'promoted'
         AND NOT EXISTS (
           SELECT 1 FROM company_index_candidates
           WHERE slug = ? AND status = 'promoted' AND group_key <> ?
         )`,
    ).bind(slug, canonicalName, groupKey, slug, groupKey).run();
    if (Number(moved?.meta?.changes || 0) > 0) return 'repointed';
    await demoteCompany(db, groupKey);
    return 'demoted';
  } catch (error) {
    console.error('[company-index] stale-slug heal failed:', error?.message || error);
    return 'failed';
  }
}

/**
 * The promoted companies alphabetically either side of this one in the same
 * province — the raw material for the sibling links on a company page.
 *
 * NEIGHBOURS, not "the first ten in the province", and that is the whole point.
 * A top-N list would point all 2,000 pages of a province at the same ten
 * companies: ten pages with 2,000 inbound links each and the rest still
 * orphaned. Taking the names either side instead chains every page to the next,
 * so each one receives links and a crawler that follows them walks the entire
 * province.
 *
 * The same province is stored under several spellings ("Madrid" / "MADRID" /
 * "A Coruña" / "A CORUÑA"): no write path normalises it. The hubs fold those
 * onto one page by URL slug (groupProvinces), and this does the same — it
 * resolves every stored spelling whose slug equals this province's slug and
 * matches `province IN (...)`. NOT `UPPER(province) = UPPER(?)`: SQLite's
 * UPPER is ASCII-only, so "Almería" and "ALMERÍA" never matched, and an
 * accented province could chain per spelling or lose its block entirely.
 *
 * Two D1 round-trips (distinct spellings, then both sides in one batch).
 * Never throws: a D1 failure is logged and costs the block, not the page.
 */
export async function listPromotedSiblings(db, { province, slug, name, limit = SIBLINGS_LIMIT } = {}) {
  // Always the {before, after} shape, so the caller never has to tell an empty
  // answer apart from a missing one.
  const none = { before: [], after: [] };
  if (!db || !province || !name) return none;
  try {
    const variants = await promotedProvinceVariants(db, province);
    if (!variants.length) return none;
    const placeholders = variants.map(() => '?').join(', ');
    const side = (comparison, order) => db.prepare(
      `SELECT slug, canonical_name
       FROM company_index_candidates
       WHERE status = ?
         AND province IN (${placeholders})
         AND slug <> ?
         AND canonical_name ${comparison} ?
       ORDER BY canonical_name ${order}
       LIMIT ?`,
    ).bind(PROMOTED_STATUS, ...variants, slug || '', name, limit);

    const [before, after] = await db.batch([side('<', 'DESC'), side('>', 'ASC')]);
    return { before: before?.results || [], after: after?.results || [] };
  } catch (error) {
    console.error('[company-index] siblings lookup failed:', error?.message || error);
    return none;
  }
}

/** Every stored spelling of `province` among promoted rows, by URL slug. */
async function promotedProvinceVariants(db, province) {
  const wanted = nameToSlug(province);
  if (!wanted) return [];
  const counts = await listPromotedProvinceCounts(db);
  return counts
    .map((row) => row.province)
    .filter((stored) => stored && nameToSlug(stored) === wanted);
}
