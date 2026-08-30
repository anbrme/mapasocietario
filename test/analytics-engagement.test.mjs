import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gather,
  reportWarnings,
  rowsToObjects,
  totalsFrom,
} from '../workers/analytics/src/index.js';

// GA4 returns metricHeaders naming each column. Reading the values by their
// position in the REQUEST silently mislabels every metric the moment those two
// orders diverge — the transposition class of defect this file has already been
// bitten by twice. Map by name.
test('metrics are read by response header name, not request position', () => {
  const report = {
    metricHeaders: [
      { name: 'keyEvents' },
      { name: 'sessions' },
      { name: 'engagementRate' },
    ],
    rows: [
      {
        dimensionValues: [{ value: '20260827' }],
        metricValues: [{ value: '94' }, { value: '42' }, { value: '0.238' }],
      },
    ],
  };

  const [row] = rowsToObjects(report, ['date'], ['sessions', 'engagementRate', 'keyEvents']);

  assert.equal(row.sessions, 42);
  assert.equal(row.keyEvents, 94);
  assert.equal(row.engagementRate, 0.238);
});

test('totals are read by response header name too', () => {
  const report = {
    metricHeaders: [{ name: 'engagedSessions' }, { name: 'sessions' }],
    totals: [{ metricValues: [{ value: '10' }, { value: '42' }] }],
  };

  const totals = totalsFrom(report, ['sessions', 'engagedSessions']);

  assert.equal(totals.sessions, 42);
  assert.equal(totals.engagedSessions, 10);
});

// runReportCompat retries a rejected keyEvents request as `conversions`. The
// response then names a column the caller never asked for; the alias must not
// read as a missing metric and zero it out.
test('the conversions fallback still resolves as keyEvents', () => {
  const report = {
    metricHeaders: [{ name: 'sessions' }, { name: 'conversions' }],
    totals: [{ metricValues: [{ value: '42' }, { value: '94' }] }],
  };

  assert.equal(totalsFrom(report, ['sessions', 'keyEvents']).keyEvents, 94);
});

test('a response without metricHeaders still reads positionally', () => {
  const report = { totals: [{ metricValues: [{ value: '42' }, { value: '94' }] }] };

  const totals = totalsFrom(report, ['sessions', 'keyEvents']);

  assert.equal(totals.sessions, 42);
  assert.equal(totals.keyEvents, 94);
});

// The defect this whole change exists to catch: on 27-29 Aug the report gave a
// 16-24% day engagement rate while the window CONTAINING those days reported
// 54-60%. A rate cannot be checked against another rate. A count can.
test('engagement that does not reconcile across cuts is reported, not published', () => {
  const warnings = reportWarnings({
    measurementQuality: {
      engagement: {
        days: 7,
        dailyEngagedSum: 48,
        windowSessions: 372,
        windowEngagedSessions: 224,
        reconciled: false,
      },
    },
  });

  const warning = warnings.find((w) => w.includes('Engagement does not reconcile'));
  assert.ok(warning, `expected an engagement reconciliation warning, got: ${warnings.join(' | ')}`);
  assert.match(warning, /48/);
  assert.match(warning, /224/);
});

// A session carrying a key event is engaged by GA4's own definition, so a cut
// reporting key events at a zero engagement rate is describing something
// impossible. The Aug 23-29 window did exactly this: Unassigned, 21 sessions,
// 0% engaged, 51 key events.
test('a zero engagement rate alongside key events is flagged as impossible', () => {
  const warnings = reportWarnings({
    channels: [
      { channel: 'Organic Search', sessions: 267, engagementRate: 0.67, keyEvents: 354 },
      { channel: 'Unassigned', sessions: 21, engagementRate: 0, keyEvents: 51 },
    ],
  });

  const warning = warnings.find((w) => w.includes('Unassigned'));
  assert.ok(warning, `expected an impossible-engagement warning, got: ${warnings.join(' | ')}`);
  assert.match(warning, /51/);
});

test('a clean report raises neither engagement warning', () => {
  const warnings = reportWarnings({
    measurementQuality: {
      engagement: {
        days: 7,
        dailyEngagedSum: 224,
        windowSessions: 372,
        windowEngagedSessions: 224,
        reconciled: true,
      },
    },
    channels: [{ channel: 'Organic Search', sessions: 267, engagementRate: 0.67, keyEvents: 354 }],
  });

  assert.equal(warnings.filter((w) => w.toLowerCase().includes('engagement')).length, 0);
});

// engagedSessions is the whole point: it is additive, so it can be summed and
// compared. engagementRate alone is unfalsifiable.
test('gather asks for engaged sessions on the daily-by-date cut', async () => {
  const originalFetch = globalThis.fetch;
  const dailyMetrics = [];

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body || '{}');
    const dims = (body.dimensions || []).map((d) => d.name);
    const metrics = (body.metrics || []).map((m) => m.name);
    if (dims.length === 1 && dims[0] === 'date') dailyMetrics.push(metrics);
    return {
      ok: true,
      json: async () => ({
        metricHeaders: metrics.map((name) => ({ name })),
        rows: [],
        totals: [{ metricValues: metrics.map(() => ({ value: '0' })) }],
      }),
    };
  };

  try {
    await gather({}, 'token', '530829482', Date.parse('2026-08-30T07:30:00Z'));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(dailyMetrics.length, 'expected a daily-by-date query');
  assert.ok(
    dailyMetrics.every((m) => m.includes('engagedSessions')),
    `daily cut must carry engagedSessions, got ${JSON.stringify(dailyMetrics)}`,
  );
});
