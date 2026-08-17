/**
 * Pure logic for quality-gated batch promotion of company pages.
 *
 * Batch promotion writes rows into the same D1 `company_index_candidates`
 * table the demand engine uses (status='promoted'), so the existing SSR
 * lookup, noindex lift and /sitemaps/companies/* pagination all apply
 * unchanged. Everything here is deliberately side-effect free so the gate
 * and the generated SQL can be unit-tested; scripts/promote-batch.mjs does
 * the I/O (Elasticsearch, live API verification, wrangler d1 execute).
 */

import { nameToSlug } from '../functions/empresa/_slug.js';
import { SEED } from '../functions/empresa/_ibex35.js';
import { CURATED } from '../functions/empresa/_curated.js';

// Eligibility: the page must have enough substance that Google never sees a
// thin stub. Mirrors the criteria agreed for batch 1: a NIF to show, at least
// one active officer, recorded capital, a real filing history and recent
// registry activity.
export const MIN_PUBLICATIONS = 2;
export const RECENT_ACTIVITY_CUTOFF = '2023-01-01';

/** Normalize one raw ES company doc into the candidate shape used downstream. */
export function candidateFromDoc(doc, id) {
  if (!doc || typeof doc !== 'object') return null;
  const name = doc.company_name || doc.company_name_normalized || '';
  if (!name) return null;
  return {
    group_key: String(id || doc.group_key || ''),
    name,
    slug: nameToSlug(name),
    province: doc.province || null,
    hoja: (doc.hojas || [])[0] || null,
    nif: doc.nif || doc.enriched_nif || null,
    capital: typeof doc.current_capital === 'number' ? doc.current_capital : null,
    active_officers: Array.isArray(doc.officers_active) ? doc.officers_active.length : Number(doc.officers_active_count || 0),
    publications: Number(doc.total_publications || doc.publication_count || 0),
    last_seen: doc.last_seen || doc.last_event_date || null,
    is_dissolved: Boolean(doc.is_dissolved),
  };
}

export function isEligibleCandidate(candidate) {
  if (!candidate) return false;
  if (candidate.is_dissolved) return false;
  if (!candidate.group_key || !candidate.slug) return false;
  if (!candidate.nif) return false;
  if (!(candidate.active_officers >= 1)) return false;
  if (!(typeof candidate.capital === 'number' && candidate.capital > 0)) return false;
  if (!(candidate.publications >= MIN_PUBLICATIONS)) return false;
  if (!candidate.last_seen || String(candidate.last_seen).slice(0, 10) < RECENT_ACTIVITY_CUTOFF) return false;
  return true;
}

/**
 * Rank eligible candidates by capital (largest companies attract the most
 * searches) and resolve slug collisions before anything reaches D1: the
 * promoted-slug unique index allows exactly one group_key per URL, so within
 * the batch the highest-capital company wins its slug and the rest are
 * dropped, not demoted to a different URL.
 */
export function rankAndDedupe(candidates, { size, excludeSlugs = new Set() } = {}) {
  const sorted = [...candidates]
    .filter(isEligibleCandidate)
    .sort((a, b) => (b.capital || 0) - (a.capital || 0));
  const seen = new Set();
  const picked = [];
  for (const candidate of sorted) {
    if (picked.length >= size) break;
    if (excludeSlugs.has(candidate.slug) || seen.has(candidate.slug)) continue;
    seen.add(candidate.slug);
    picked.push(candidate);
  }
  return picked;
}

function sqlString(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * One guarded INSERT per company:
 *  - WHERE NOT EXISTS keeps the statement a no-op if ANOTHER group_key already
 *    owns this promoted slug (organic demand promotions keep priority).
 *  - ON CONFLICT(group_key) upgrades an existing candidate row in place,
 *    preserving its demand counters and original promoted_at.
 * Statements are independent, so a single collision cannot abort the batch.
 */
export function promotionSql(row) {
  const groupKey = sqlString(row.group_key);
  const slug = sqlString(row.slug);
  return `INSERT INTO company_index_candidates
  (group_key, slug, canonical_name, province, hoja, nif, status, promoted_at, validated_at)
SELECT ${groupKey}, ${slug}, ${sqlString(row.name)}, ${sqlString(row.province)}, ${sqlString(row.hoja)}, ${sqlString(row.nif)}, 'promoted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM company_index_candidates
  WHERE slug = ${slug} AND status = 'promoted' AND group_key <> ${groupKey}
)
ON CONFLICT(group_key) DO UPDATE SET
  status = 'promoted',
  slug = excluded.slug,
  canonical_name = excluded.canonical_name,
  province = COALESCE(excluded.province, company_index_candidates.province),
  hoja = COALESCE(excluded.hoja, company_index_candidates.hoja),
  nif = COALESCE(excluded.nif, company_index_candidates.nif),
  promoted_at = COALESCE(company_index_candidates.promoted_at, CURRENT_TIMESTAMP),
  validated_at = CURRENT_TIMESTAMP;`;
}

/** Chunk rows into SQL file bodies small enough for wrangler d1 execute. */
export function promotionSqlChunks(rows, { chunkSize = 400 } = {}) {
  const chunks = [];
  for (let start = 0; start < rows.length; start += chunkSize) {
    chunks.push(rows.slice(start, start + chunkSize).map(promotionSql).join('\n'));
  }
  return chunks;
}

/**
 * Companies that already have a curated indexable page must never enter the
 * batch: they'd render the same entity under a second slug (e.g. seed
 * /empresa/banco-santander vs generated /empresa/banco-santander-sa) —
 * textbook duplicate content. Seeds are excluded by registry identity
 * (hoja → group_key, dash-normalized like handleCompany does) AND by slug;
 * curated entries carry no hoja, so their slugs cover them.
 */
export function reservedIdentities() {
  const groupKeys = new Set(
    Object.values(SEED)
      .filter((entry) => entry.hoja)
      .map((entry) => `H:${entry.hoja.replace(/\s+/g, '-')}`),
  );
  const slugs = new Set([
    ...Object.keys(SEED),
    ...Object.keys(CURATED),
    ...Object.values(SEED).map((entry) => nameToSlug(entry.v3Name)),
    ...Object.values(CURATED).map((entry) => nameToSlug(entry.v3Name)),
  ]);
  return { groupKeys, slugs };
}
