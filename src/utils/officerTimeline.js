import { isAppointmentMovement } from './officerMovements';

/**
 * Turns an officer's registry acts into the geometry a Gantt chart needs.
 *
 * Extracted from OfficerTimelineDialog so the same spans drive three surfaces
 * that must agree: the full dialog, the mini preview in the inspector panel,
 * and the PNG the user copies into a report. A discrepancy between the chart on
 * screen and the chart in someone's Word document would be a credibility bug,
 * so all three read one implementation.
 *
 * Everything here is pure — no DOM, no React, no clock unless injected — which
 * is what lets it be unit-tested under the node-environment vitest config.
 */

// ─── Position category colors (pattern-based) ────────────────────────────────
// Fixed literals rather than theme tokens: this is an 11-way role legend
// (admin/consejero/presidente/…) with no counterpart in graph.node or
// graph.link — the canvas only distinguishes company vs officer, not specific
// roles — so there is no existing token to map onto without inventing one. All
// 11 are mid-to-dark saturated colors, legible on the dark canvas, on a white
// dialog paper, and on the white PNG background.
export const CATEGORY_COLORS = {
  admin: '#7c3aed',
  consejero: '#2563eb',
  presidente: '#1e40af',
  secretario: '#0891b2',
  apoderado: '#059669',
  auditor: '#d97706',
  comisario: '#dc2626',
  liquidador: '#b91c1c',
  director: '#6d28d9',
  socio: '#0d9488',
  other: '#6366f1',
};

const POSITION_PATTERNS = [
  [/^(ADM|ADMIN)/i, 'admin'],
  [/^(CON\.?DEL|CON\.?IND|CONS|CONSEJ)/i, 'consejero'],
  [/^(PRES|VICEPRES)/i, 'presidente'],
  [/^(SEC|VICESEC|LETRADO)/i, 'secretario'],
  [/^(APO|APOD)/i, 'apoderado'],
  [/^(AUD|COAUD)/i, 'auditor'],
  [/^(COM[IO]S)/i, 'comisario'],
  [/^(LIQ)/i, 'liquidador'],
  [/^(DIR|D\.GRAL|GERENTE)/i, 'director'],
  [/^(SOCIO)/i, 'socio'],
];

const _colorCache = new Map();

/** Category colour for a registry role title, memoised across renders. */
export const getPositionColor = (role) => {
  const key = role || '';
  if (_colorCache.has(key)) return _colorCache.get(key);
  const match = POSITION_PATTERNS.find(([pattern]) => pattern.test(key));
  const color = match ? CATEGORY_COLORS[match[1]] : CATEGORY_COLORS.other;
  _colorCache.set(key, color);
  return color;
};

// ─── Dates ───────────────────────────────────────────────────────────────────

/**
 * BORME publishes ISO dates. Parsed as LOCAL midnight rather than through the
 * Date constructor's UTC reading of "YYYY-MM-DD", so a bar never lands a day
 * early for users west of Greenwich.
 */
