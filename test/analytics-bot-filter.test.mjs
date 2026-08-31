import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTOMATED_TRAFFIC_SIGNATURE,
  automatedTrafficQuery,
  withoutAutomatedTraffic,
} from '../workers/analytics/src/bot-filter.js';

// The signature is the whole load-bearing claim of this module: real Chrome
// reports a full build number to same-origin JavaScript via client hints
// (151.0.7922.174), and a stripped X.0.0.0 is what the headless runtimes that
// hit this site report. If the shape drifts, every figure in the email drifts
// with it silently, so pin it.
test('the signature is stripped-build Chrome, and nothing wider', () => {
  const [browser, version] = AUTOMATED_TRAFFIC_SIGNATURE.andGroup.expressions;

  assert.equal(browser.filter.fieldName, 'browser');
  assert.equal(browser.filter.stringFilter.value, 'Chrome');
  assert.equal(version.filter.fieldName, 'browserVersion');
  assert.equal(version.filter.stringFilter.matchType, 'ENDS_WITH');
  assert.equal(version.filter.stringFilter.value, '.0.0.0');
});

test('a query with no filter of its own gets the exclusion', () => {
  const body = { dateRanges: [{ startDate: '2026-08-30', endDate: '2026-08-30' }] };

  const filtered = withoutAutomatedTraffic(body);

  assert.deepEqual(filtered.dimensionFilter, {
    notExpression: AUTOMATED_TRAFFIC_SIGNATURE,
  });
  assert.deepEqual(filtered.dateRanges, body.dateRanges);
});

// The checkout, funnel and unassigned-traffic queries each carry a
// dimensionFilter that IS the section. Overwriting one would not error — it
// would quietly widen that section to the whole property and report a number
// that looks plausible and is wrong. AND, never replace.
test('an existing filter is preserved and ANDed, never replaced', () => {
  const own = { filter: { fieldName: 'eventName', stringFilter: { value: 'begin_checkout' } } };

  const filtered = withoutAutomatedTraffic({ dimensionFilter: own });

  assert.deepEqual(filtered.dimensionFilter, {
    andGroup: {
      expressions: [own, { notExpression: AUTOMATED_TRAFFIC_SIGNATURE }],
    },
  });
});

test('the caller\'s body is not mutated', () => {
  const own = { filter: { fieldName: 'eventName', stringFilter: { value: 'purchase' } } };
  const body = { dimensionFilter: own, limit: 10 };
  const before = structuredClone(body);

  withoutAutomatedTraffic(body);

  assert.deepEqual(body, before);
});

// The disclosure line must count EXACTLY what the exclusion removed. If these
// two drift apart the email states a subtraction it did not perform, which is
// worse than not filtering at all.
test('the disclosure query counts exactly what the exclusion removes', () => {
  const dateRanges = [{ startDate: '2026-08-24', endDate: '2026-08-30' }];
  const measured = automatedTrafficQuery(dateRanges);
  const excluded = withoutAutomatedTraffic({ dateRanges }).dimensionFilter;

  assert.deepEqual(measured.dimensionFilter, AUTOMATED_TRAFFIC_SIGNATURE);
  assert.deepEqual(excluded, { notExpression: measured.dimensionFilter });
  assert.deepEqual(measured.dateRanges, dateRanges);
});

test('the disclosure query asks for the metrics the email prints', () => {
  const names = automatedTrafficQuery([{ startDate: 'x', endDate: 'y' }])
    .metrics.map((m) => m.name);

  for (const metric of ['sessions', 'totalUsers', 'engagedSessions', 'screenPageViews']) {
    assert.ok(names.includes(metric), `missing ${metric}`);
  }
});

/* ------------------------------------------------- applied, end to end */

import { gather, gatherToday } from '../workers/analytics/src/index.js';

/**
 * A unit test on withoutAutomatedTraffic proves the helper is correct; it does
 * not prove gather() uses it. That gap is exactly where this class of defect
 * lives — one section added later that calls runReport directly and quietly
 * reports contaminated numbers next to clean ones.
 */
function recordingGa4(bodies) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url).includes('runFunnelReport')) {
      return { ok: true, json: async () => ({}) };
    }
    bodies.push(body);
    return {
      ok: true,
      json: async () => ({ dimensionHeaders: [], metricHeaders: [], rows: [] }),
    };
  };
}

