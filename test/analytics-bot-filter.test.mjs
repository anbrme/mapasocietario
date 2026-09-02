import assert from 'node:assert/strict';
import test from 'node:test';

import { gather, gatherToday } from '../workers/analytics/src/index.js';

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

function hasReducedChromeFilter(body) {
  return JSON.stringify(body).includes('.0.0.0');
}

test('the weekly report does not exclude normal reduced Chrome versions', async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = recordingGa4(bodies);

  let report;
  try {
    report = await gather({}, 'test-token', '530829482', Date.parse('2026-09-02T06:00:00Z'));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(bodies.length > 10, `only ${bodies.length} queries seen`);
  assert.equal(bodies.some(hasReducedChromeFilter), false);
  assert.equal(Object.hasOwn(report, 'automatedTraffic'), false);
});

test('the intraday report returns raw GA4 data without a browser-version exclusion', async () => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = recordingGa4(bodies);

  let report;
  try {
    report = await gatherToday('test-token', '530829482', Date.parse('2026-09-02T12:00:00Z'));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(bodies.length > 5, `only ${bodies.length} queries seen`);
  assert.equal(bodies.some(hasReducedChromeFilter), false);
  assert.equal(Object.hasOwn(report, 'automatedTraffic'), false);
  assert.match(report.caveat, /raw GA4 data/i);
  assert.match(report.caveat, /no custom browser-version bot exclusion/i);
});
