import { describe, it, expect } from 'vitest';
import { onRequestGet } from './checks.js';

const req = (url = 'https://x/api/verify/admin/checks?attestation_id=att_1', token = null) =>
  new Request(url, token ? { headers: { authorization: 'Bearer ' + token } } : undefined);

// A minimal fake D1 binding: prepare().bind().all() resolves to a fixed
// `results` array, whatever the SQL or bind values were.
const fakeDb = (results) => ({
  prepare: () => ({
    bind: () => ({
      all: async () => ({ results }),
    }),
  }),
});

describe('GET /api/verify/admin/checks', () => {
  it('refuses without the admin token', async () => {
    const r = await onRequestGet({ request: req(), env: { VERIFY_ADMIN_TOKEN: 'secret' } });
    expect(r.status).toBe(401);
  });

  it('refuses a wrong token', async () => {
    const r = await onRequestGet({
      request: req(undefined, 'wrongwr'), env: { VERIFY_ADMIN_TOKEN: 'secret' } });
    expect(r.status).toBe(401);
  });

  it('requires an attestation_id', async () => {
    const r = await onRequestGet({
      request: req('https://x/api/verify/admin/checks', 'secret'),
      env: { VERIFY_ADMIN_TOKEN: 'secret' } });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('attestation_id_required');
  });

  it('carries a summary of the returned runs, computed server-side', async () => {
    const results = [
      { checked_at: '2026-09-12T04:00:00Z', source_failed: 0,
        outcomes: '{"address":"consistent"}', status_before: 'live', status_after: 'live' },
      { checked_at: '2026-09-11T04:00:00Z', source_failed: 1, outcomes: '{}',
        status_before: 'live', status_after: 'live' },
    ];
    const r = await onRequestGet({
      request: req(undefined, 'secret'),
      env: { VERIFY_ADMIN_TOKEN: 'secret', VERIFY_DB: fakeDb(results) } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.summary).toEqual({
      total: 2, checked: 1, failed: 1, consistent: 1,
      first: '2026-09-11T04:00:00Z', last: '2026-09-12T04:00:00Z',
    });
    expect(body.items).toEqual(results);
  });
});
