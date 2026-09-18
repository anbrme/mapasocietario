// Registry history → the replay's model: who the subject's counterparts are,
// every term each of them held, and the ledger of acts in date order.
//
// Terms come from the same chronological sweep the officer Gantt uses
// (officerTimeline.buildTimelineSpans): a renewal while a term is open is the
// same term, a same-day cese + re-appointment ends held, and a cessation with
// nothing open becomes an unknown start. Two things happen before the sweep,
// because the event log is noisier than the sweep assumes:
//   - acts the registry vocabulary does not name are DROPPED, never guessed
//     at (ex-officio cancellations ARE named: they end the seat);
//   - role spellings are folded per person-company pair, so a "CON.DELEGADO"
//     cessation closes the "CONS. DELEG." seat it belongs to.
// And one thing after: a dissolution or extinction closes the seats still
// open at that act. Those endings are INFERRED — no cessation was published —
// and carry endKind 'inferred' so the stage never draws them as one.
import { buildTimelineSpans } from '../officerTimeline';
import { positionCategoryFor } from '../positionCategories';
import { roleKey } from '../roleKey';
import { officerIdFor } from '../officerNodeKey';
import { addMonths } from './replayClock';

const APPOINTMENT_ACTS = new Set(['NOMBRAMIENTOS', 'REELECCIONES']);
const CESSATION_ACTS = new Set(['CESES/DIMISIONES', 'CESES', 'DIMISIONES', 'REVOCACIONES']);
const DOMAIN_LEAD_MONTHS = 3;
const CLOSED_TAIL_MONTHS = 6;
// Our BORME coverage starts in 2009: a first act inside that first year is
// more likely where the record begins than where the career did.
const COVERAGE_FIRST_YEAR_END = '2010-01-01';

// "Cancelaciones de oficio de nombramientos": the registry cancels expired
// appointments ex officio, so the seat ENDS. A routine section (~1,400
// filings a year); /officer-events labels it 'other', so it is recognised
// here before the server classification is trusted.
const isCancellation = act => act.startsWith('CANCELACION');

/** 'appointment' | 'cessation' | null. null = not a seat movement; never guessed. */
export const classifyAct = record => {
  if (!record) return null;
  if (isCancellation((record.event_type || '').trim().toUpperCase())) return 'cessation';
  if (record.movement) {
    return record.movement === 'appointment' || record.movement === 'cessation' ? record.movement : null;
  }
  const act = (record.event_type || '').trim().toUpperCase();
  if (APPOINTMENT_ACTS.has(act)) return 'appointment';
  if (CESSATION_ACTS.has(act)) return 'cessation';
  return null;
};

const isoDay = v => (v ? String(v).slice(0, 10) : '');
const byDate = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// Cessations (and closures) before appointments on a tie — the sweep's rule.
const KIND_RANK = { cessation: 0, closure: 0, appointment: 1 };
const byDateThenKind = (a, b) => byDate(a.date, b.date) || KIND_RANK[a.kind] - KIND_RANK[b.kind];

/**
 * One spelling per seat on a person-company pair. Exact roleKey matches share
 * the first spelling seen; a cessation whose spelling was never appointed
 * attaches to the pair's only appointed seat of the same category — and to
 * nothing when there are several (roleKey.isCategoryUnambiguous's rule).
 */
const foldRoleSpellings = records => {
  const spellingByKey = new Map();
  records.forEach(r => {
    const key = roleKey(r.role);
    if (!spellingByKey.has(key)) spellingByKey.set(key, r.role);
  });
  const appointedByCategory = new Map();
  records.forEach(r => {
    if (r.kind !== 'appointment') return;
    const category = positionCategoryFor(r.role);
    if (!appointedByCategory.has(category)) appointedByCategory.set(category, new Set());
    appointedByCategory.get(category).add(roleKey(r.role));
  });

  return records.map(r => {
    const key = roleKey(r.role);
    const appointed = appointedByCategory.get(positionCategoryFor(r.role));
    if (r.kind === 'cessation' && appointed && !appointed.has(key) && appointed.size === 1) {
      return { ...r, role: spellingByKey.get([...appointed][0]) };
    }
    return { ...r, role: spellingByKey.get(key) };
  });
};

