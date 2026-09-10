/**
 * Deciding whether two role labels name the SAME seat.
 *
 * An officer can hold several posts at one company with independent status, so
 * a registry act published for one of them must never move another. Matching
 * used to run at position-CATEGORY granularity, which is far too coarse where
 * it matters most: DAGA GELABERT TOMAS holds six roles at GRIFOLS SA, three of
 * them ("M.COM.NOM.RE", "MBRO.COM.AUD", "SEC.COM.AUD.") in the single category
 * "Vocal / Comisión". His 2025-08-01 re-appointment to the nominations
 * committee was therefore the latest act of that category for all three, and
 * two seats BORME had revoked were drawn as live.
 *
 * Both stores publish the same BORME cargo token — borme_events_v3 and the
 * aggregated expand-officer index each carry "M.COM.NOM.RE" verbatim — so an
 * exact key is viable. It is not sufficient on its own: registry abbreviations
 * drift across filings ("CONS. DELEG." / "CON.DELEGADO"), and a seat whose act
 * fails to match keeps the aggregate's older word, which is its own kind of
 * wrong.
 *
 * Hence two tiers:
 *   1. exact — same normalised token, always attaches;
 *   2. category — only when the seat is the ONLY one of its category on that
 *      officer-company pair, so there is nothing it could be confused with.
 *
 * The rule this encodes: an act may override a seat's recorded status only when
 * we can tell WHICH seat it belongs to. Otherwise the aggregation keeps its
 * say. That is the same direction of caution as the closed-seat guard in
 * officerLinkStatus.effectiveCategoryFromEvents, and the same exact-then-
 * category shape already used to pick officer name variants.
 */
// Extension required: this module is loaded by the /empresa Pages Function and
// by the node:test suite, neither of which resolves extensionless imports.
import { positionCategoryFor, sameRoleCategory } from './positionCategories.js';

/**
 * A role label reduced to its comparable core: accents folded, case dropped,
 * every separator removed. "SEC.COM.AUD." and "SEC COM AUD" are one seat;
 * "MBRO.COM.AUD" is not.
 */
export const roleKey = role =>
  (role || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

/**
 * True when `role` is the only seat of its category in `pool` — i.e. an act of
 * that category can be assigned to it without guessing.
 *
 * @param {string[]} pool - every role held on this officer-company pair.
 * @param {string} role   - the seat being matched against.
 */
export const isCategoryUnambiguous = (pool, role) => {
  const category = positionCategoryFor(role);
  const keys = new Set();
  (pool || []).forEach(candidate => {
    if (positionCategoryFor(candidate) === category) keys.add(roleKey(candidate));
  });
  return keys.size <= 1;
};

/**
 * Does an act published as `eventRole` belong to the seat labelled `linkRole`?
 *
 * @param {string} eventRole - the role on the incoming registry act.
 * @param {string} linkRole  - the role of the seat being tested.
 * @param {string[]} pool    - every role held on this officer-company pair,
 *   which is what makes a category fallback safe or unsafe.
 */
export const matchesRole = (eventRole, linkRole, pool) => {
  const eventKey = roleKey(eventRole);
  const linkKey = roleKey(linkRole);
  if (eventKey && eventKey === linkKey) return true;
  if (!sameRoleCategory(eventRole, linkRole)) return false;
  return isCategoryUnambiguous(pool, linkRole);
};
