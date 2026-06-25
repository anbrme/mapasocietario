import { describe, it, expect } from 'vitest';
import { getCompany } from '../../src/api/client.js';

const fetchReturning = (payload) => async () => ({ ok: true, json: async () => payload });

const doc = {
  _id: 'H:M-396846',
  company_name: 'TELEFONICA SA',
  current_capital: 5000000,
  current_address: 'Gran Via 28, Madrid',
  is_dissolved: false,
  identifiers: ['M-396846'],
  first_seen: '2009-01-01', last_seen: '2026-06-01',
  officers_active: [
    { name: 'JANE DOE', position_normalized: 'Consejero', appointed_date: '2020-01-01' },
  ],
  officers_resigned: [
    { name: 'JOHN ROE', position_normalized: 'Administrador', resigned_date: '2018-05-05' },
  ],
  name_changes: [
    { date: '2011-07-11', old_name: 'CRITERIA CAIXACORP SA', new_name: 'TELEFONICA SA' },
  ],
  capital_history: [
    { date: '2014-01-15', amount: 943035.0 },
    { date: '2013-06-01', amount: 800000.0 },
  ],
  address_history: [
    { date: '2017-10-30', address: 'C/ PINTOR SOROLLA 2-4 (VALENCIA)' },
  ],
};

describe('getCompany', () => {
  it('shapes the v3 search doc into a CompanyDoc', async () => {
    const out = await getCompany('H:M-396846', { fetchImpl: fetchReturning({ results: [doc] }) });
    expect(out.groupKey).toBe('H:M-396846');
    expect(out.name).toBe('TELEFONICA SA');
    expect(out.nif).toBeNull();
    expect(out.capital).toBe(5000000);
    expect(out.address).toBe('Gran Via 28, Madrid');
    expect(out.status).toBe('active');
    expect(out.officersActive).toEqual([
      { name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01', resignedDate: null },
    ]);
    expect(out.officersResigned[0].name).toBe('JOHN ROE');
  });

  it('maps is_dissolved: true → status dissolved', async () => {
    const dissolvedDoc = { ...doc, _id: 'H:M-111', is_dissolved: true };
    const out = await getCompany('H:M-111', { fetchImpl: fetchReturning({ results: [dissolvedDoc] }) });
    expect(out.status).toBe('dissolved');
  });

  it('returns null when no doc matches the group_key', async () => {
    const out = await getCompany('H:M-999', { fetchImpl: fetchReturning({ results: [doc] }) });
    expect(out).toBeNull();
  });

  it('returns null on error', async () => {
    const out = await getCompany('H:M-1', { fetchImpl: async () => { throw new Error('x'); } });
    expect(out).toBeNull();
  });

  it('maps name_changes to nameChanges with from/to/date', async () => {
    const out = await getCompany('H:M-396846', { fetchImpl: fetchReturning({ results: [doc] }) });
    expect(out.nameChanges).toEqual([
      { date: '2011-07-11', from: 'CRITERIA CAIXACORP SA', to: 'TELEFONICA SA' },
    ]);
  });

  it('maps capital_history to capitalHistory with date/amount', async () => {
    const out = await getCompany('H:M-396846', { fetchImpl: fetchReturning({ results: [doc] }) });
    expect(out.capitalHistory).toEqual([
      { date: '2014-01-15', amount: 943035.0 },
      { date: '2013-06-01', amount: 800000.0 },
    ]);
  });

  it('maps address_history to addressHistory with date/address', async () => {
    const out = await getCompany('H:M-396846', { fetchImpl: fetchReturning({ results: [doc] }) });
    expect(out.addressHistory).toEqual([
      { date: '2017-10-30', address: 'C/ PINTOR SOROLLA 2-4 (VALENCIA)' },
    ]);
  });

  it('returns empty arrays when history fields are absent', async () => {
    const noHistoryDoc = { ...doc, _id: 'H:M-NO', name_changes: undefined, capital_history: undefined, address_history: undefined };
    const out = await getCompany('H:M-NO', { fetchImpl: fetchReturning({ results: [noHistoryDoc] }) });
    expect(out.nameChanges).toEqual([]);
    expect(out.capitalHistory).toEqual([]);
    expect(out.addressHistory).toEqual([]);
  });
});
