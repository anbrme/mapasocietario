import { describe, it, expect } from 'vitest';
import {
  parseTimelineDate,
  getPositionColor,
  officerSeatStatus,
  groupRecordsByCompany,
  buildTimelineSpans,
  buildTimelineRows,
  computeTimelineScale,
  summariseOfficerSeats,
} from './officerTimeline';

describe('parseTimelineDate', () => {
  it('reads the ISO form BORME publishes', () => {
    expect(parseTimelineDate('2013-10-16')).toEqual(new Date(2013, 9, 16));
  });

  it('reads a single-digit month and day', () => {
    expect(parseTimelineDate('2010-2-9')).toEqual(new Date(2010, 1, 9));
  });

  it('returns null rather than an Invalid Date', () => {
    expect(parseTimelineDate('')).toBeNull();
    expect(parseTimelineDate(null)).toBeNull();
    expect(parseTimelineDate('not a date')).toBeNull();
  });
});

describe('getPositionColor', () => {
  it('maps a role to its category colour', () => {
    expect(getPositionColor('ADM. UNICO')).toBe(getPositionColor('ADMINISTRADOR SOLIDARIO'));
    expect(getPositionColor('LIQUIDADOR')).not.toBe(getPositionColor('ADM. UNICO'));
  });

  it('falls back to the "other" colour for an unrecognised role', () => {
    expect(getPositionColor('CARGO INVENTADO')).toBe(getPositionColor('OTRO CARGO RARO'));
  });

  it('tolerates a missing role', () => {
    expect(typeof getPositionColor(undefined)).toBe('string');
  });
});

describe('officerSeatStatus', () => {
  it('trusts the explicit status field', () => {
    expect(officerSeatStatus({ status: 'active' })).toBe('active');
    expect(officerSeatStatus({ status: 'Ceased' })).toBe('ceased');
  });

  it('falls back to the registry act when status is absent', () => {
    expect(officerSeatStatus({ event_type: 'Nombramientos' })).toBe('active');
    expect(officerSeatStatus({ event_type: 'Reelecciones' })).toBe('active');
    expect(officerSeatStatus({ event_type: 'Ceses/Dimisiones' })).toBe('ceased');
    expect(officerSeatStatus({ event_type: 'Revocaciones' })).toBe('ceased');
  });

  it('says unknown rather than guessing', () => {
    expect(officerSeatStatus({})).toBe('unknown');
    expect(officerSeatStatus({ event_type: 'Otros conceptos' })).toBe('unknown');
  });
});

describe('groupRecordsByCompany', () => {
  it('collects every act of one company under a single entry', () => {
    const records = [
      { company_name: 'ACME SL', specific_role: 'ADM. UNICO', date: '2013-10-16', event_type: 'Nombramientos' },
      { company_name: 'ACME SL', specific_role: 'ADM. UNICO', date: '2018-01-02', event_type: 'Ceses/Dimisiones' },
      { company_name: 'OTRA SL', position_normalized: 'LIQUIDADOR', event_date: '2010-10-25', event_type: 'Nombramientos' },
    ];

    const companies = groupRecordsByCompany(records, { unknownLabel: 'Desconocida' });

    expect(companies).toHaveLength(2);
    expect(companies[0]).toMatchObject({ name: 'ACME SL' });
    expect(companies[0].positions).toHaveLength(2);
    expect(companies[1].positions[0]).toMatchObject({ date: '2010-10-25', specific_role: 'LIQUIDADOR' });
  });

  it('labels a nameless company rather than dropping its acts', () => {
    const companies = groupRecordsByCompany(
      [{ specific_role: 'APODERADO', date: '2020-01-01' }],
      { unknownLabel: 'Desconocida' },
    );
    expect(companies[0].name).toBe('Desconocida');
  });

  it('returns an empty list for no records', () => {
    expect(groupRecordsByCompany([], { unknownLabel: 'x' })).toEqual([]);
    expect(groupRecordsByCompany(null, { unknownLabel: 'x' })).toEqual([]);
  });
});

describe('buildTimelineSpans', () => {
  const companies = [{
    name: 'ACME SL',
    positions: [
      { date: '2013-10-16', specific_role: 'ADM. UNICO', event_type: 'Nombramientos' },
      { date: '2018-03-01', specific_role: 'ADM. UNICO', event_type: 'Ceses/Dimisiones' },
    ],
  }];

  it('pairs an appointment with the cessation that follows it', () => {
    const spans = buildTimelineSpans(companies);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      company: 'ACME SL',
      role: 'ADM. UNICO',
      start: '2013-10-16',
      end: '2018-03-01',
      isActive: false,
    });
  });

  it('leaves an unpaired appointment open-ended', () => {
    const spans = buildTimelineSpans([{
      name: 'ACME SL',
      positions: [{ date: '2013-10-16', specific_role: 'ADM. UNICO', event_type: 'Nombramientos' }],
    }]);
    expect(spans[0]).toMatchObject({ isActive: true, end: null });
  });

  it('draws a cessation with no known appointment as an unknown-start marker', () => {
    // A term that began before the loaded window still has to appear —
    // dropping it would silently hide a real registry act.
    const spans = buildTimelineSpans([{
      name: 'ACME SL',
      positions: [{ date: '2011-05-04', specific_role: 'APODERADO', event_type: 'Ceses/Dimisiones' }],
    }]);
    expect(spans[0]).toMatchObject({ unknownStart: true, isActive: false, end: '2011-05-04' });
  });

  it('does not reuse one cessation to close two terms', () => {
    // Revoke-and-reappoint: two appointments, one cessation. The older term
    // closes; the newer one stays open.
    const spans = buildTimelineSpans([{
      name: 'ACME SL',
      positions: [
        { date: '2010-01-01', specific_role: 'ADM. UNICO', event_type: 'Nombramientos' },
        { date: '2012-01-01', specific_role: 'ADM. UNICO', event_type: 'Ceses/Dimisiones' },
        { date: '2015-01-01', specific_role: 'ADM. UNICO', event_type: 'Nombramientos' },
      ],
    }]);
    expect(spans).toHaveLength(2);
    expect(spans.filter(s => s.isActive)).toHaveLength(1);
    expect(spans.find(s => s.isActive).start).toBe('2015-01-01');
  });

  it('keeps roles at the same company on separate spans', () => {
    const spans = buildTimelineSpans([{
      name: 'ACME SL',
      positions: [
        { date: '2010-01-01', specific_role: 'ADM. SOLID.', event_type: 'Nombramientos' },
        { date: '2010-10-25', specific_role: 'LIQUIDADOR', event_type: 'Nombramientos' },
      ],
    }]);
    expect(spans.map(s => s.role).sort()).toEqual(['ADM. SOLID.', 'LIQUIDADOR']);
  });

  it('ignores acts with no usable date', () => {
    const spans = buildTimelineSpans([{
      name: 'ACME SL',
      positions: [{ date: null, specific_role: 'ADM. UNICO', event_type: 'Nombramientos' }],
    }]);
    expect(spans).toEqual([]);
  });

  it('returns an empty list for no companies', () => {
    expect(buildTimelineSpans([])).toEqual([]);
    expect(buildTimelineSpans(null)).toEqual([]);
  });
});

