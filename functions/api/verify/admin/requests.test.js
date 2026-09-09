import { describe, it, expect } from 'vitest';
import { onRequestGet, onRequestPost } from './requests.js';

const getReq = (url = 'https://x/api/verify/admin/requests', token = null) =>
  new Request(url, token ? { headers: { authorization: 'Bearer ' + token } } : undefined);

const postReq = (body, token = null) =>
  new Request('https://x/api/verify/admin/requests', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  });

// A minimal fake D1 binding: prepare().bind().all()/.run() resolve to fixed
// values, whatever the SQL or bind values were.
const fakeDb = (results, runResult = { meta: { changes: 1 } }) => ({
  prepare: () => ({
    bind: () => ({
      all: async () => ({ results }),
      run: async () => runResult,
    }),
  }),
});

describe('GET /api/verify/admin/requests', () => {
  it('refuses without the admin token', async () => {
    const r = await onRequestGet({ request: getReq(), env: { VERIFY_ADMIN_TOKEN: 'secret' } });
    expect(r.status).toBe(401);
  });

  it('refuses a wrong token', async () => {
    const r = await onRequestGet({
      request: getReq(undefined, 'wrongwr'), env: { VERIFY_ADMIN_TOKEN: 'secret' } });
    expect(r.status).toBe(401);
  });

  it('returns the rows the DB yields', async () => {
    const results = [
      { id: 'req_1', company_query: 'WAYPORT ADVISORS', nif: null,
        contact_name: 'Ana', contact_role: 'Administradora', contact_email: 'ana@example.com',
        referrer_note: null, note: null, status: 'new', created_at: '2026-09-01T00:00:00Z' },
    ];
    const r = await onRequestGet({
      request: getReq(undefined, 'secret'),
      env: { VERIFY_ADMIN_TOKEN: 'secret', VERIFY_DB: fakeDb(results) } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1);
    expect(body.items).toEqual(results);
  });
});

describe('POST /api/verify/admin/requests', () => {
  it('refuses without the admin token', async () => {
    const r = await onRequestPost({
      request: postReq({ id: 'req_1', status: 'contacted' }),
      env: { VERIFY_ADMIN_TOKEN: 'secret' },
    });
    expect(r.status).toBe(401);
  });

  it('requires an id', async () => {
    const r = await onRequestPost({
      request: postReq({ status: 'contacted' }, 'secret'),
      env: { VERIFY_ADMIN_TOKEN: 'secret', VERIFY_DB: fakeDb([]) },
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('id_required');
  });

  it('rejects a status outside the allowed set', async () => {
    const r = await onRequestPost({
      request: postReq({ id: 'req_1', status: 'approved' }, 'secret'),
      env: { VERIFY_ADMIN_TOKEN: 'secret', VERIFY_DB: fakeDb([]) },
    });
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe('invalid_status');
    expect(body.allowed).toEqual(['new', 'contacted', 'invited', 'ineligible', 'declined', 'spam']);
  });

  it('reports not_found when no row matched the id', async () => {
    const r = await onRequestPost({
      request: postReq({ id: 'req_missing', status: 'contacted' }, 'secret'),
      env: { VERIFY_ADMIN_TOKEN: 'secret', VERIFY_DB: fakeDb([], { meta: { changes: 0 } }) },
    });
    expect(r.status).toBe(404);
    expect((await r.json()).error).toBe('not_found');
  });

  it('updates status and operator_note on a valid request', async () => {
    const r = await onRequestPost({
      request: postReq({ id: 'req_1', status: 'contacted', operator_note: 'llamado' }, 'secret'),
      env: { VERIFY_ADMIN_TOKEN: 'secret', VERIFY_DB: fakeDb([]) },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe('req_1');
    expect(body.status).toBe('contacted');
  });
});
