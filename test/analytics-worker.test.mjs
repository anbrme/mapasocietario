import assert from 'node:assert/strict';
import test from 'node:test';

import worker, {
  cleanFunnelStepName,
  delta,
  duration,
  funnelHasRows,
  gather,
  orderedFunnelFrom,
  periods,
  reportWarnings,
} from '../workers/analytics/src/index.js';

test('periods uses two adjacent complete seven-day windows', () => {
  const result = periods(Date.parse('2026-08-25T14:30:00Z'));

  assert.deepEqual(result, {
    current: { start: '2026-08-18', end: '2026-08-24' },
    prior: { start: '2026-08-11', end: '2026-08-17' },
  });
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
    const filterValues =
      body.dimensionFilter?.filter?.inListFilter?.values ||
      (body.dimensionFilter?.filter?.stringFilter
        ? [body.dimensionFilter.filter.stringFilter.value]
        : []);
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