const groupBy = (list, keyOf) => {
  const out = new Map();
  list.forEach(item => {
    const key = keyOf(item);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(item);
  });
  return out;
};

const termsFromRecords = recordsByCounterpart => {
  const companies = [...recordsByCounterpart.entries()].map(([id, records]) => ({
    name: id,
    positions: records.map(r => ({ date: r.date, specific_role: r.role, movement: r.kind })),
  }));
  return buildTimelineSpans(companies).map(span => ({
    counterpartId: span.company,
    role: span.role,
    category: positionCategoryFor(span.role),
    from: span.unknownStart ? null : span.start,
    to: span.end,
    endKind: span.end ? 'published' : null,
  }));
};

/**
 * Close the seats still open at a dissolution or extinction. A dissolution
 * does not end the liquidators it appoints, nor a seat inscribed by that same
 * act; an extinction ends everything.
 */
const applyClosures = (terms, closures) => {
  const closureActs = [];
  const closed = terms.map(term => {
    if (term.to !== null) return term;
    const closure = closures.find(c =>
      (term.from === null || term.from < c.date) &&
      !(c.kind === 'dissolution' && term.category === 'Liquidador'));
    if (!closure) return term;
    closureActs.push({
      date: closure.date,
      counterpartId: term.counterpartId,
      role: term.role,
      category: term.category,
      kind: 'closure',
    });
    return { ...term, to: closure.date, endKind: 'inferred' };
  });
  return { terms: closed, closureActs };
};

const buildCounterparts = (records, kind) => {
  const byId = new Map();
  [...records].sort(byDateThenKind).forEach(r => {
    if (!byId.has(r.counterpartId)) {
      byId.set(r.counterpartId, { id: r.counterpartId, name: r.counterpartName, kind, firstAct: r.date });
    }
  });
  return [...byId.values()].sort((a, b) => byDate(a.firstAct, b.firstAct) || byDate(a.name, b.name));
};

const computeDomain = (acts, closures, today) => {
  if (!acts.length) return { start: today, end: today };
  const first = acts[0].date;
  const last = acts[acts.length - 1].date;
  const lastClosure = closures.length ? closures[closures.length - 1].date : null;
  const isClosed = lastClosure !== null && lastClosure >= last;
  const end = isClosed ? addMonths(last, CLOSED_TAIL_MONTHS) : today;
  return { start: addMonths(first, -DOMAIN_LEAD_MONTHS), end: end < first ? first : end };
};

