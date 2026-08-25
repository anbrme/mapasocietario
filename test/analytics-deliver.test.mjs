import assert from 'node:assert/strict';
import test from 'node:test';

import { sendReportEmail } from '../workers/analytics/src/deliver.js';

const report = {
  period: { current: { start: '2026-08-18', end: '2026-08-24' }, prior: { start: '2026-08-11', end: '2026-08-17' } },
  totals: { current: { sessions: 215 }, prior: { sessions: 200 } },
  warnings: [],
  checkoutOutcomes: [],
};

test('does nothing, and says so, when email is not configured', async () => {
  const result = await sendReportEmail({}, report);
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'not_configured');
});

test('posts a multipart-capable payload in the REST API shape', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok: true, status: 200, text: async () => '{}' };
  };

  try {
    const result = await sendReportEmail(
      {
        CLOUDFLARE_EMAIL_API_TOKEN: 'test-token',
        CF_ACCOUNT_ID: 'acct123',
        REPORT_EMAIL_FROM: 'analytics@ncdata.eu',
        REPORT_EMAIL_TO: 'someone@ncdata.eu',
      },
      report,
    );

    assert.equal(result.sent, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /accounts\/acct123\/email\/sending\/send$/);
    assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');

    const body = JSON.parse(calls[0].init.body);
    // REST API uses `address` (not `email`) and snake_case reply_to.
    assert.equal(body.from.address, 'analytics@ncdata.eu');
    assert.equal(body.to[0].address, 'someone@ncdata.eu');
    assert.match(body.subject, /2026-08-18/);
    assert.ok(body.html.includes('<!doctype html>'));
    assert.ok(body.text.length > 0, 'a plain-text alternative must always be attached');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a failed send is reported, never thrown — the pull must still succeed', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 403, text: async () => 'forbidden' });

  try {
    const result = await sendReportEmail({ CLOUDFLARE_EMAIL_API_TOKEN: 't', CF_ACCOUNT_ID: 'a' }, report);
    assert.equal(result.sent, false);
    assert.equal(result.status, 403);
    assert.match(result.error, /forbidden/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a network failure is caught rather than killing the scheduled run', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('connection reset'); };

  try {
    const result = await sendReportEmail({ CLOUDFLARE_EMAIL_API_TOKEN: 't', CF_ACCOUNT_ID: 'a' }, report);
    assert.equal(result.sent, false);
    assert.match(result.error, /connection reset/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the subject flags a report that carries warnings', async () => {
  const bodies = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, text: async () => '{}' }; };

  try {
    await sendReportEmail({ CLOUDFLARE_EMAIL_API_TOKEN: 't', CF_ACCOUNT_ID: 'a' }, { ...report, warnings: ['something disagrees'] });
    assert.match(bodies[0].subject, /⚠|warning/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
