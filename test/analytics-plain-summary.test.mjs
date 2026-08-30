import assert from 'node:assert/strict';
import test from 'node:test';

import { plainSummary } from '../workers/analytics/src/index.js';

const base = {
  totals: {
    current: { totalUsers: 284, sessions: 372, engagementRate: 0.64 },
    prior: { totalUsers: 167, sessions: 239, engagementRate: 0.59 },
  },
  channels: [{ channel: 'Organic Search', sessions: 267 }, { channel: 'Direct', sessions: 95 }],
  searchConsole: {
    available: true,
    dataThrough: '2026-08-27',
    lagDays: 2,
    window: { clicks: 343, impressions: 20520, ctr: 0.0167, position: 10.4 },
    priorWindowTotals: { clicks: 115, impressions: 8761 },
    provisional: { days: [{}, {}], through: '2026-08-29', clicksSoFar: 89 },
  },
  checkoutOutcomes: [
    { event: 'view_item', eventCount: 30, users: 13 },
    { event: 'checkout_redirect', eventCount: 12, users: 3 },
    { event: 'purchase', eventCount: 0, users: 0 },
  ],
  checkoutDestinations: { rows: [{ destination: '(not set)', eventCount: 11 }] },
  edge: { available: true, totals: { requests: 127002, pageViews: 64898 } },
  warnings: ['something is off'],
};

const text = (r) => plainSummary(r).join('\n');

test('it leads with people, not sessions, and names the direction', () => {
  const s = text(base);
  assert.match(s, /284 people/);
  assert.match(s, /167/);
  assert.match(s, /\bup\b/i);
});

test('it explains that a lower search position is better', () => {
  // "Average position 10.4" is meaningless to someone who does not already know
  // the scale runs upward from 1.
  assert.match(text(base), /lower is better/i);
});

test('zero purchases is stated without being called lost revenue', () => {
  const s = text(base);
  assert.match(s, /[Nn]obody bought/);
  // 11 of the 12 redirects carry no destination, so they cannot be classified.
  assert.match(s, /cannot/i);
  assert.doesNotMatch(s, /lost (revenue|sales)/i);
});

test('a real purchase is reported as such', () => {
  const s = text({
    ...base,
    checkoutOutcomes: [
      { event: 'checkout_redirect', eventCount: 4, users: 2 },
      { event: 'purchase', eventCount: 2, users: 2 },
    ],
  });
  assert.match(s, /2 reports were bought/);
  assert.doesNotMatch(s, /[Nn]obody bought/);
});

test('it says plainly that most server traffic is automated', () => {
  assert.match(text(base), /automated/i);
});

test('it points at the untrustworthy figures rather than hiding them', () => {
  assert.match(text(base), /Read this first/);
});

test('a flat week is not described as growth', () => {
  const s = text({
    ...base,
    totals: { current: { totalUsers: 170, sessions: 240 }, prior: { totalUsers: 167, sessions: 239 } },
  });
  assert.match(s, /about the same/i);
});

test('it survives a report with nothing in it', () => {
  assert.doesNotThrow(() => plainSummary({}));
  assert.doesNotThrow(() => plainSummary({ totals: {} }));
  assert.ok(Array.isArray(plainSummary({})));
});

test('it does not invent a search line when Search Console is unavailable', () => {
  const s = text({ ...base, searchConsole: { available: false, reason: 'no key' } });
  assert.doesNotMatch(s, /Google showed/);
});

// A sentence about people must count people. checkout_redirect fired 12 times
// across 3 users; saying "12 reached the payment step" overstates it fourfold.
test('people sentences never quote an event count', () => {
  const s = text(base);
  assert.match(s, /3 people reached the payment step/);
  assert.doesNotMatch(s, /12 people/);
});

test('one of a thing is not written as "1 people"', () => {
  const s = text({
    ...base,
    checkoutOutcomes: [
      { event: 'view_item', eventCount: 1, users: 1 },
      { event: 'checkout_redirect', eventCount: 1, users: 1 },
      { event: 'purchase', eventCount: 0, users: 0 },
    ],
    checkoutDestinations: { rows: [] },
    warnings: ['one thing'],
  });
  assert.match(s, /1 person opened the checkout/);
  assert.match(s, /1 figure in this report/);
  assert.doesNotMatch(s, /\(s\)/);
});
