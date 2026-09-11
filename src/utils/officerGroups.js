// Bucket officer rows into display groups, one row per PERSON per group.
//
// The port of officer_display.py's _group_for_position / _collapse_group_by_person
// (ncdata-bormes), so the /empresa page and the DD report describe a board the
// same way. Keep the two in lockstep.
//
// Two rules do the work:
//
// 1. An organ role is grouped by WHICH organ. Every organ role folds into the
//    BOARD seat, and the position category alone cannot tell a committee OF the
//    board from an organ that is not a board at all — so a comisión de control
//    or liquidadora would otherwise be reported as a directorship. See
//    organKinds.js.
//
// 2. Within a group, a person is ONE row. Someone can hold a board title, a
//    vicesecretaryship and three committee seats at one company; listing each
//    as its own row inflates the board, and the row count is how a reader
//    counts it. Collapsing is WITHIN a group, never across: a director who
//    also sits on a committee appears once under the board and once under
//    committees, which is the point.
import { positionCategoryFor } from './positionCategories.js';
import { organKindFor, ORGAN_KINDS, impliesDirectorship } from './organKinds.js';
import { isCorporateName } from './legalEntity.js';

/** Display order. Board first, then how the board organises itself, then the
 *  roles that are not board seats at all. */
export const OFFICER_GROUP_ORDER = Object.freeze([
  'consejo',
  'comisiones',
  'direccion',
  'auditoria_representantes',
  'otros',
]);

// NON-board executive-delegation roles (director general / alta dirección /
// gerente) that positionCategoryFor folds into 'Otros'. Matched by substring on
// the BORME abbreviation, the same technique the backend uses. Consejero
// Delegado forms never reach this list — they are consejeros, caught by the
// board check above it.
const DELEGATED_EXEC_TOKENS = [
  'DIRECTOR GENERAL', 'DIRECTORA GENERAL', 'DIRECCION GENERAL', 'DIRECTOR GRAL',
  'DIR. GRAL', 'DIR.GRAL', 'DIR GRAL', 'DTOR. GRAL', 'DTOR.GRAL', 'DTOR GRAL',
  'DIR. GENERAL', 'ALTA DIRECCION', 'DELEGAD',
];

// The categories whose holders hold a company-level governing-body seat, as the
// DD report defines it. Exported and overridable because /empresa's board table
// answers a slightly different question — see PAGE_BOARD_CATEGORIES there.
export const BOARD_CATEGORIES = Object.freeze(new Set([
  'Presidente',
  'Vicepresidente',
  'Consejero',
  'Administrador',
]));

/**
 * The display group one raw position belongs to.
 *
 * @param {string} pos - raw registry position ("MBRO.COM.AUD", "VOCAL 3").
 * @param {Set<string>} [boardCategories] - which position categories count as a
 *   board seat. Defaults to the DD report's four governing-body offices.
 * @returns {string} a member of OFFICER_GROUP_ORDER.
 */
export const officerGroupFor = (pos, boardCategories = BOARD_CATEGORIES) => {
  const p = (pos || '').trim().toUpperCase();
  const category = positionCategoryFor(p);

  // 1) Organ roles, split by which organ.
  const kind = organKindFor(p);
  if (kind === ORGAN_KINDS.BOARD_COMMITTEE || kind === ORGAN_KINDS.OTHER_ORGAN) {
    return 'comisiones';
  }
  // A comisión de control / liquidadora / de acreedores, or a seat held
  // expressly as a non-consejero. Not board work — and intercepting them here
  // is what keeps them out of the board check below.
  if (kind && kind !== ORGAN_KINDS.GOVERNING_BODY && kind !== ORGAN_KINDS.PLAIN_VOCAL) {
    return 'otros';
  }

  // 2) Any board-seat holder. GOVERNING_BODY and PLAIN_VOCAL reach here on
  //    purpose: a consejo rector IS the board, and a vocal is a consejero.
  if (boardCategories.has(category) || kind) return 'consejo';

  // 3) Non-board executive delegation — only for roles the classifier left
  //    unmapped. Without that guard the bare token DELEGAD also claims
  //    LIQ.DELEGADO, and a liquidador delegado is winding the company up, not
  //    running it.
  if (category === 'Otros' && DELEGATED_EXEC_TOKENS.some(tok => p.includes(tok))) {
    return 'direccion';
  }

  // 4) The external auditor and statutory representatives. A representative
  //    reaches this line only when pairRepresentatives143 could not place them
  //    (several corporate officers, or several representatives); a paired one
  //    has already folded into the officer's row, and one standing alone is
  //    routed to the board by groupOfficersForDisplay before this is asked.
  if (category === 'Auditor' || category === REP143_CATEGORY || category === 'Apoderado') {
    return 'auditoria_representantes';
  }

  // 5) Everything else — Secretario, Liquidador, unmapped roles.
  return 'otros';
};

