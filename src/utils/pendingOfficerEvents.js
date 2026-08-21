/**
 * Bring a company's officer lists up to what BORME has actually published.
 *
 * Two stores answer "who runs this company", and they do not run at the same
 * speed. borme_events_v3 has each published act within hours; the aggregated
 * company doc in borme_companies_v3 is rebuilt later — for SOTO DE TORRES, SL
 * the doc was still nine months behind when the registry published, on
 * 2026-08-21, that AMADO GALLART JOSEP had resigned as joint administrator and
 * FABRICE BRUNO DUCCESCHI had been appointed in his place.
 *
 * Every surface reading the doc therefore named the man who had just resigned,
 * and never named his replacement — while the same page's history section, fed
 * by the event log, printed both acts correctly.
 *
 * This applies the acts the doc has not absorbed yet. The boundary is the doc's
 * own `last_seen`: at or before it, the aggregation has already had its say and
 * is authoritative (it prunes superseded seats, resolves renames, applies caps),
 * so replaying those events could resurrect officers it deliberately dropped.
 * After it, the event log is the only source that knows.
 *
 * Two rules it will not break:
 *   - a cessation may only CLOSE a seat the doc holds. An act naming someone the
 *     doc never listed produces no phantom departure.
 *   - the returned doc is a copy; callers keep their input.
 */
// Extension required: this module is also loaded by the /empresa Pages Function
// and by the node:test suite, neither of which resolves extensionless imports.
import { sameRoleCategory } from './positionCategories.js';

const APPOINTMENT = 'appointment';
const CLOSURE = 'closure';

/** Registry vocabulary → what the act does to a seat. */
const actKind = eventType => {
  const type = (eventType || '').toLowerCase();
  if (type.includes('cese') || type.includes('dimisi') || type.includes('revocac')) return CLOSURE;
  if (type.includes('nombr') || type.includes('reelecc')) return APPOINTMENT;
  return null; // capital, address, registry data: nothing to do with seats
};

const nameKey = name =>
  (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

const roleOf = officer => officer?.position_normalized || officer?.position || '';

const isSameSeat = (seat, officer) =>
  nameKey(seat.name || seat.name_normalized) === nameKey(officer.name) &&
  sameRoleCategory(roleOf(seat), roleOf(officer));

/**
 * @param {Object|null} company - a borme_companies_v3 doc.
 * @param {Array|null} events   - borme_events_v3 events for the same company.
 * @returns {Object} a copy of the doc with officers_active / officers_resigned
 *   brought forward, plus `pendingActsApplied`: how many published acts were applied.
 */
export const reconcileOfficersWithEvents = (company, events) => {
  const doc = company || {};
  const active = [...(doc.officers_active || [])];
  const resigned = [...(doc.officers_resigned || [])];
  const base = { ...doc, officers_active: active, officers_resigned: resigned, pendingActsApplied: 0 };

  const cutoff = doc.last_seen;
  // Without a coverage boundary there is no way to tell an unabsorbed act from
  // one the aggregation has already considered and rejected. Change nothing.
  if (!cutoff || !Array.isArray(events)) return base;

  // Oldest first: a seat can be opened, closed and reopened across filings, and
  // only the last act should stand.
  const pending = events
    .filter(e => e && e.event_date && e.event_date > cutoff)
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));

  let applied = 0;

  for (const event of pending) {
    for (const officer of event.officers || []) {
      const kind = actKind(officer.event_type);
      if (!kind || !officer.name) continue;

      if (kind === CLOSURE) {
        const index = active.findIndex(seat => isSameSeat(seat, officer));
        if (index === -1) continue; // never fabricate a departure
        const [seat] = active.splice(index, 1);
        resigned.push({
          ...seat,
          status: 'resigned',
          resigned_date: event.event_date,
          from_pending_event: true,
        });
        applied += 1;
        continue;
      }

      // An appointment of someone the doc has resigned is a return to the seat.
      const resignedIndex = resigned.findIndex(seat => isSameSeat(seat, officer));
      if (resignedIndex !== -1) resigned.splice(resignedIndex, 1);

      const activeIndex = active.findIndex(seat => isSameSeat(seat, officer));
      if (activeIndex !== -1) {
        // Already seated — a re-election renews the date, nothing more.
        active[activeIndex] = {
          ...active[activeIndex],
          appointed_date: event.event_date,
          from_pending_event: true,
        };
      } else {
        active.push({
          name: officer.name,
          position_normalized: roleOf(officer),
          appointed_date: event.event_date,
          resigned_date: null,
          status: 'active',
          from_pending_event: true,
        });
      }
      applied += 1;
    }
  }

  return { ...base, officers_active: active, officers_resigned: resigned, pendingActsApplied: applied };
};

export default reconcileOfficersWithEvents;
