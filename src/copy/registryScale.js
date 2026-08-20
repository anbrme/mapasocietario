/**
 * The scale-of-coverage figures quoted in landing copy, the FAQ, the FAQPage
 * JSON-LD and llms.txt.
 *
 * They used to be hand-typed in each of those places and drifted apart: the
 * English FAQ claimed 3.2 million companies while the Spanish FAQ claimed 3,1
 * millones — in the same file — and llms.txt claimed 9.4M filings against a
 * true 9.57M. A reader comparing two pages saw the product contradict itself.
 *
 * One source now, derived from the live index at build time. Every surface
 * reads from here; none restates a number.
 */
import { REGISTRY_SCALE_RAW } from './registryScaleData.js';

/**
 * Rounded to one decimal because these are scale claims, not counts, and a
 * figure that moves daily should not read as exact. Spanish uses the decimal
 * comma.
 *
 * @param {number} n
 * @param {'en'|'es'} lang
 * @returns {string}
 */
const inMillions = (n, lang) => {
  const rounded = (Math.round(n / 100_000) / 10).toFixed(1);
  return lang === 'es' ? rounded.replace('.', ',') : rounded;
};

/**
 * @param {'en'|'es'} lang
 * @returns {{companies: string, filings: string, officerChanges: string, constitutions: string}}
 */
export const registryScale = (lang = 'en') => ({
  companies: inMillions(REGISTRY_SCALE_RAW.totalCompanies, lang),
  filings: inMillions(REGISTRY_SCALE_RAW.totalEvents, lang),
  officerChanges: inMillions(REGISTRY_SCALE_RAW.officerChanges, lang),
  constitutions: inMillions(REGISTRY_SCALE_RAW.constitutions, lang),
});

export { REGISTRY_SCALE_RAW };