export const REP143_CATEGORY = 'Representante 143 RRM';

// Every category that folds into the backend's BOARD seat: the four offices
// plus organ roles. A representative is seated on the board alone only when
// nobody in the table holds one of these.
const BOARD_SEAT_CATEGORIES = new Set([...BOARD_CATEGORIES, 'Vocal / Comisión']);

/** A corporate name reduced to a comparison key: accents, case and punctuation
 *  dropped, the same fold officer_display.py uses, so "ADLID, S.L." and
 *  "ADLID SL" count as one officer on both surfaces. */
const corporateKeyName = name =>
  (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const positionOf = officer => officer.position_normalized || officer.position || '';

/** Distinct corporate names among `rows`, keyed by corporateKeyName. */
const corporateNames = (rows, isCorporate) => new Set(
  rows
    .map(o => o.name || o.name_normalized)
    .filter(isCorporate)
    .map(corporateKeyName),
);

/**
 * Pair each Art. 143 RRM representative with the corporate officer they act
 * for — when, and only when, the table leaves no room for doubt.
 *
 * The representative is the natural person who exercises the office when a
 * COMPANY is appointed administrator (art. 143 RRM). BORME publishes them as
 * a row of their own and never says whom they represent, so the link is our
 * inference. The rule, over one table's rows:
 *
 * - exactly one corporate director and exactly one representative: the
 *   representative folds into the director's row(s) as `representative`;
 * - no corporate director, exactly one corporate liquidator and one
 *   representative: the same, on the liquidator's row — a liquidator is not
 *   a board seat, so the representative follows it wherever it is filed;
 * - no corporate director, no corporate liquidator, and nobody holding a
 *   board seat at all: the representative is the only trace of the
 *   administration we hold and is flagged `representativeAlone` so the
 *   grouping seats them on the board. With natural-person directors on the
 *   table they are not the only trace, and are listed as a representative
 *   like any other unpaired one;
 * - anything else (several of either, or a count that is not 1:1) is
 *   ambiguous: rows are returned untouched and the representative is listed
 *   as a representative, not a director.
 *
 * A corporate officer's name is not guaranteed to be spelled the same on
 * every row; variants that survive corporateKeyName count as two officers,
 * which loses a pairing but never invents one.
 *
 * Mirror of pair_representatives_143 in officer_display.py (ncdata-bormes).
 *
 * @param {object[]} officers - one table's rows (active OR ceased).
 * @param {object} [options]
 * @param {(name: string) => boolean} [options.isCorporate] - the entity test.
 * @returns {object[]} a new array; input rows are never mutated.
 */
export const pairRepresentatives143 = (officers, { isCorporate = isCorporateName } = {}) => {
  const rows = officers || [];
  const isRepresentative = o => positionCategoryFor(positionOf(o)) === REP143_CATEGORY;
  const representatives = rows.filter(isRepresentative);
  if (representatives.length === 0) return rows;

  const directors = corporateNames(
    rows.filter(o => BOARD_CATEGORIES.has(positionCategoryFor(positionOf(o)))), isCorporate);
  const liquidators = corporateNames(
    rows.filter(o => positionCategoryFor(positionOf(o)) === 'Liquidador'), isCorporate);

  const target = directors.size > 0 ? directors : liquidators;
  if (target.size === 0) {
    if (rows.some(o => BOARD_SEAT_CATEGORIES.has(positionCategoryFor(positionOf(o))))) return rows;
    return rows.map(o => (isRepresentative(o) ? { ...o, representativeAlone: true } : o));
  }
  if (target.size !== 1 || representatives.length !== 1) return rows;

  const [targetKey] = target;
  const representative = representatives[0];
  const targetCategories = directors.size > 0 ? BOARD_CATEGORIES : new Set(['Liquidador']);
  const isTarget = o =>
    targetCategories.has(positionCategoryFor(positionOf(o))) &&
    corporateKeyName(o.name || o.name_normalized) === targetKey;
  return rows
    .filter(o => o !== representative)
    .map(o => (isTarget(o) ? { ...o, representative } : o));
};

/** A person's name reduced to a comparison key: accents folded, case dropped. */
const displayKeyName = name =>
  (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Collapse rows for the same person within one group into a single row.
 *
 * The merged row keeps the first row's fields, gathers the person's DISTINCT
 * raw positions in order under `positions`, and takes the EARLIEST of the
 * relevant dates — "on the board since", not "most recently re-elected".
 *
 * @param {object[]} rows
 * @param {string} dateKey - which date field to fold ('appointed_date'…).
 */
export const collapseGroupByPerson = (rows, dateKey) => {
  const merged = new Map();
  for (const officer of rows) {
    const key = displayKeyName(officer.name || officer.name_normalized);
    if (!merged.has(key)) merged.set(key, { ...officer, positions: [] });
    const row = merged.get(key);
    const rawPos = (officer.position_normalized || officer.position || '').trim();
    if (rawPos && !row.positions.some(p => p.toUpperCase() === rawPos.toUpperCase())) {
      row.positions = [...row.positions, rawPos];
    }
    const date = officer[dateKey];
    if (date && (!row[dateKey] || String(date) < String(row[dateKey]))) {
      row[dateKey] = date;
    }
  }
  return [...merged.values()];
};

/**
 * Group officer rows for display: one row per person per group, in
 * OFFICER_GROUP_ORDER. Empty groups are omitted.
 *
 * @param {object[]} officers
 * @param {string} dateKey - the date field to fold when collapsing.
 * @param {Set<string>} [boardCategories] - see officerGroupFor.
 * @returns {Array<[string, object[]]>} [group, rows] pairs.
 */
export const groupOfficersForDisplay = (officers, dateKey, boardCategories) => {
  const buckets = new Map(OFFICER_GROUP_ORDER.map(g => [g, []]));
  // Art. 143 RRM representatives fold into the corporate officer they act for
  // before anything is grouped, so they never add a row to the board. The one
  // exception is a representative with no corporate officer to attach to —
  // the only trace of the administration we hold — who is seated on the board.
  for (const officer of pairRepresentatives143(officers)) {
    const group = officer.representativeAlone
      ? 'consejo'
      : officerGroupFor(positionOf(officer), boardCategories);
    buckets.get(group).push(officer);
  }

  // A committee OF the board may only be held by a sitting consejero, so its
  // members are directors even when no separate board office is inscribed for
  // them. Sending those seats to 'comisiones' and nowhere else dropped such a
  // person out of the board table altogether: BORME revoked DAGA GELABERT
  // TOMAS's CONS.OTR.EXT at GRIFOLS SA on 2024-02-23, never inscribed a
  // re-appointment, and put him back on the nominations committee on
  // 2025-08-01 — so the page listed eleven directors and left out the twelfth.
  //
  // impliesDirectorship is the authority on which organ seats do this, and it
  // is default-deny: a comisión de control, a liquidadora, a comisión de
  // acreedores, a seat held expressly as a non-consejero, and every ad-hoc
  // committee we cannot place all answer false and stay out of the board.
  const boardKeys = new Set(
    buckets.get('consejo').map(o => displayKeyName(o.name || o.name_normalized)));
  const impliedDirectors = buckets.get('comisiones')
    .filter(o => impliesDirectorship(o.position_normalized || o.position || ''))
    .filter(o => !boardKeys.has(displayKeyName(o.name || o.name_normalized)))
    // Flagged so the renderer can say "Consejero (Miembro de la Comisión de X)"
    // — the directorship follows from the committee seat, and the page should
    // show the reader which seat it follows from rather than inventing a title
    // the registry has not inscribed.
    .map(o => ({ ...o, impliedDirectorship: true }));

  const grouped = new Map(buckets);
  grouped.set('consejo', [...buckets.get('consejo'), ...impliedDirectors]);

  return OFFICER_GROUP_ORDER
    .map(group => [group, collapseGroupByPerson(grouped.get(group), dateKey)])
    .filter(([, rows]) => rows.length > 0);
};
