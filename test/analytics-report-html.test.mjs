import assert from 'node:assert/strict';
import test from 'node:test';

import { renderReportHtml } from '../workers/analytics/src/report-html.js';

const baseReport = () => ({
  generatedAt: '2026-08-25T16:47:45.357Z',
  propertyId: '530829482',
  period: {
    current: { start: '2026-08-18', end: '2026-08-24' },
    prior: { start: '2026-08-11', end: '2026-08-17' },
  },
  warnings: [],
  totals: {
    current: {
      sessions: 215, totalUsers: 142, newUsers: 131, screenPageViews: 849,
      engagementRate: 0.623, averageSessionDuration: 583, keyEvents: 522,
    },
    prior: {
      sessions: 200, totalUsers: 149, newUsers: 140, screenPageViews: 454,
      engagementRate: 0.485, averageSessionDuration: 217, keyEvents: 170,
    },
  },
  daily: [],
  channels: [],
  sources: [],
  pages: [],
  landingPages: [],
  countries: [],
  events: [],
  devices: [],
  funnel: [],
  checkoutOutcomes: [
    { event: 'purchase', label: 'Purchase confirmed', eventCount: 0, users: 0, attemptsPerUser: 0, priorEventCount: 1, priorUsers: 1 },
  ],
  checkoutFailureReasons: { available: true, rows: [] },
  orderedCheckout: {
    available: true,
    stages: [
      { event: 'view_item', label: 'Viewed a paid item', users: 7, priorUsers: 4, pctOfFirst: 1, abandonments: 5, abandonmentRate: 0.714 },
      { event: 'purchase', label: 'Purchase confirmed', users: 0, priorUsers: 1, pctOfFirst: 0, abandonments: 0, abandonmentRate: 0 },
    ],
  },
  measurementQuality: {
    sessionSums: { core: 215, daily: 217, channels: 226, landingPages: 231 },
    reconciled: false,
    unassignedBreakdown: { available: true, rows: [] },
  },
});

test('renders a self-contained document with the reporting window in the title', () => {
  const html = renderReportHtml(baseReport());

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /2026-08-18/);
  assert.match(html, /2026-08-24/);
  // Email clients strip external assets; everything must be inline.
  assert.equal(/<link\s/i.test(html), false);
  assert.equal(/<script/i.test(html), false);
  assert.equal(/src=["']http/i.test(html), false);
});

test('never emits NaN or undefined for a sparse report', () => {
  const sparse = baseReport();
  sparse.totals.prior = { sessions: 0, totalUsers: 0, newUsers: 0, screenPageViews: 0, engagementRate: 0, averageSessionDuration: 0, keyEvents: 0 };
  const html = renderReportHtml(sparse);

  assert.equal(html.includes('NaN'), false);
  assert.equal(html.includes('undefined'), false);
});

test('leads with warnings when the report contradicts itself', () => {
  const withWarnings = baseReport();
  withWarnings.warnings = ['The ordered funnel reports 0 users at "Viewed a paid item"'];
  const html = renderReportHtml(withWarnings);

  const warningAt = html.indexOf('Read this first');
  const totalsAt = html.indexOf('Sessions');
  assert.ok(warningAt > -1, 'warning block should render');
  assert.ok(warningAt < totalsAt, 'warnings must appear before the headline metrics');
});

test('escapes values that arrive from GA4 rather than trusting them', () => {
  const hostile = baseReport();
  hostile.pages = [{ path: '/x?<img src=x onerror=alert(1)>', views: 3, users: 1, avgEngagementSeconds: 12 }];
  const html = renderReportHtml(hostile);

  assert.equal(html.includes('<img src=x'), false);
  assert.match(html, /&lt;img src=x/);
});

test('withholds the ordered funnel instead of drawing an all-zero path', () => {
  const withheld = baseReport();
  withheld.orderedCheckout = { available: false, error: 'funnel response contained no rows', stages: [] };
  const html = renderReportHtml(withheld);

  assert.match(html, /funnel response contained no rows/);
  assert.equal(/Viewed a paid item<\/td>/.test(html), false);
});

test('shows the prior-week purchase that the swapped queries used to erase', () => {
  const html = renderReportHtml(baseReport());
  assert.match(html, /Purchase confirmed/);
  // 0 this week against 1 last week is the finding; it must be visible.
  assert.match(html, /-100(\.0)?%|1<\/td>/);
});

test('renders Cloudflare edge traffic beside the GA4 figures', () => {
  const withEdge = baseReport();
  withEdge.edge = {
    available: true,
    totals: { requests: 93126, pageViews: 52518, threats: 364, uniques: 7774 },
    comparison: [
      { country: 'US', requests: 67261, threats: 33, sessions: 19, requestsPerSession: 3540.1 },
      { country: 'HK', requests: 3702, threats: 0, sessions: 0, requestsPerSession: null },
    ],
    browsers: { rows: [{ browser: 'Unknown', pageViews: 40908 }], unidentified: 0, totalPageViews: 52518 },
  };
  const html = renderReportHtml(withEdge);

  assert.match(html, /Edge traffic/);
  assert.match(html, /93,126/);
  // A country GA4 never saw must read as absent, not as an infinite ratio.
  assert.match(html, /no GA4 data/);
  assert.equal(html.includes('Infinity'), false);
});

test('says why edge traffic is missing rather than omitting the section', () => {
  const noEdge = baseReport();
  noEdge.edge = { available: false, reason: 'not_configured', hint: 'Set the CLOUDFLARE_ANALYTICS_TOKEN secret' };
  const html = renderReportHtml(noEdge);

  assert.match(html, /Edge traffic/);
  assert.match(html, /CLOUDFLARE_ANALYTICS_TOKEN/);
});