export const parseTimelineDate = (str) => {
  if (!str) return null;
  const iso = String(str).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const recordDate = (record) => record.date || record.event_date || '';

const recordRole = (record, fallback = '') =>
  record.specific_role || record.position_normalized || record.role || record.position || fallback;

const recordCompany = (record, fallback = '') =>
  record.company_name || record.company || fallback;

// ─── Seat status ─────────────────────────────────────────────────────────────

/**
 * Is this seat currently held? v3 expand-officer reports `status` on most rows;
 * older ones only carry `event_type`. Prefer the explicit field, fall back to
 * the registry act, and say "unknown" rather than guessing — a seat drawn as
 * ceased when it is live is the exact class of error this product cannot make.
 */
export const officerSeatStatus = (officer) => {
  if (!officer) return 'unknown';
  const status = (officer.status || '').toLowerCase();
  if (status === 'active') return 'active';
  if (status === 'ceased') return 'ceased';

  const event = (officer.event_type || '').toLowerCase();
  if (event.includes('nombr') || event.includes('reelecc')) return 'active';
  if (event.includes('cese') || event.includes('dimis') || event.includes('revoc')) return 'ceased';
  return 'unknown';
};

// ─── Records → companies ─────────────────────────────────────────────────────

/**
 * Flat officer records (either endpoint) regrouped one entry per company, in
 * first-appearance order.
 */
export const groupRecordsByCompany = (records, { unknownLabel = '?' } = {}) => {
  if (!records?.length) return [];
  const byCompany = new Map();
  records.forEach((record) => {
    const name = recordCompany(record, unknownLabel);
    if (!byCompany.has(name)) byCompany.set(name, { name, positions: [] });
    byCompany.get(name).positions.push({
      date: recordDate(record),
      specific_role: recordRole(record),
      event_type: record.event_type,
      movement: record.movement,
      status: record.status,
    });
  });
  return [...byCompany.values()];
};

// ─── Companies → spans ───────────────────────────────────────────────────────

/**
 * Pair each appointment with the first cessation that follows it, per
 * company+role. Walking appointments newest-first is what keeps a
 * revoke-and-reappoint honest: the latest appointment finds no later cessation
 * and stays open, and the earlier term closes on the one cessation that exists.
 *
 * A cessation left unpaired becomes an `unknownStart` marker rather than being
 * dropped — its term began before the loaded window, and hiding a published act
 * would be worse than admitting we cannot date its start.
 */
export const buildTimelineSpans = (companies, { fallbackRole = 'Cargo' } = {}) => {
  if (!companies?.length) return [];
  const spans = [];

  companies.forEach((company) => {
    const byRole = new Map();
    (company.positions || []).forEach((position) => {
      const role = position.specific_role || position.position || fallbackRole;
      if (!byRole.has(role)) byRole.set(role, { appointments: [], cessations: [] });
      const date = parseTimelineDate(position.date);
      if (!date) return;
      const bucket = byRole.get(role);
      const act = { date, raw: position.date };
      if (isAppointmentMovement(position)) bucket.appointments.push(act);
      else bucket.cessations.push(act);
    });

    byRole.forEach(({ appointments, cessations }, role) => {
      const sortedAppointments = [...appointments].sort((a, b) => a.date - b.date);
      const sortedCessations = [...cessations].sort((a, b) => a.date - b.date);
      const usedCessations = new Set();
      const paired = [];

      for (let i = sortedAppointments.length - 1; i >= 0; i--) {
        const appointment = sortedAppointments[i];
        const cessation = sortedCessations.find(
          (c) => c.date >= appointment.date && !usedCessations.has(c),
        ) || null;
        if (cessation) usedCessations.add(cessation);
        paired.unshift({ appointment, cessation });
      }

      paired.forEach(({ appointment, cessation }) => {
        spans.push({
          company: company.name,
          role,
          startDate: appointment.date,
          endDate: cessation ? cessation.date : null,
          start: appointment.raw,
          end: cessation ? cessation.raw : null,
          isActive: !cessation,
        });
      });

      sortedCessations.forEach((cessation) => {
        if (usedCessations.has(cessation)) return;
        spans.push({
          company: company.name,
          role,
          startDate: cessation.date,
          endDate: cessation.date,
          start: cessation.raw,
          end: cessation.raw,
          isActive: false,
          unknownStart: true,
        });
      });
    });
  });

  return spans;
};

/** One chart row per company+role, carrying every span of that seat. */
export const buildTimelineRows = (spans) => {
  if (!spans?.length) return [];
  const rows = new Map();
  spans.forEach((span) => {
    const key = `${span.company} ${span.role}`;
    if (!rows.has(key)) {
      rows.set(key, {
        company: span.company,
        role: span.role,
        spans: [],
        color: getPositionColor(span.role),
      });
    }
    rows.get(key).spans.push(span);
  });
  return [...rows.values()];
};

// ─── Spans → chart scale ─────────────────────────────────────────────────────

const MONTHS_BEFORE_FIRST_ACT = 3;
const MONTHS_AFTER_LAST_ACT = 4;

/**
 * The horizontal scale: where the axis starts and ends, the year gridlines, and
 * a date→percent mapper. `today` is injected so the chart is deterministic
 * under test and so a PNG is stamped with the same "today" the screen used.
 */
export const computeTimelineScale = (spans, { today = new Date() } = {}) => {
  const dates = (spans || []).flatMap((s) => [s.startDate, s.endDate].filter(Boolean));
  if (!dates.length) return null;

  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates, today));
  const rangeStart = new Date(minDate.getFullYear(), minDate.getMonth() - MONTHS_BEFORE_FIRST_ACT, 1);
  const rangeEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + MONTHS_AFTER_LAST_ACT, 0);
  const totalMs = rangeEnd - rangeStart || 1;

  const toPercent = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : parseTimelineDate(value);
    if (!date) return null;
    return Math.max(0, Math.min(100, ((date - rangeStart) / totalMs) * 100));
  };

  const years = [];
  for (let year = rangeStart.getFullYear(); year <= rangeEnd.getFullYear(); year++) {
    const pct = ((new Date(year, 0, 1) - rangeStart) / totalMs) * 100;
    if (pct >= 0 && pct <= 100) years.push({ year, pct });
  }

  const todayPct = Math.max(0, Math.min(100, ((today - rangeStart) / totalMs) * 100));

  return { rangeStart, rangeEnd, totalMs, years, todayPct, toPercent };
};

/**
 * Build everything a chart needs from raw officer records in one call, so the
 * dialog, the mini preview and the PNG cannot drift apart.
 */
export const buildOfficerChart = (
  records,
  { unknownLabel = '?', fallbackRole = 'Cargo', today = new Date() } = {},
) => {
  const companies = groupRecordsByCompany(records, { unknownLabel });
  const spans = buildTimelineSpans(companies, { fallbackRole });
  const rows = buildTimelineRows(spans);
  const scale = computeTimelineScale(spans, { today });
  const roles = [...new Set(rows.map((row) => row.role))];
  return { companies, spans, rows, scale, roles };
};

// ─── Seat summary ────────────────────────────────────────────────────────────

/**
 * The numbers that answer "who is this?" before any table is opened.
 * Counts SEATS, not companies: one person can hold an active and a ceased seat
 * at the same company, and collapsing that to a per-company status would erase
 * exactly the transition a reader is looking for.
 */
export const summariseOfficerSeats = (officers) => {
  const rows = officers || [];
  const companies = new Set();
  let activeCount = 0;
  let ceasedCount = 0;
  let firstDate = null;
  let lastDate = null;
  let firstTime = Infinity;
  let lastTime = -Infinity;

  rows.forEach((officer) => {
    const company = recordCompany(officer);
    if (company) companies.add(company.toUpperCase());

    const status = officerSeatStatus(officer);
    if (status === 'active') activeCount += 1;
    else if (status === 'ceased') ceasedCount += 1;

    const raw = recordDate(officer);
    const date = parseTimelineDate(raw);
    if (!date) return;
    if (date.getTime() < firstTime) { firstTime = date.getTime(); firstDate = raw; }
    if (date.getTime() > lastTime) { lastTime = date.getTime(); lastDate = raw; }
  });

  return {
    seatCount: rows.length,
    activeCount,
    ceasedCount,
    companyCount: companies.size,
    firstDate,
    lastDate,
  };
};
