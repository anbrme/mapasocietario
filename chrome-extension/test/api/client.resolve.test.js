import { describe, it, expect } from 'vitest';
import { resolveCompany } from '../../src/api/client.js';

const fakeFetch = (payload) => async () =>
  ({ ok: true, json: async () => payload });

describe('resolveCompany', () => {
  it('maps suggestions to Match objects with stable id', async () => {
    const payload = { suggestions: [
      { id: 'H:M-396846', company_name: 'TELEFONICA SA', province: 'Madrid', nif: 'A28015865' },
    ]};
    const out = await resolveCompany('telefonica', { fetchImpl: fakeFetch(payload) });
    expect(out).toEqual([
      { id: 'H:M-396846', name: 'TELEFONICA SA', location: 'Madrid', nif: 'A28015865',
        isAlias: false, formerName: null, newName: null },
    ]);
  });

  it('surfaces alias rename info', async () => {
    const payload = { suggestions: [
      { id: 'H:M-1', company_name: 'NEW NAME SL', is_alias: true, original_name: 'OLD NAME SL' },
    ]};
    const out = await resolveCompany('old name', { fetchImpl: fakeFetch(payload) });
    expect(out[0].isAlias).toBe(true);
    expect(out[0].formerName).toBe('OLD NAME SL');
  });

  it('returns [] for short queries without calling fetch', async () => {
    let called = false;
    const spy = async () => { called = true; return { ok: true, json: async () => ({}) }; };
    expect(await resolveCompany('a', { fetchImpl: spy })).toEqual([]);
    expect(called).toBe(false);
  });

  it('returns [] on fetch error', async () => {
    const boom = async () => { throw new Error('network'); };
    expect(await resolveCompany('telefonica', { fetchImpl: boom })).toEqual([]);
  });
});
