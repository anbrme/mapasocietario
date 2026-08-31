import assert from 'node:assert/strict';
import test from 'node:test';

import worker, {
  cleanFunnelStepName,
  delta,
  duration,
  funnelHasRows,
  gather,
  gatherToday,
  orderedFunnelFrom,
  periods,
  reportWarnings,
} from '../workers/analytics/src/index.js';

test('periods uses two adjacent complete seven-day windows', () => {
  const result = periods(Date.parse('2026-08-25T14:30:00Z'));

  assert.deepEqual(result, {
    day: { start: '2026-08-24', end: '2026-08-24' },
    priorDay: { start: '2026-08-17', end: '2026-08-17' },
    current: { start: '2026-08-18', end: '2026-08-24' },
    prior: { start: '2026-08-11', end: '2026-08-17' },
  });
});

// A daily report compared against the day before would read Monday against
// Sunday every week and call the weekday shape a collapse. The comparison day
// must always be the same weekday, seven days back.
test('the daily comparison is the same weekday a week earlier, not yesterday', () => {
  const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
  for (const at of ['2026-08-25T07:30:00Z', '2026-08-24T07:30:00Z',
                    '2026-08-23T07:30:00Z', '2026-09-01T07:30:00Z']) {
    const p = periods(Date.parse(at));
    assert.equal(weekday(p.day.start), weekday(p.priorDay.start),
      `${at}: ${p.day.start} and ${p.priorDay.start} must fall on the same weekday`);
    const gapDays = (Date.parse(p.day.start) - Date.parse(p.priorDay.start)) / 86400000;
    assert.equal(gapDays, 7);
  }
});

test('the headline day is a single complete day, not a range', () => {
  const p = periods(Date.parse('2026-08-25T07:30:00Z'));
  assert.equal(p.day.start, p.day.end);
  assert.equal(p.priorDay.start, p.priorDay.end);
  // and it is yesterday, never today: today is still being written.
  assert.equal(p.day.start, '2026-08-24');
});

