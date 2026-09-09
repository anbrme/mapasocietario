/**
 * Route-level wiring test for GET /verificacion/p/<token>.
 *
 * preview.test.js covers previewGrantAllows() in isolation and
 * _page_headers.test.js covers the header helper in isolation, but nothing
 * previously asserted that THIS route actually wires them together: that a
 * valid preview grant is passed to handleCompany with privateResponse: true,
 * that the response headers survive the trip back, and that no
 * page-view-analytics reaches a preview at all. That gap is exactly what let
 * a live grant token leak into GA4 (see functions/empresa/_lib.js item 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../empresa/_lib.js', () => ({
  handleCompany: vi.fn(),
}));

import { onRequestGet } from './[token].js';
import { handleCompany } from '../../empresa/_lib.js';

// A minimal fake D1 binding that answers every query onRequestGet issues,
// routed by a distinctive substring of the SQL text.
function fakeDb({ grant = null, attestation = null } = {}) {
  return {
    prepare(sql) {
      return {
        bind: () => ({
          first: async () => {
            if (/FROM view_grants WHERE token_hash/.test(sql)) return grant;
            if (/FROM attestations a/.test(sql)) return attestation;
            return null;
          },
          all: async () => {
            if (/FROM attestation_facts/.test(sql)) return { results: [] };
            if (/FROM audit_events/.test(sql)) return { results: [] };
            return { results: [] };
          },
          run: async () => ({ success: true }),
        }),
      };
    },
  };
}

const grant = (overrides = {}) => ({
  token_hash: 'th_1',
  attestation_id: 'att_1',
  kind: 'preview',
  expires_at: '2099-01-01T00:00:00Z',
  revoked_at: null,
  ...overrides,
});

const attestation = (overrides = {}) => ({
  id: 'att_1',
  status: 'live',
  display_name: 'ACME SL',
  ...overrides,
});

const request = (token = 'sometoken') => new Request(`https://x/verificacion/p/${token}`);
const ctx = (env, token = 'sometoken') =>
  ({ request: request(token), params: { token }, env, waitUntil: () => {} });

const MOCK_HTML = '<!doctype html><html><head><title>ACME SL</title></head>'
  + '<body><h1>ACME SL</h1></body></html>';

const mockHandleCompanyResponse = () => new Response(MOCK_HTML, {
  status: 200,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'private, no-store',
    'referrer-policy': 'no-referrer',
    'x-robots-tag': 'noindex, nofollow, noarchive',
  },
});

describe('GET /verificacion/p/<token>', () => {
  beforeEach(() => {
    handleCompany.mockReset();
    handleCompany.mockResolvedValue(mockHandleCompanyResponse());
  });

  it('a valid preview grant is passed to handleCompany with privateResponse: true', async () => {
    const env = { VERIFY_DB: fakeDb({ grant: grant(), attestation: attestation() }) };
    const response = await onRequestGet(ctx(env));

    expect(handleCompany).toHaveBeenCalledTimes(1);
    const options = handleCompany.mock.calls[0][2];
    expect(options.privateResponse).toBe(true);

    const html = await response.text();
    // The banner is injected by the route itself, not by handleCompany.
    expect(html).toContain('vp-banner');

    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');

    // Regression guard for item 1: nothing on a preview page may load GA4.
    expect(html.toLowerCase()).not.toContain('googletagmanager');
  });

  const NOT_FOUND_BODY = JSON.stringify({ ok: false, error: 'not_found' });

  async function expectNotFound(env, token = 'sometoken') {
    const response = await onRequestGet(ctx(env, token));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe(NOT_FOUND_BODY);
    expect(handleCompany).not.toHaveBeenCalled();
  }

  it('returns the standard 404 for a revoked grant', async () => {
    const env = { VERIFY_DB: fakeDb({
      grant: grant({ revoked_at: '2026-09-09T00:00:00Z' }), attestation: attestation(),
    }) };
    await expectNotFound(env);
  });

  it('returns the standard 404 for an expired grant', async () => {
    const env = { VERIFY_DB: fakeDb({
      grant: grant({ expires_at: '2000-01-01T00:00:00Z' }), attestation: attestation(),
    }) };
    await expectNotFound(env);
  });

  it('returns the standard 404 for a counterparty-kind token', async () => {
    const env = { VERIFY_DB: fakeDb({
      grant: grant({ kind: 'counterparty' }), attestation: attestation(),
    }) };
    await expectNotFound(env);
  });

  it('returns the standard 404 for an unknown token', async () => {
    const env = { VERIFY_DB: fakeDb({ grant: null, attestation: null }) };
    await expectNotFound(env);
  });

  it('returns the standard 404 for a pending_review attestation', async () => {
    const env = { VERIFY_DB: fakeDb({
      grant: grant(), attestation: attestation({ status: 'pending_review' }),
    }) };
    await expectNotFound(env);
  });
});
