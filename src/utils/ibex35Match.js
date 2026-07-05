import { SEED, V3_TO_SLUG } from '../../functions/empresa/_ibex35.js';

// Resolves a BORME/v3 company name to its IBEX 35 SEED entry, or null if the
// company is not one of the curated IBEX 35 seed entries. V3_TO_SLUG keys are
// the exact, already-uppercase v3Name strings verified against api.ncdata.eu.
export function matchIbexSeed(companyName) {
  if (!companyName) return null;
  const normalized = String(companyName).trim().toUpperCase();
  const slug = V3_TO_SLUG[normalized];
  if (!slug) return null;
  return SEED[slug] || null;
}