describe('buildTimelineRows', () => {
  it('makes one row per company+role and attaches its colour', () => {
    const spans = [
      { company: 'ACME SL', role: 'ADM. UNICO', startDate: new Date(2013, 0, 1), endDate: null, isActive: true },
      { company: 'ACME SL', role: 'ADM. UNICO', startDate: new Date(2010, 0, 1), endDate: new Date(2011, 0, 1), isActive: false },
      { company: 'OTRA SL', role: 'LIQUIDADOR', startDate: new Date(2010, 0, 1), endDate: null, isActive: true },
    ];
    const rows = buildTimelineRows(spans);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ company: 'ACME SL', role: 'ADM. UNICO' });
    expect(rows[0].spans).toHaveLength(2);
    expect(rows[0].color).toBe(getPositionColor('ADM. UNICO'));
  });
});

describe('computeTimelineScale', () => {
  const spans = [
    { startDate: new Date(2013, 9, 16), endDate: null },
    { startDate: new Date(2010, 1, 19), endDate: new Date(2010, 9, 25) },
  ];
  const today = new Date(2026, 7, 19);

  it('spans from before the first act to past today', () => {
    const scale = computeTimelineScale(spans, { today });
    expect(scale.rangeStart.getTime()).toBeLessThan(new Date(2010, 1, 19).getTime());
    expect(scale.rangeEnd.getTime()).toBeGreaterThan(today.getTime());
  });

  it('places today inside the range', () => {
    const { todayPct } = computeTimelineScale(spans, { today });
    expect(todayPct).toBeGreaterThan(0);
    expect(todayPct).toBeLessThan(100);
  });

  it('emits one gridline per year in range', () => {
    const { years } = computeTimelineScale(spans, { today });
    expect(years[0].year).toBe(2010);
    expect(years[years.length - 1].year).toBe(2026);
    years.forEach(y => {
      expect(y.pct).toBeGreaterThanOrEqual(0);
      expect(y.pct).toBeLessThanOrEqual(100);
    });
  });

  it('clamps a date outside the range instead of drawing off-chart', () => {
    const { toPercent } = computeTimelineScale(spans, { today });
    expect(toPercent(new Date(1990, 0, 1))).toBe(0);
    expect(toPercent(new Date(2099, 0, 1))).toBe(100);
    expect(toPercent(null)).toBeNull();
  });

  it('returns null for spans with no dates at all', () => {
    expect(computeTimelineScale([], { today })).toBeNull();
  });
});

describe('summariseOfficerSeats', () => {
  const officers = [
    { company_name: 'ACME SL', specific_role: 'ADM. UNICO', status: 'active', date: '2013-10-16' },
    { company_name: 'OTRA SL', specific_role: 'ADM. SOLID.', status: 'ceased', date: '2010-10-25' },
    { company_name: 'OTRA SL', specific_role: 'LIQUIDADOR', status: 'active', date: '2010-10-25' },
  ];

  it('counts seats by status, not companies by status', () => {
    // Two active seats sit at two different companies; one company holds both
    // an active and a ceased seat, so company count is lower than seat count.
    const s = summariseOfficerSeats(officers);
    expect(s.seatCount).toBe(3);
    expect(s.activeCount).toBe(2);
    expect(s.ceasedCount).toBe(1);
    expect(s.companyCount).toBe(2);
  });

  it('reports the outer bounds of the registry record', () => {
    const s = summariseOfficerSeats(officers);
    expect(s.firstDate).toBe('2010-10-25');
    expect(s.lastDate).toBe('2013-10-16');
  });

  it('handles an empty record without dividing by zero', () => {
    expect(summariseOfficerSeats([])).toMatchObject({
      seatCount: 0, activeCount: 0, ceasedCount: 0, companyCount: 0,
      firstDate: null, lastDate: null,
    });
    expect(summariseOfficerSeats(null).seatCount).toBe(0);
  });

  it('does not count an undated seat toward the date range', () => {
    const s = summariseOfficerSeats([{ company_name: 'ACME SL', status: 'active' }]);
    expect(s.seatCount).toBe(1);
    expect(s.firstDate).toBeNull();
  });
});
