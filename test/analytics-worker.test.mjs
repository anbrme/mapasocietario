import assert from 'node:assert/strict';
import test from 'node:test';

import worker, {
  delta,
  duration,
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
