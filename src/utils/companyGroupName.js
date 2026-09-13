// One rule for "under which display name does this company enter the graph?".
//
// A company reaches the canvas under the name its v3 document carries, EXCEPT
// when a name change folds it: the loader fetches the old and the new
// denomination together and hands the graph an alias map, and the pair must
// become one node under the CURRENT name. That fold decides the node's label
// and therefore its id, so the loader has to derive it the same way the insert
// path does — hence one shared helper rather than two copies drifting apart.

import { normalizeCompanyName } from './companyName';

/**
 * The display name `rawName` is grouped under.
 *
 * With no alias map (the common case) this is just the normalized name. When
 * the map folds `rawName` into another denomination, a sibling entry spelling
 * that denomination wins (it carries the nicer casing the API returned) and the
 * map's own uppercase value is the fallback.
 *
 * @param {string} rawName - the entry's name, already defaulted by the caller.
 * @param {Array<{name?: string, company_name?: string}>} entries - every entry in the same insert.
 * @param {Map<string, string>|null} [aliasMap] - UPPERCASE normalized old name -> UPPERCASE normalized new name.
 * @returns {string}
 */
export const resolveCompanyGroupName = (rawName, entries, aliasMap = null) => {
  const cleanName = normalizeCompanyName(rawName || '');
  if (!aliasMap) return cleanName;

  const resolved = aliasMap.get(cleanName.toUpperCase());
  if (!resolved) return cleanName;

  const newNameEntry = (entries || []).find(
    c => normalizeCompanyName(c?.name || c?.company_name || '').toUpperCase() === resolved
  );
  return newNameEntry
    ? normalizeCompanyName(newNameEntry.name || newNameEntry.company_name)
    : resolved;
};

export default resolveCompanyGroupName;
