import { describe, expect, it } from 'vitest';

import { adminDenial } from './_db.js';

// A wrong token and an UNBOUND server secret are different failures with
// different fixes — bad credential vs. missing deployment config — and the
// console cannot tell an operator which one they are looking at while both
// answer 401 'unauthorized'. A missing server-side secret is not a secret:
// naming it leaks nothing, because when it is unset no token works at all.

const req = (authorization) =>
  new Request('https://mapasocietario.es/api/verify/admin/chain', {
    headers: authorization ? { authorization } : {},
  });

describe('adminDenial', () => {
  it('allows a request whose bearer token matches the configured secret', () => {
    expect(adminDenial(req('Bearer s3cret'), { VERIFY_ADMIN_TOKEN: 's3cret' })).toBe(null);
  });

  it('rejects a wrong token as 401 unauthorized', async () => {
    const res = adminDenial(req('Bearer wrong0'), { VERIFY_ADMIN_TOKEN: 's3cret' });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('rejects a missing authorization header as 401 unauthorized', async () => {
    const res = adminDenial(req(undefined), { VERIFY_ADMIN_TOKEN: 's3cret' });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('reports an unbound server secret as 503, not as a bad credential', async () => {
    const res = adminDenial(req('Bearer s3cret'), {});

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: 'admin_token_not_configured' });
  });

  it('reports the unbound secret even when the caller sent no token either', async () => {
    const res = adminDenial(req(undefined), {});

    expect(res.status).toBe(503);
  });

  it('never echoes the configured secret back to the caller', async () => {
    const res = adminDenial(req('Bearer wrong0'), { VERIFY_ADMIN_TOKEN: 's3cret' });

    expect(JSON.stringify(await res.json())).not.toContain('s3cret');
  });

  it('keeps the private no-store headers every verification response carries', () => {
    const res = adminDenial(req(undefined), {});

    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
  });
});
