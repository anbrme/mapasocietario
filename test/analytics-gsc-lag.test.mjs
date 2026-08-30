import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSearchConsole } from '../workers/analytics/src/search-console.js';

// Search Console keeps writing a day for two to three days after it starts
// reporting it. Measured on 2026-08-30 against what the emails had stored:
// Aug 27 67 -> 80 clicks, Aug 28 56 -> 65, Aug 29 15 -> 24. Every daily email
// understated its own headline day, worst on the freshest one.
const day = (date, clicks, impressions, position = 10) => ({
  keys: [date], clicks, impressions, position,
  ctr: impressions ? clicks / impressions : 0,
});

/** GSC with a settled tail and two days still being written. */
function stubGsc({ final, all }) {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    const rows = body.dataState === 'final' ? final : all;
    const dims = body.dimensions || [];
    if (dims[0] === 'date') {
      const inRange = rows.filter((r) => r.keys[0] >= body.startDate && r.keys[0] <= body.endDate);
      return { ok: true, json: async () => ({ rows: inRange }) };
    }
    return { ok: true, json: async () => ({ rows: [] }) };
  };
}

const WINDOW = { start: '2026-08-23', end: '2026-08-29' };
const PRIOR = { start: '2026-08-16', end: '2026-08-22' };

const FINAL = [
  day('2026-08-16', 20, 900), day('2026-08-20', 23, 1853), day('2026-08-21', 27, 2012),
  day('2026-08-22', 24, 1057), day('2026-08-23', 17, 1171), day('2026-08-24', 27, 1743),
  day('2026-08-25', 59, 2955), day('2026-08-26', 80, 4816), day('2026-08-27', 80, 4724),
];
// The same days, plus two that GSC has begun but not finished.
const ALL = [...FINAL, day('2026-08-28', 56, 3287), day('2026-08-29', 15, 1205)];

test('the headline day is the newest SETTLED day, not the newest day with any rows', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubGsc({ final: FINAL, all: ALL });
  try {
    const sc = await fetchSearchConsole('tok', 'https://example.test/', {
      window: WINDOW, priorWindow: PRIOR,
    });

    // Aug 29 has rows, but it is still being written: it would have reported 15
    // clicks where the settled figure turned out to be 24.
    assert.equal(sc.dataThrough, '2026-08-27');
    assert.equal(sc.day.clicks, 80);
    assert.equal(sc.lagDays, 2, 'the lag is now stated honestly rather than reading as 0');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the days still being written are reported, not silently dropped', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubGsc({ final: FINAL, all: ALL });
  try {
    const sc = await fetchSearchConsole('tok', 'https://example.test/', {
      window: WINDOW, priorWindow: PRIOR,
    });

    assert.equal(sc.provisional.through, '2026-08-29');
    assert.deepEqual(sc.provisional.days.map((d) => d.date), ['2026-08-28', '2026-08-29']);
    // Stated as a floor: these can only grow.
    assert.equal(sc.provisional.clicksSoFar, 71);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the window comparison uses the same data state on both sides', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubGsc({ final: FINAL, all: ALL });
  try {
    const sc = await fetchSearchConsole('tok', 'https://example.test/', {
      window: WINDOW, priorWindow: PRIOR,
    });

    // Mixing a settled prior week against a current week whose tail is still
    // filling in biases every week-over-week number downward.
    assert.equal(sc.windowDataState, 'final');
    assert.equal(sc.window.clicks, 17 + 27 + 59 + 80 + 80);
    // Aug 16 is inside the prior window (Aug 16-22) too.
    assert.equal(sc.priorWindowTotals.clicks, 20 + 23 + 27 + 24);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a trend row says whether it is settled', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubGsc({ final: FINAL, all: ALL });
  try {
    const sc = await fetchSearchConsole('tok', 'https://example.test/', {
      window: WINDOW, priorWindow: PRIOR,
    });
    const byDate = Object.fromEntries(sc.trend.map((t) => [t.date, t.provisional]));
    assert.equal(byDate['2026-08-27'], false);
    assert.equal(byDate['2026-08-29'], true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
