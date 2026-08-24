/**
 * Close a seat whose cese BORME printed under a variant spelling.
 *
 * The aggregation matches an officer's seats by exact name. SANTANDER
 * BACK-OFFICES GLOBALES MAYORISTAS SA appointed its chairman as
 * "HAJJAJI ABDELKRIM" (2016, re-elected 2021) and ceased him on 2026-06-02 as
 * "HAJJAJI ABDEL KARIM": the doc kept the first spelling active and recorded a
 * cese for a second spelling that had never been appointed. Every surface that
 * read the doc then named a ceased chairman as current.
 *
 * BORME carries no person id, so two spellings can only ever be joined by
 * evidence, and this module admits one narrow case: within ONE company and
 * ONE seat, a cese under a spelling that
 *   - differs from an active seat's spelling by at most one letter once the
 *     spaces are removed (a transliteration: ABDELKRIM / ABDEL KARIM), with the
 *     same leading surname and a name long enough for one edit to be noise,
 *   - was never itself appointed (no nombramiento / reelección under that
 *     spelling in the filings), so the cese is an orphan the exact match could
 *     not place,
 *   - holds no active seat of its own,
 *   - is dated on or after the appointment it would close,
 *   - and is a variant of exactly one active officer (ambiguity ⇒ untouched)
 * closes that seat. The row keeps the appointment spelling and records the
 * spelling the cese was printed under (`ceased_as`), so the reader can check
 * the join against the filing. A cese may only CLOSE an existing seat; nothing
 * here ever creates one. Pure: the input doc is never mutated.
 */
// Extension required: also loaded by the /empresa Pages Function and node:test.
import { sameRoleCategory } from './positionCategories.js';
import { nameKey } from './pendingOfficerEvents.js';

// Below this many letters a one-letter edit separates people ("PEREZ ANA" /
// "PEREZ ANNA"), not spellings of one person.
const MIN_COMPACT_LENGTH = 10;
const MAX_EDIT_DISTANCE = 1;

const compact = key => key.replace(/ /g, '');
const leadingSurname = key => key.split(' ')[0] || '';
const roleOf = officer => officer?.position_normalized || officer?.position || '';

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > MAX_EDIT_DISTANCE) return MAX_EDIT_DISTANCE + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
};

/**
 * Are these two DIFFERENT spellings close enough to be one person's name?
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export const isSpellingVariant = (a, b) => {
  const keyA = nameKey(a);
  const keyB = nameKey(b);
  if (!keyA || !keyB || keyA === keyB) return false;
  if (leadingSurname(keyA) !== leadingSurname(keyB)) return false;
  const compactA = compact(keyA);
  const compactB = compact(keyB);
  if (compactA === compactB) return true;
  if (Math.min(compactA.length, compactB.length) < MIN_COMPACT_LENGTH) return false;
  return levenshtein(compactA, compactB) <= MAX_EDIT_DISTANCE;
};

const isAppointmentAct = eventType => /nombr|reelecc/i.test(eventType || '');

/** Every spelling the filings ever appointed (or re-elected). */
const appointedSpellings = events => {
  const keys = new Set();
  (Array.isArray(events) ? events : []).forEach(event => {
    (event?.officers || []).forEach(officer => {
      if (isAppointmentAct(officer.event_type) && officer.name) keys.add(nameKey(officer.name));
    });
  });
  return keys;
};

const closesSeat = (seat, cese) =>
  !seat.appointed_date || !cese.resigned_date || cese.resigned_date >= seat.appointed_date;

// Exact seat title first; the role family only when no row carries the title.
const pickTwin = (seat, candidates) => {
  const exact = candidates.filter(({ row }) => roleOf(row) === roleOf(seat));
  const pool = exact.length ? exact : candidates.filter(({ row }) => sameRoleCategory(roleOf(seat), roleOf(row)));
  if (!pool.length) return null;
  return pool.slice().sort((x, y) => String(y.row.resigned_date || '').localeCompare(String(x.row.resigned_date || '')))[0];
};

/**
 * @param {Object|null} company - a borme_companies_v3 doc (officers_active / officers_resigned).
 * @param {Array|null} events   - the company's borme_events_v3 filings.
 * @returns {Object} the same doc when nothing folds; otherwise a copy with the
 *   variant seats moved to officers_resigned (`ceased_as` = the cese spelling)
 *   and `variantSeatsFolded` = how many.
 */
export const foldVariantSeats = (company, events) => {
  const doc = company || {};
  const active = doc.officers_active || [];
  const resigned = doc.officers_resigned || [];
  if (!active.length || !resigned.length) return company;

  const appointed = appointedSpellings(events);
  const activeKeys = new Set(active.map(seat => nameKey(seat.name || seat.name_normalized)));

  // Orphan ceses: a spelling never appointed and holding no seat of its own.
  const orphans = resigned
    .map((row, index) => ({ row, index, key: nameKey(row.name || row.name_normalized) }))
    .filter(({ key }) => key && !appointed.has(key) && !activeKeys.has(key));
  if (!orphans.length) return company;

  // An orphan spelling must be a variant of exactly one active officer.
  const variantOwners = new Map();
  orphans.forEach(({ key, row }) => {
    const owners = new Set(
      active.map(seat => seat.name || seat.name_normalized).filter(name => isSpellingVariant(name, row.name))
    );
    variantOwners.set(key, owners);
  });

  const consumed = new Set();
  const folded = [];
  const remainingActive = [];
  active.forEach(seat => {
    const seatName = seat.name || seat.name_normalized;
    const candidates = orphans.filter(
      ({ row, index, key }) =>
        !consumed.has(index) &&
        variantOwners.get(key)?.size === 1 &&
        isSpellingVariant(seatName, row.name) &&
        closesSeat(seat, row)
    );
    const twin = pickTwin(seat, candidates);
    if (!twin) {
      remainingActive.push(seat);
      return;
    }
    consumed.add(twin.index);
    folded.push({
      ...seat,
      status: 'resigned',
      resigned_date: twin.row.resigned_date,
      ceased_as: twin.row.name || twin.row.name_normalized,
    });
  });
  if (!folded.length) return company;

  return {
    ...doc,
    officers_active: remainingActive,
    officers_resigned: [...resigned.filter((_, index) => !consumed.has(index)), ...folded],
    variantSeatsFolded: folded.length,
  };
};

export default foldVariantSeats;
