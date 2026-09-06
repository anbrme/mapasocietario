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
 * @param {Array<{id: string, name?: string, type?: string}>} nodes
 * @param {string} name
 * @param {string|null} [id] - the id the caller would assign if inserting.
 * @returns {object|undefined}
 */
export const findCompanyNode = (nodes, name, id = null) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return undefined;
  if (id) {
    const byId = nodes.find(n => n?.id === id);
    if (byId) return byId;
  }
  const key = entityNameKey(name);
  if (!key) return undefined;
  return nodes.find(n => n?.type === COMPANY_NODE_TYPE && entityNameKey(n.name) === key);
};

export default findCompanyNode;
