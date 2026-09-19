/**
 * Looking up an officer who exists under more than one spelling.
 *
 * BORME publishes no person identifier, so for a person the NAME *is* the
 * identity. The registry prints the same human several ways — a surname comma,
 * a hyphen that may or may not belong to a compound surname
 * ("LOPEZ-MIRANDA" vs "LOPEZ MIRANDA"), a rotated name order. When the user
 * joins two such nodes, `mergeNodes` keeps every spelling on the survivor in
 * `nameVariants` precisely so the record can still be queried under all of
 * them.
 *
 * A lookup that queries only the survivor's name therefore returns an
 * INCOMPLETE record: the seats filed under the absorbed spelling are silently
 * missing, and nothing on screen says so. That is worse than an empty result,
 * because the canvas then draws less than its own preview panel, which has
 * always queried every variant.
 *
 * This module is the one place that decides which names to ask for and how to
 * combine the answers, so the graph expansion, the preview panel, the cargo
 * unify and the timeline cannot drift apart again — the same reasoning that
 * keeps name normalization in companyName.js.
 *
 * Distinct from officerNameVariants.js, which decides whether two spellings
 * are the same person from registry EVIDENCE. Here the user has already
 * asserted the identity by merging; this module only fans the lookup out.
 */

/**
 * Every spelling an officer node should be queried under: the node's own name
 * first, then the spellings merged into it. Case-insensitively deduplicated
 * and trimmed, so a merge that recorded the same name twice costs one request,
 * not two.
 *
 * @param {{name?: string, nameVariants?: string[]}|null} node
 * @returns {string[]} primary name first; empty when the node has no usable name
 */
export const officerQueryNames = node => {
  const variants = Array.isArray(node?.nameVariants) ? node.nameVariants : [];
  const names = [];
  const seen = new Set();
  [node?.name, ...variants].forEach(candidate => {
    const value = typeof candidate === 'string' ? candidate.trim() : '';
    if (!value) return;
    const key = value.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(value);
  });
  return names;
};

/**
 * Identity of one appointment row, for combining the answers from several
 * spellings. Two spellings of one person return the SAME seat, so without this
 * a merged node would draw every shared company twice.
 *
 * Falls through the company and role spellings the v3 payload actually uses
 * (`company_name | company | name`, `specific_role | position`): a row missing
 * `company_name` must still key on the company it names, or unrelated rows
 * collapse into a single blank-company key.
 *
 * @param {object} record an expandOfficerV3 officers[] row
 * @returns {string}
 */
export const officerRecordKey = record => {
  const company = (record?.company_name || record?.company || record?.name || '')
    .trim().toUpperCase();
  const role = (record?.specific_role || record?.position || '').trim().toUpperCase();
  const date = record?.date || record?.event_date || '';
  return `${company}|${role}|${date}`;
};

/**
 * Flatten appointment lists, keeping the first occurrence of each seat.
 *
 * @param {Array<object[]|null|undefined>} recordLists one list per spelling
 * @returns {object[]}
 */
export const dedupeOfficerRecords = recordLists => {
  const out = [];
  const seen = new Set();
  (recordLists || []).forEach(list => {
    (list || []).forEach(record => {
      const key = officerRecordKey(record);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(record);
    });
  });
  return out;
};

/**
 * Query an officer's record under every spelling and combine the results.
 *
 * The fetcher is injected so this stays testable without the HTTP layer, and
 * so the same combining rule serves expansion, the preview panel and the
 * timeline. One spelling failing must not lose the seats the others returned:
 * a rejected lookup contributes nothing and is reported through `onError`.
 *
 * @param {string[]} names from officerQueryNames
 * @param {(name: string) => Promise<{success?: boolean, officers?: object[]}>} fetchOne
 * @param {{onError?: (name: string, error: Error) => void}} [options]
 * @returns {Promise<{officers: object[], contributingNames: string[], queriedNames: string[]}>}
 *   `contributingNames` are the spellings that actually returned a seat — the
 *   basis for telling the user we covered more than one, which must never be
 *   claimed for a spelling that returned nothing.
 */
export const fetchOfficerRecordsForNames = async (names, fetchOne, options = {}) => {
  const queriedNames = Array.isArray(names) ? names.filter(Boolean) : [];
  if (queriedNames.length === 0) {
    return { officers: [], contributingNames: [], queriedNames: [] };
  }
  const lists = await Promise.all(
    queriedNames.map(async name => {
      try {
        const data = await fetchOne(name);
        return data?.success && Array.isArray(data.officers) ? data.officers : [];
      } catch (error) {
        options.onError?.(name, error);
        return [];
      }
    })
  );
  return {
    officers: dedupeOfficerRecords(lists),
    contributingNames: queriedNames.filter((_, index) => lists[index].length > 0),
    queriedNames,
  };
};
