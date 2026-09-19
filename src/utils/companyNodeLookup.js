// One rule for "is this company already on the canvas?".
//
// Company nodes are keyed on a display name, and the same company reaches the
// graph under several spellings: the v3 doc's canonical dotless form ("FAMILY
// SERVIT SL"), the spelling a socio único act printed ("FAMILY SERVIT SOCIEDAD
// LIMITADA"), the BORME comma form ("BANCO SANTANDER, SA"). Every insert path
// used to compare with a punctuation-only normalization, so a declared owner
// spelled with the long legal form was drawn as a second, hollow node beside
// the real company. entityNameKey folds all of those spellings to one key.

import { entityNameKey } from './companyName';

const COMPANY_NODE_TYPE = 'spanish-company-group';

/**
 * The company node already on the canvas for `name`, or undefined.
 *
 * Matches by exact node id first (the id an insert path would mint), then by
 * legal-form/punctuation-insensitive name among company nodes only — an
 * officer node that happens to carry the company's name (a corporate
 * administrador) is a different node and is never returned.
 *
 * A `group_key` OVERRULES the name. Spanish company names are unique at any
 * one moment, not across time: the registry releases a name once the company
 * is extinguished and a later, unrelated company takes it (PERSONAL FITNESS SL
 * is H:A-141827, dissolved 2018, and H:GC-57012, 2020-2025). Entity assembly
 * already makes that call on the server — temporal compatibility plus a reuse
 * guard — and hands us two docs with two keys. Re-deciding identity here by
 * name alone re-merged what the server deliberately split, inventing one
 * corporate history out of two companies. So when BOTH sides carry a key and
 * the keys differ, this is not the same company. When either side has no key
 * (autocomplete rows and declared owners often don't), the name rule stands.
 *
 * @param {Array<{id: string, name?: string, type?: string, groupKey?: string}>} nodes
 * @param {string} name
 * @param {string|null} [id] - the id the caller would assign if inserting.
 * @param {string|null} [groupKey] - the v3 group_key of the company being looked up.
 * @returns {object|undefined}
 */
export const findCompanyNode = (nodes, name, id = null, groupKey = null) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return undefined;
  if (id) {
    const byId = nodes.find(n => n?.id === id);
    if (byId) return byId;
  }
  const key = entityNameKey(name);
  if (!key) return undefined;
  return nodes.find(
    n =>
      n?.type === COMPANY_NODE_TYPE &&
      entityNameKey(n.name) === key &&
      !(groupKey && n.groupKey && n.groupKey !== groupKey)
  );
};

export default findCompanyNode;