const carriesExclusion = (expression) => {
  if (!expression) return false;
  if (expression.notExpression) {
    return JSON.stringify(expression.notExpression).includes('.0.0.0');
  }
  const group = expression.andGroup || expression.orGroup;
  return (group?.expressions || []).some(carriesExclusion);
};

test('gather applies the exclusion to every core query it issues', async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = recordingGa4(bodies);

  try {
    await gather({}, 'test-token', '530829482', Date.parse('2026-08-31T06:00:00Z'));
  } finally {
    globalThis.fetch = originalFetch;
  }

  // The disclosure queries must NOT be filtered — filtering the measurement of
  // what was filtered reports zero, every time.
  const disclosure = bodies.filter((b) => !carriesExclusion(b.dimensionFilter));
  assert.equal(disclosure.length, 2, 'expected exactly the two disclosure queries to be unfiltered');
  for (const body of disclosure) {
    assert.deepEqual(body.dimensionFilter, AUTOMATED_TRAFFIC_SIGNATURE);
  }

  // Everything else is net of automated traffic. Bodies arrive JSON
  // round-tripped, so identity comparison would never match — compare shape.
  const signature = JSON.stringify(AUTOMATED_TRAFFIC_SIGNATURE);
  assert.ok(bodies.length > 10, `only ${bodies.length} queries seen`);
  for (const body of bodies.filter((b) => JSON.stringify(b.dimensionFilter) !== signature)) {
    assert.ok(
      carriesExclusion(body.dimensionFilter),
      `unfiltered query: ${JSON.stringify(body).slice(0, 200)}`,
    );
  }
});

test('the report states what it excluded', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('runFunnelReport')) return { ok: true, json: async () => ({}) };
    const body = JSON.parse(init.body);
    const isDisclosure =
      JSON.stringify(body.dimensionFilter) === JSON.stringify(AUTOMATED_TRAFFIC_SIGNATURE);
    return {
      ok: true,
      json: async () => ({
        dimensionHeaders: [],
        metricHeaders: isDisclosure
          ? [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagedSessions' }, { name: 'screenPageViews' }]
          : [],
        totals: isDisclosure
          ? [{ metricValues: [{ value: '31' }, { value: '31' }, { value: '0' }, { value: '31' }] }]
          : [],
        rows: [],
      }),
    };
  };

  let report;
  try {
    report = await gather({}, 'test-token', '530829482', Date.parse('2026-08-31T06:00:00Z'));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(report.automatedTraffic.available, true);
  assert.equal(report.automatedTraffic.day.sessions, 31);
  assert.equal(report.automatedTraffic.day.engagedSessions, 0);
  assert.equal(report.automatedTraffic.window.totalUsers, 31);
});

test('gatherToday applies the same exclusion, and states it', async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    const isDisclosure =
      JSON.stringify(body.dimensionFilter) === JSON.stringify(AUTOMATED_TRAFFIC_SIGNATURE);
    return {
      ok: true,
      json: async () => ({
        dimensionHeaders: [],
        metricHeaders: isDisclosure
          ? [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagedSessions' }, { name: 'screenPageViews' }]
          : [],
        totals: isDisclosure
          ? [{ metricValues: [{ value: '9' }, { value: '9' }, { value: '0' }, { value: '9' }] }]
          : [],
        rows: [],
      }),
    };
  };

  let today;
  try {
    today = await gatherToday('test-token', '530829482', Date.parse('2026-08-31T12:00:00Z'));
  } finally {
    globalThis.fetch = originalFetch;
  }

  const signature = JSON.stringify(AUTOMATED_TRAFFIC_SIGNATURE);
  const disclosure = bodies.filter((b) => JSON.stringify(b.dimensionFilter) === signature);
  assert.equal(disclosure.length, 1, 'expected exactly one disclosure query');

  // The interaction probes call runReport directly rather than through `call`,
  // which is exactly how a query escapes a chokepoint. Cover every body.
  for (const body of bodies.filter((b) => JSON.stringify(b.dimensionFilter) !== signature)) {
    assert.ok(
      carriesExclusion(body.dimensionFilter),
      `unfiltered query: ${JSON.stringify(body).slice(0, 200)}`,
    );
  }

  assert.equal(today.automatedTraffic.available, true);
  assert.equal(today.automatedTraffic.today.sessions, 9);
  // A consumer reading the JSON must be told the totals are net of something.
  assert.match(today.caveat, /automated/i);
});
