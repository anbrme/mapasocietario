// Autocomplete entity dedupe. The dropdown mixes two backends that spell the
// same corporate entity differently: the company directory serves the
// canonical dotless legal form ("... SL") while officers-autocomplete serves
// the raw BORME spelling ("... SOCIEDAD LIMITADA"). Without this, one entity
// shows up as two rows (a company and an "officer") that lead to two
// disconnected graph nodes.
import { canonLegalForm } from './companyName';

// Same fold as the backend's name_fold_key: canonicalize the trailing legal
// form FIRST ("S.A" → "SA" — token-splitting alone would leave "S A"), then
// compare in analyzer token space (accents folded, punctuation/whitespace
// runs collapsed). The canonical company name may keep BORME punctuation
// ("BANCO SANTANDER, SA") that officer spellings lack.
const entityKey = name =>
  canonLegalForm((name || '').trim())
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/**
 * Fold officer suggestions into their company twins.
 *
 * An officer row whose canonical entity name matches a listed company row is
 * dropped, and the company row inherits its cargo count (`company_count`,
 * which already drives the "N empresas (cargo)" subtitle) unless the company
 * row carries one of its own. Officer rows without a company twin pass
 * through unchanged; company order is preserved.
 *
 * Pass the DISPLAYED company slice, not the raw list — an officer row must
 * survive when its company twin was capped out of the dropdown, or the
 * entity would disappear entirely.
 *
 * @param {Array<{name: string}>} companyItems
 * @param {Array<{name: string, company_count?: number}>} officerItems
 * @returns {{companies: Array, officers: Array}}
 */
export const mergeEntitySuggestions = (companyItems, officerItems) => {
  const companies = Array.isArray(companyItems) ? [...companyItems] : [];
  const officers = [];

  const byKey = new Map();
  companies.forEach((item, index) => {
    const key = entityKey(item && item.name);
    if (key && !byKey.has(key)) byKey.set(key, index);
  });

  for (const item of Array.isArray(officerItems) ? officerItems : []) {
    const index = byKey.get(entityKey(item && item.name));
    if (index === undefined) {
      officers.push(item);
      continue;
    }
    const twin = companies[index];
    if (twin.company_count == null && item && item.company_count != null) {
      companies[index] = { ...twin, company_count: item.company_count };
    }
  }

  return { companies, officers };
};

export default mergeEntitySuggestions;
