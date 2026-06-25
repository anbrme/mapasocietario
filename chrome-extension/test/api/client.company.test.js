import { describe, it, expect } from 'vitest';
import { getCompany } from '../../src/api/client.js';

const fetchReturning = (payload) => async () => ({ ok: true, json: async () => payload });

const doc = {
  _id: 'H:M-396846',
  company_name: 'TELEFONICA SA',
  nif: 'A28015865',
  capital: 5000000,
  enriched_address: 'Gran Via 28, Madrid',
  identifiers: ['M-396846'],
  first_seen: '2009-01-01', last_seen: '2026-06-01',
  officers_active: [
    { name: 'JANE DOE', position_normalized: 'Consejero', appointed_date: '2020-01-01' },
  ],
  officers_resigned: [
    { name: 'JOHN ROE', position_normalized: 'Administrador', resigned_date: '2018-05-05' },
  ],
};

describe('getCompany', () => {
  it('shapes the v3 search doc into a CompanyDoc', async () => {
    const out = await getCompany('H:M-396846', { fetchImpl: fetchReturning({ results: [doc] }) });
    expect(out.groupKey).toBe('H:M-396846');
    expect(out.name).toBe('TELEFONICA SA');
    expect(out.nif).toBe('A28015865');
    expect(out.address).toBe('Gran Via 28, Madrid');
    expect(out.officersActive).toEqual([
      { name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01', resignedDate: null },
    ]);
    expect(out.officersResigned[0].name).toBe('JOHN ROE');
  });

  it('returns null when no doc matches the group_key', async () => {
    const out = await getCompany('H:M-999', { fetchImpl: fetchReturning({ results: [doc] }) });
    expect(out).toBeNull();
  });

  it('returns null on error', async () => {
    const out = await getCompany('H:M-1', { fetchImpl: async () => { throw new Error('x'); } });
    expect(out).toBeNull();
  });
});
