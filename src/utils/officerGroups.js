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
import { organKindFor, ORGAN_KINDS } from './organKinds.js';

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

  // 4) The external auditor and statutory representatives.
  if (category === 'Auditor' || category === 'Representante 143 RRM' || category === 'Apoderado') {
    return 'auditoria_representantes';
  }

  // 5) Everything else — Secretario, Liquidador, unmapped roles.
  return 'otros';
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
  for (const officer of officers || []) {
    const group = officerGroupFor(
      officer.position_normalized || officer.position || '', boardCategories);
    buckets.get(group).push(officer);
  }
  return OFFICER_GROUP_ORDER
    .map(group => [group, collapseGroupByPerson(buckets.get(group), dateKey)])
    .filter(([, rows]) => rows.length > 0);
};