const assembleModel = ({ subject, records, closures, counterpartKind, recordsBegin, completeness, today }) => {
  const byCounterpart = groupBy(records, r => r.counterpartId);
  const folded = new Map([...byCounterpart.entries()].map(([id, recs]) => [id, foldRoleSpellings(recs)]));
  const swept = termsFromRecords(folded);
  const { terms, closureActs } = applyClosures(swept, closures);

  const seatActs = [...folded.values()].flat().map(r => ({
    date: r.date,
    counterpartId: r.counterpartId,
    role: r.role,
    category: positionCategoryFor(r.role),
    kind: r.kind,
  }));
  const acts = [...seatActs, ...closureActs].sort(byDateThenKind);

  return {
    subject,
    counterparts: buildCounterparts(records, counterpartKind),
    terms,
    acts,
    domain: computeDomain(acts, closures, today),
    completeness: {
      loaded: completeness?.loaded ?? null,
      total: completeness?.total ?? null,
      truncatedBefore: completeness?.truncatedBefore ?? null,
      recordsBegin,
    },
  };
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * @param {object[]} events - borme_events_v3 docs for ONE company (fetched with full_officers=1)
 * @param {{ id: string, name: string }} subject
 * @param {{ today?: string, completeness?: object }} [options]
 */
export const buildCompanyReplayModel = (events, subject, { today = todayIso(), completeness } = {}) => {
  const list = Array.isArray(events) ? events : [];
  const records = list.flatMap(ev => {
    const date = isoDay(ev.event_date);
    if (!date) return [];
    return (ev.officers || []).flatMap(o => {
      const kind = classifyAct(o);
      const name = (o.name || o.name_normalized || '').trim();
      if (!kind || !name) return [];
      return [{
        date,
        counterpartId: officerIdFor(name),
        counterpartName: name,
        role: o.position || o.position_normalized || 'Cargo',
        kind,
      }];
    });
  });

  const closures = list
    .filter(ev => isoDay(ev.event_date) && (ev.has_dissolution || ev.has_registry_closure))
    .map(ev => ({ date: isoDay(ev.event_date), kind: ev.has_registry_closure ? 'extinction' : 'dissolution' }))
    .sort((a, b) => byDate(a.date, b.date));

  const eventDates = list.map(ev => isoDay(ev.event_date)).filter(Boolean).sort();
  const hasConstitution = list.some(ev => ev.has_constitution);
  const recordsBegin = !hasConstitution && eventDates.length ? eventDates[0] : null;

  return assembleModel({
    subject: { ...subject, kind: 'company' },
    records,
    closures,
    counterpartKind: 'officer',
    recordsBegin,
    completeness,
    today,
  });
};

/**
 * @param {object[]} movements - /bormes/v3/officer-events movements for ONE officer
 * @param {{ id: string, name: string }} subject
 * @param {{ today?: string, completeness?: object }} [options]
 */
export const buildOfficerReplayModel = (movements, subject, { today = todayIso(), completeness } = {}) => {
  const records = (Array.isArray(movements) ? movements : []).flatMap(m => {
    const date = isoDay(m.event_date || m.date);
    const kind = classifyAct(m);
    const name = (m.company_name || '').trim();
    if (!date || !kind || !name) return [];
    return [{
      date,
      counterpartId: m.group_key || `company:${name.toUpperCase()}`,
      counterpartName: name,
      role: m.position || m.position_normalized || 'Cargo',
      kind,
    }];
  });

  const firstDate = records.map(r => r.date).sort()[0];
  const recordsBegin = firstDate && firstDate < COVERAGE_FIRST_YEAR_END ? firstDate : null;

  return assembleModel({
    subject: { ...subject, kind: 'officer' },
    records,
    // Dissolution of an officer's companies is not in the movements payload;
    // the stage makes no claim it cannot source.
    closures: [],
    counterpartKind: 'company',
    recordsBegin,
    completeness,
    today,
  });
};

/**
 * Acts per calendar month across the whole domain, empty months included, so
 * the strip under the scrubber shares its x-axis. Acts in a hidden category
 * are counted apart: hidden from the stage, never from the volume.
 */
export const activityByMonth = (model, { hiddenCategories = new Set() } = {}) => {
  const bins = new Map();
  const startMonth = model.domain.start.slice(0, 7);
  const endMonth = model.domain.end.slice(0, 7);
  for (let m = `${startMonth}-01`; m.slice(0, 7) <= endMonth; m = addMonths(m, 1)) {
    bins.set(m.slice(0, 7), { month: m.slice(0, 7), appointments: 0, cessations: 0, hidden: 0 });
  }
  model.acts.forEach(act => {
    const bin = bins.get(act.date.slice(0, 7));
    if (!bin) return;
    if (hiddenCategories.has(act.category)) bin.hidden += 1;
    else if (act.kind === 'appointment') bin.appointments += 1;
    else bin.cessations += 1;
  });
  return [...bins.values()];
};
