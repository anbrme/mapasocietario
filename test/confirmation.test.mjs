import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationStatus } from '../functions/empresa/_confirmation.js';

const DAY = 86_400_000;
const at = (iso, days) => Date.parse(iso + 'T00:00:00Z') + days * DAY;

test('same-day confirmation is fresh, age 0', () => {
  const s = confirmationStatus('2026-06-28', at('2026-06-28', 0));
  assert.deepEqual(s, { ageDays: 0, level: 'fresh' });
});

test('90 days is still fresh, 91 days flips to aging', () => {
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 90)).level, 'fresh');
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 91)).level, 'aging');
});

test('365 days is aging, 366 days flips to stale', () => {
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 365)).level, 'aging');
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 366)).level, 'stale');
});

test('future or unparseable dates: never negative age; null on garbage', () => {
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', -5)).ageDays, 0);
  assert.equal(confirmationStatus('not-a-date', Date.now()), null);
});
