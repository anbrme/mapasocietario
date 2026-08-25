import assert from 'node:assert/strict';
import test from 'node:test';

import worker, {
  cleanFunnelStepName,
  delta,
  duration,
  orderedFunnelFrom,
  periods,
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

test('ordered funnel parser uses response headers and prior comparison', () => {
  const labels = [
    'Viewed a paid item',
    'Submitted checkout',
    'Redirected to payment/order',
    'Purchase confirmed',
  ];
  const response = (users) => ({
    funnelTable: {
      dimensionHeaders: [{ name: 'funnelStepName' }],
      metricHeaders: [
        { name: 'activeUsers' },
        { name: 'completionRate' },
        { name: 'abandonments' },
        { name: 'abandonmentRate' },
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
  const result = orderedFunnelFrom(
    response([10, 6, 4, 2]),
    response([8, 4, 2, 1]),
  );
  assert.equal(result[1].users, 6);
  assert.equal(result[1].priorUsers, 4);
  assert.equal(result[3].pctOfFirst, 0.2);
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
