import { SEED } from './_ibex35.js';
import { CURATED } from './_curated.js';

/**
 * Classify a company slug against the curated maps. Pure (no network).
 * @returns {{kind:'seed'|'curated'|'notfound', entry:object|null}}
 */
export function resolveSlug(slug) {
  const key = String(slug || '').toLowerCase();
  if (SEED[key])    return { kind: 'seed',    entry: SEED[key] };
  if (CURATED[key]) return { kind: 'curated', entry: CURATED[key] };
  return { kind: 'notfound', entry: null };
}