test('today snapshot queries only today and reads newly registered interaction dimensions', async () => {
  const originalFetch = globalThis.fetch;
  const seenRanges = [];

  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    seenRanges.push(body.dateRanges);
    const dimensions = (body.dimensions || []).map((dimension) => dimension.name);
    const metrics = (body.metrics || []).map((metric) => metric.name);
    const customDimension = dimensions.find((name) => name.startsWith('customEvent:'));
    const eventName = body.dimensionFilter?.filter?.stringFilter?.value;

    if (customDimension) {
      return {
        ok: true,
        json: async () => ({
          rows: [{
            dimensionValues: [{ value: eventName }, { value: 'double_click' }],
            metricValues: [{ value: '3' }, { value: '2' }],
          }],
        }),
      };
    }

    if (dimensions.length === 0) {
      return {
        ok: true,
        json: async () => ({
          rows: [{ metricValues: metrics.map((name) => ({
            value: name === 'totalUsers' ? '20' : '1',
          })) }],
        }),
      };
    }

    return { ok: true, json: async () => ({ rows: [] }) };
  };

  try {
    const report = await gatherToday(
      'test-token',
      '530829482',
      Date.parse('2026-08-26T12:00:00Z'),
    );

    assert.equal(report.window.partial, true);
    assert.equal(report.totals.totalUsers, 20);
    assert.equal(report.interactionProbes.length, 4);
    assert.equal(report.interactionProbes[0].populated, true);
    assert.equal(report.interactionProbes[0].breakdown[0].value, 'double_click');
    assert.ok(
      seenRanges.every(
        (ranges) => ranges[0].startDate === 'today' && ranges[0].endDate === 'today',
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('formatters handle report values', () => {
  assert.equal(delta(215, 200), '+7.5%');
  assert.equal(delta(0, 0), '0%');
  assert.equal(delta(3, 0), 'new');
  assert.equal(duration(583), '9m 43s');
});

test('ordered funnel parser reads step names and compares against the prior week', () => {
  const labels = [
    'Viewed a paid item',
    'Submitted checkout',
    'Redirected to payment/order',
    'Purchase confirmed',
  ];
  // Mirrors the live response: GA4 repeats the metric header block and uses
  // funnelStep-prefixed metric names. An earlier version of this test invented
  // four unique headers named completionRate/abandonments/abandonmentRate,
  // which GA4 does not emit — so it passed while the live funnel read zero.
  const response = (users) => ({
    funnelTable: {
      dimensionHeaders: [{ name: 'funnelStepName' }],
      metricHeaders: [
        { name: 'activeUsers' },
        { name: 'funnelStepCompletionRate' },
        { name: 'funnelStepAbandonments' },
        { name: 'funnelStepAbandonmentRate' },
        { name: 'activeUsers' },
        { name: 'funnelStepCompletionRate' },
        { name: 'funnelStepAbandonments' },
        { name: 'funnelStepAbandonmentRate' },
      ],
      rows: users.map((value, index) => ({
        dimensionValues: [{ value: `${index + 1}. ${labels[index]}` }],
        metricValues: [
          { value: String(value) },
          { value: '0.5' },
          { value: '1' },
          { value: '0.5' },
        ],
      })),
    },
  });

  assert.equal(cleanFunnelStepName('2. Submitted checkout'), 'Submitted checkout');
  const result = orderedFunnelFrom(response([10, 6, 4, 2]), response([8, 4, 2, 1]));
  assert.equal(result[1].users, 6);
  assert.equal(result[1].priorUsers, 4);
  assert.equal(result[3].pctOfFirst, 0.2);
  assert.equal(result[1].abandonments, 1);
});

test('scheduled handler registers a failing pull with waitUntil', async () => {
  const pending = [];
  const originalError = console.error;
  console.error = () => {};

  try {
    await worker.scheduled(
      { scheduledTime: Date.parse('2026-08-21T14:30:00Z') },
      {},
      { waitUntil: (promise) => pending.push(promise) },
    );

    assert.equal(pending.length, 1);
    await assert.rejects(pending[0], /GA_SA_KEY secret is not set/);
  } finally {
    console.error = originalError;
  }
});

/* ------------------------------------------------------------------------
 * Fixtures below are VERBATIM GA4 responses captured from property 530829482
 * on 2026-08-25 for the 2026-08-18..24 window. The pre-existing funnel test
 * above used a hand-written response whose shape GA4 never actually returns,
 * which is exactly why it stayed green while the live funnel reported zeros.
 * ---------------------------------------------------------------------- */

// The real funnel response repeats the metric header block (8 headers) while
// each row carries only 4 values.
const REAL_FUNNEL_RESPONSE = {
  funnelTable: {
    dimensionHeaders: [{ name: 'funnelStepName' }],
    metricHeaders: [
      { name: 'activeUsers', type: 'TYPE_INTEGER' },
      { name: 'funnelStepCompletionRate', type: 'TYPE_INTEGER' },
      { name: 'funnelStepAbandonments', type: 'TYPE_INTEGER' },
      { name: 'funnelStepAbandonmentRate', type: 'TYPE_INTEGER' },
      { name: 'activeUsers', type: 'TYPE_INTEGER' },
      { name: 'funnelStepCompletionRate', type: 'TYPE_INTEGER' },
      { name: 'funnelStepAbandonments', type: 'TYPE_INTEGER' },
      { name: 'funnelStepAbandonmentRate', type: 'TYPE_INTEGER' },
    ],
    rows: [
      {
        dimensionValues: [{ value: '1. Viewed a paid item' }],
        metricValues: [
          { value: '7' },
          { value: '0.2857142857142857' },
          { value: '5' },
          { value: '0.7142857142857143' },
        ],
      },
      {
        dimensionValues: [{ value: '2. Submitted checkout' }],
        metricValues: [{ value: '2' }, { value: '1' }, { value: '0' }, { value: '0' }],
      },
      {
        dimensionValues: [{ value: '3. Redirected to payment/order' }],
        metricValues: [{ value: '2' }, { value: '0' }, { value: '2' }, { value: '1' }],
      },
    ],
    metadata: {},
  },
  kind: 'analyticsData#runFunnelReport',
};

test('ordered funnel survives GA4 repeating its metric header block', () => {
  const stages = orderedFunnelFrom(REAL_FUNNEL_RESPONSE, REAL_FUNNEL_RESPONSE);

  // Before the fix the duplicated 'activeUsers' header read past the end of the
  // row and overwrote every real value with 0.
  assert.equal(stages[0].users, 7);
  assert.equal(stages[1].users, 2);
  assert.equal(stages[2].users, 2);

  // A stage GA4 omits entirely (nobody reached it) is a real zero.
  assert.equal(stages[3].users, 0);

  assert.equal(stages[0].abandonments, 5);
  assert.ok(Math.abs(stages[0].abandonmentRate - 0.7142857142857143) < 1e-9);
  assert.ok(Math.abs(stages[0].pctOfFirst - 1) < 1e-9);
  assert.ok(Math.abs(stages[2].pctOfFirst - 2 / 7) < 1e-9);
});

test('funnel section is unavailable — not zero — when GA4 returns no rows', () => {
  const empty = { funnelTable: { dimensionHeaders: [], metricHeaders: [], rows: [] } };
  const stages = orderedFunnelFrom(empty, empty);

  // Every stage reads 0 here, which is indistinguishable from "nobody
  // converted". gatherOrderedCheckout must therefore refuse to publish it.
  assert.ok(stages.every((s) => s.users === 0));
  assert.equal(funnelHasRows(empty), false);
  assert.equal(funnelHasRows(REAL_FUNNEL_RESPONSE), true);
});

/**
 * Every value a GA4 dimensionFilter positively selects on, at any depth.
 */
function collectFilterValues(expression) {
  if (!expression) return [];
  if (expression.notExpression) return [];
  if (expression.andGroup || expression.orGroup) {
    const group = expression.andGroup || expression.orGroup;
    return (group.expressions || []).flatMap(collectFilterValues);
  }
  const filter = expression.filter;
  if (!filter) return [];
  if (filter.inListFilter?.values) return filter.inListFilter.values;
  if (filter.stringFilter) return [filter.stringFilter.value];
  return [];
}

/**
 * Canned GA4 responses keyed by what each request actually asks for. This is
 * the test the swapped-destructuring bug needed: it asserts that each parsed
 * section came from the query that was meant to feed it.
 */
function stubGa4() {
  const reply = (dimensionHeaders, rows) => ({
    dimensionHeaders: dimensionHeaders.map((name) => ({ name })),
    metricHeaders: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    rows,
    kind: 'analyticsData#runReport',
  });
  const eventRow = (name, count, users) => ({
    dimensionValues: [{ value: name }],
    metricValues: [{ value: String(count) }, { value: String(users) }],
  });

  return async (url, init) => {
    const body = JSON.parse(init.body);
    const isPrior = JSON.stringify(body.dateRanges).includes('2026-08-11');
    const dims = (body.dimensions || []).map((d) => d.name);
    // What the query POSITIVELY asks for. Every request now also carries the
    // automated-traffic exclusion, which nests the caller's own filter inside
    // an andGroup, so this walks the tree rather than assuming a flat filter.
    // notExpression subtrees are skipped on purpose: they are what the query
    // excludes, not what it is asking for.
    const filterValues = collectFilterValues(body.dimensionFilter);
    const json = (payload) => ({ ok: true, json: async () => payload });

    if (String(url).includes('runFunnelReport')) return json(REAL_FUNNEL_RESPONSE);

    // The failure-reason probe: current window, checkout_failed, with the
    // reason dimension. GA4 returned NO rows for this in the real window.
    if (dims.includes('customEvent:reason')) {
      return json(reply(['eventName', 'customEvent:reason'], []));
    }

    if (filterValues.includes('checkout_redirect')) {
      return json(
        reply(
          ['eventName'],
          isPrior
            ? [eventRow('view_item', 5, 4), eventRow('begin_checkout', 1, 1), eventRow('purchase', 1, 1)]
            : [eventRow('view_item', 24, 7), eventRow('begin_checkout', 18, 3), eventRow('checkout_redirect', 13, 2)],
        ),
      );
    }

    // Everything else (totals, daily, channels, pages, ...) can be empty; this
    // test is about which query feeds which section.
    return json(reply(dims, []));
  };
}

test('checkout priors and failure reasons come from their own queries', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubGa4();

  try {
    const report = await gather({}, 'test-token', '530829482', Date.parse('2026-08-25T14:30:00Z'));

    const purchase = report.checkoutOutcomes.find((o) => o.event === 'purchase');
    // The prior week really did contain one purchase. The swapped destructuring
    // fed priors from the failure-reason query, erasing it and labelling every
    // checkout row "new".
    assert.equal(purchase.priorEventCount, 1);
    assert.equal(purchase.priorUsers, 1);

    const viewItem = report.checkoutOutcomes.find((o) => o.event === 'view_item');
    assert.equal(viewItem.eventCount, 24);
    assert.equal(viewItem.priorEventCount, 5);

    // GA4 returned no checkout_failed rows, so there are no failure reasons.
    assert.equal(report.checkoutFailureReasons.available, true);
    assert.deepEqual(report.checkoutFailureReasons.rows, []);

    const failed = report.checkoutOutcomes.find((o) => o.event === 'checkout_failed');
    assert.equal(failed.eventCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('warns that checkout_redirect cannot be read as lost revenue', () => {
  // checkout_redirect fires for free_order too, and a waived report never
  // produces a purchase event by design. Reading "13 redirects, 0 purchases"
  // as abandonment is therefore unsound unless `destination` is registered.
  const warnings = reportWarnings({
    checkoutOutcomes: [
      { event: 'checkout_redirect', label: 'Redirected to payment/order', eventCount: 13, users: 2 },
      { event: 'purchase', label: 'Purchase confirmed', eventCount: 0, users: 0 },
    ],
    checkoutFailureReasons: { available: true, rows: [] },
    measurementQuality: { sessionSums: { core: 1, daily: 1, channels: 1, landingPages: 1 }, reconciled: true },
  });

  assert.ok(
    warnings.some((w) => /free_order|free report/i.test(w) && /destination/i.test(w)),
    `expected a free-order caveat, got: ${JSON.stringify(warnings)}`,
  );
});

test('reads the destination split once GA4 starts populating it', () => {
  // All free: zero purchases is the system working, not revenue lost.
  const allFree = reportWarnings({
    checkoutOutcomes: [
      { event: 'checkout_redirect', eventCount: 13, users: 2 },
      { event: 'purchase', eventCount: 0, users: 0 },
    ],
    checkoutDestinations: { available: true, rows: [{ destination: 'free_order', eventCount: 13, users: 2 }] },
    checkoutFailureReasons: { available: true, rows: [] },
    measurementQuality: { sessionSums: { core: 1, daily: 1, channels: 1, landingPages: 1 }, reconciled: true },
  });
  assert.ok(allFree.some((w) => /all .*free_order|no paid checkout/i.test(w)));
  assert.equal(allFree.some((w) => /cannot be interpreted/i.test(w)), false);

  // Paid redirects with no purchase IS the alarming case, and must escalate.
  const paidStalled = reportWarnings({
    checkoutOutcomes: [
      { event: 'checkout_redirect', eventCount: 10, users: 4 },
      { event: 'purchase', eventCount: 0, users: 0 },
    ],
    checkoutDestinations: {
      available: true,
      rows: [
        { destination: 'stripe_new_tab', eventCount: 7, users: 3 },
        { destination: 'free_order', eventCount: 3, users: 1 },
      ],
    },
    checkoutFailureReasons: { available: true, rows: [] },
    measurementQuality: { sessionSums: { core: 1, daily: 1, channels: 1, landingPages: 1 }, reconciled: true },
  });
  assert.ok(
    paidStalled.some((w) => /7 paid checkout/i.test(w)),
    `expected a paid-stall warning, got: ${JSON.stringify(paidStalled)}`,
  );
});

test('does not call a redirect free when it carries no destination at all', () => {
  // The 21-27 Aug report announced "all of them were free_order" off 1 tagged
  // free_order and 11 "(not set)". destinationRows drops the untagged rows, so
  // paidRedirects === 0 was read as proof no paid checkout started — a claim
  // about 12 events built from 1. `destination` was registered mid-flight and
  // registration is not retroactive: an untagged redirect is UNKNOWN, not free.
  const warnings = reportWarnings({
    checkoutOutcomes: [
      { event: 'checkout_redirect', eventCount: 12, users: 2 },
      { event: 'purchase', eventCount: 0, users: 0 },
    ],
    checkoutDestinations: {
      available: true,
      rows: [
        { destination: '(not set)', eventCount: 11, users: 2 },
        { destination: 'free_order', eventCount: 1, users: 1 },
      ],
    },
    checkoutFailureReasons: { available: true, rows: [] },
    measurementQuality: { sessionSums: { core: 1, daily: 1, channels: 1, landingPages: 1 }, reconciled: true },
  });

  const w = warnings.find((x) => /checkout redirect/i.test(x));
  assert.ok(w, `expected a checkout warning, got: ${JSON.stringify(warnings)}`);
  assert.doesNotMatch(w, /all of them/i);
  assert.match(w, /11/, `the unattributed count must be stated: ${w}`);
});

test('a paid stall still reports the redirects it could not classify', () => {
  const warnings = reportWarnings({
    checkoutOutcomes: [
      { event: 'checkout_redirect', eventCount: 10, users: 4 },
      { event: 'purchase', eventCount: 0, users: 0 },
    ],
    checkoutDestinations: {
      available: true,
      rows: [
        { destination: 'stripe_new_tab', eventCount: 4, users: 3 },
        { destination: '(not set)', eventCount: 6, users: 2 },
      ],
    },
    checkoutFailureReasons: { available: true, rows: [] },
    measurementQuality: { sessionSums: { core: 1, daily: 1, channels: 1, landingPages: 1 }, reconciled: true },
  });

  const w = warnings.find((x) => /paid checkout/i.test(x));
  assert.ok(w, `expected a paid-stall warning, got: ${JSON.stringify(warnings)}`);
  assert.match(w, /4 paid checkout/i);
  assert.match(w, /6/, `the unattributed remainder must survive: ${w}`);
});

test('does not raise the free-order caveat once purchases are recorded', () => {
  const warnings = reportWarnings({
    checkoutOutcomes: [
      { event: 'checkout_redirect', eventCount: 13, users: 2 },
      { event: 'purchase', eventCount: 3, users: 3 },
    ],
    checkoutFailureReasons: { available: true, rows: [] },
    measurementQuality: { sessionSums: { core: 1, daily: 1, channels: 1, landingPages: 1 }, reconciled: true },
  });

  assert.equal(warnings.some((w) => /free_order/i.test(w)), false);
});

test('flags checkout submissions that ended in neither a redirect nor a failure', () => {
  // Every terminal path is instrumented, so begin_checkout should be matched
  // by a redirect or a failure. A shortfall means attempts died silently.
  const warnings = reportWarnings({
    checkoutOutcomes: [
      { event: 'begin_checkout', eventCount: 18, users: 3 },
      { event: 'checkout_redirect', eventCount: 13, users: 2 },
      { event: 'checkout_failed', eventCount: 0, users: 0 },
      { event: 'purchase', eventCount: 0, users: 0 },
    ],
    checkoutFailureReasons: { available: true, rows: [] },
    measurementQuality: { sessionSums: { core: 1, daily: 1, channels: 1, landingPages: 1 }, reconciled: true },
  });

  assert.ok(
    warnings.some((w) => /5 checkout submission/i.test(w)),
    `expected a silent-submission warning, got: ${JSON.stringify(warnings)}`,
  );
});

test('report warns when independent measures of the same thing disagree', () => {
  const warnings = reportWarnings({
    orderedCheckout: { available: true, stages: [{ event: 'view_item', users: 0 }] },
    checkoutOutcomes: [{ event: 'view_item', users: 7, eventCount: 24 }],
    checkoutFailureReasons: { available: true, rows: [{ reason: '(not set)', eventCount: 7, users: 4 }] },
    measurementQuality: { sessionSums: { core: 215, daily: 215, channels: 215, landingPages: 215 }, reconciled: true },
  });

  assert.ok(warnings.some((w) => /ordered funnel/i.test(w)));
  assert.ok(warnings.some((w) => /checkout_failed/i.test(w)));
});
