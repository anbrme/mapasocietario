// Client-side gate between what the search API returned and what enters the
// graph: every query term must occur in the company name. Pure.
//
// The comparison runs in analyzer token space (accents folded, punctuation and
// whitespace runs collapsed, lowercase) on BOTH sides. BORME prints most names
// accent-less, so a query typed as "Fábregas" compared with String.includes
// against "BODEGAS FABREGAS SL" used to drop every row the API had found.

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
export const foldForMatch = value =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Every whitespace-separated query term occurs (as a substring) in the name,
 * accents and token order aside. An empty query matches everything.
 * @param {string} name
 * @param {string} query
 * @returns {boolean}
 */
export const matchesAllQueryTerms = (name, query) => {
  const folded = foldForMatch(name);
  return foldForMatch(query)
    .split(' ')
    .filter(Boolean)
    .every(term => folded.includes(term));
};

/**
 * Keep the search results whose `name` (or `company_name`) matches the query.
 * Returns a new array; never mutates the input.
 * @param {Array<{name?: string, company_name?: string}> | null | undefined} results
 * @param {string} query
 */
export const filterByQueryTerms = (results, query) =>
  (results || []).filter(row => matchesAllQueryTerms(row.name || row.company_name || '', query));
