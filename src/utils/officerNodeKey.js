// Officer graph-node identity. One person or corporate officer must map to ONE
// node regardless of how the source spelled them:
//   - trailing legal form: autocomplete serves the raw BORME spelling
//     ("... SOCIEDAD LIMITADA") while the v3 directory serves the canonical
//     dotless form ("... SL");
//   - filing order: BORME prints the same person both ways — FERNANDO ESPAÑA
//     Y SENIOR GRANADA SL lists "JOSE GABINO SANCHEZ DELGADO", VITALSERVIT SL
//     lists "SANCHEZ DELGADO JOSE GABINO".
// Extracted from SpanishCompanyNetworkGraph.jsx so the identity rule is
// testable and shared.
import { canonLegalForm, isSameUnifiableEntity, LEGAL_FORM_CODES } from './companyName';

const OFFICER_NODE_TYPE = 'officer';

export const officerNodeKey = name =>
  canonLegalForm((name || '').trim())
    .toLowerCase()
    .replace(/[\s-]+/g, '-');

export const officerIdFor = name => `officer-${officerNodeKey(name)}`;

// Filing-order rotation — a JS port of officer_query.py::_rotation_variants,
// the rule expand-officer and the officer autocomplete already match by.
// Keep the two in sync.
//
// Rotation, deliberately NOT a token sort: Spanish surname ORDER carries
// identity. "GARCIA MARTIN JOSE" (Jose Garcia Martin) and "MARTIN GARCIA JOSE"
// (Jose Martin Garcia) are two men, and sorting merges them. Moving the
// leading one or two tokens to the end (and the trailing one or two to the
// front) covers given-name-first vs surname-first for one- and two-token given
// names while leaving the surname sequence intact.
const GIVEN_NAME_MAX_TOKENS = 2; // "JOSE", "JOSE MANUEL"
const ROTATION_MIN_TOKENS = 2; // "GARCIA JOSE" <-> "JOSE GARCIA"
const ROTATION_MAX_TOKENS = 6; // beyond this a name is corporate or garbage

/**
 * True when the name ends in a legal form — a company acting as officer.
 * Those must not be rotated: the rotations are meaningless as company names
 * and only risk colliding with a genuinely different entity.
 * @param {string} name
 * @returns {boolean}
 */
export const isCorporateOfficerName = name => {
  const tokens = canonLegalForm((name || '').toUpperCase()).split(/\s+/).filter(Boolean);
  return tokens.length > 0 && LEGAL_FORM_CODES.has(tokens[tokens.length - 1]);
};

/**
 * Given-name-first <-> surname-first spellings of one person name.
 * @param {string} name
 * @returns {string[]} the rotations, in the backend's order, without `name`.
 */
export const officerNameRotations = name => {
  const tokens = (name || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < ROTATION_MIN_TOKENS || tokens.length > ROTATION_MAX_TOKENS) return [];
  if (isCorporateOfficerName(name)) return [];
  const rotated = [];
  for (let n = 1; n <= GIVEN_NAME_MAX_TOKENS && n < tokens.length; n++) {
    const forms = [
      [...tokens.slice(n), ...tokens.slice(0, n)].join(' '), // leading -> end
      [...tokens.slice(-n), ...tokens.slice(0, -n)].join(' '), // trailing -> front
    ];
    forms.forEach(form => {
      if (!rotated.includes(form)) rotated.push(form);
    });
  }
  return rotated;
};

/**
 * Every node key the officer `name` answers to: its own, plus its filing-order
 * rotations.
 * @param {string} name
 * @returns {string[]}
 */
const officerNodeKeys = name => {
  const own = officerNodeKey(name);
  if (!own) return [];
  return [own, ...officerNameRotations(name).map(officerNodeKey)];
};

/**
 * Are these two officer spellings the same person (or corporate officer)?
 * Legal-form spellings fold via officerNodeKey; filing orders via rotation.
 * @param {string} nameA
 * @param {string} nameB
 * @returns {boolean}
 */
export const isSameOfficerName = (nameA, nameB) => {
  const keyB = officerNodeKey(nameB);
  return !!keyB && officerNodeKeys(nameA).includes(keyB);
};

/**
 * The officer node already on the canvas for `name`, or undefined. Exact key
 * first (so a node that carries this very spelling always wins), then any
 * filing-order rotation. Company nodes are never returned.
 * @param {Array<{id: string, name?: string, type?: string}>} nodes
 * @param {string} name
 * @returns {object|undefined}
 */
export const findOfficerNode = (nodes, name) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return undefined;
  const keys = officerNodeKeys(name);
  if (keys.length === 0) return undefined;
  const officers = nodes.filter(n => n?.type === OFFICER_NODE_TYPE);
  for (const key of keys) {
    const hit = officers.find(n => officerNodeKey(n.name) === key);
    if (hit) return hit;
  }
  return undefined;
};

/**
 * The id an officer named `name` has on this canvas: the existing node's id
 * under any spelling, else the id minted for this spelling.
 * @param {Array} nodes
 * @param {string} name
 * @returns {string}
 */
export const resolveOfficerNodeId = (nodes, name) =>
  findOfficerNode(nodes, name)?.id || officerIdFor(name);

/**
 * Does a registry row naming `rowName` belong to the officer `officerName`?
 * The union of both identity rules: entity folding (legal form, punctuation,
 * curated listed-entity alias) for corporate officers, filing-order rotation
 * for people. This is the expand-officer exact-match predicate.
 * @param {string} rowName
 * @param {string} officerName
 * @returns {boolean}
 */
export const isSameOfficerIdentity = (rowName, officerName) =>
  isSameUnifiableEntity(rowName, officerName) || isSameOfficerName(rowName, officerName);
