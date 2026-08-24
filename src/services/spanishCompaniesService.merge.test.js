import { describe, it, expect } from 'vitest';
import { officerRowKey, mergeExpandOfficerPages } from './spanishCompaniesService';

// The expand-officer endpoint matches by substring, so a listed entity is
// queried under every spelling BORME printed it with and the pages are merged
// here. A row that came back under two spellings must count once.
describe('officerRowKey', () => {
  it('keys on the index id when the row has one', () => {
    expect(officerRowKey({ id: 'abc', company_name: 'X', position: 'Y', date: '2020-01-01' })).toBe('id:abc');
    expect(officerRowKey({ _id: 'abc' })).toBe('id:abc');
  });

  it('falls back to the seat — company, position, date — case-folded', () => {
    const a = officerRowKey({ company_name: 'Acme SL', position: 'Apoderado', date: '2020-01-01' });
    const b = officerRowKey({ company: 'ACME SL', specific_role: 'APODERADO', event_date: '2020-01-01' });
    expect(a).toBe('seat:ACME SL|APODERADO|2020-01-01');
    expect(b).toBe(a);
  });

  it('keeps two seats at the same company apart', () => {
    const consejero = officerRowKey({ company_name: 'ACME SL', position: 'CONSEJERO', date: '2020-01-01' });
    const presidente = officerRowKey({ company_name: 'ACME SL', position: 'PRESIDENTE', date: '2020-01-01' });
    expect(consejero).not.toBe(presidente);
  });

  it('answers the empty key for a missing row', () => {
    expect(officerRowKey(null)).toBe('');
  });
});

describe('mergeExpandOfficerPages', () => {
  const row = (id, company) => ({ id, company_name: company, position: 'APODERADO', date: '2020-01-01' });

  it('returns a failed empty page when nothing came back', () => {
    expect(mergeExpandOfficerPages([])).toEqual({ success: false, officers: [] });
    expect(mergeExpandOfficerPages([null, undefined])).toEqual({ success: false, officers: [] });
  });

  it('returns a single page untouched', () => {
    const page = { success: true, total: 1, officers: [row('1', 'A')] };
    expect(mergeExpandOfficerPages([page])).toBe(page);
  });

  it('keeps the first page as the shape and appends only unseen rows', () => {
    const primary = { success: true, total: 2, source: 'v3', officers: [row('1', 'A'), row('2', 'B')] };
    const widening = { success: true, total: 2, source: 'other', officers: [row('2', 'B'), row('3', 'C')] };

    const merged = mergeExpandOfficerPages([primary, widening]);

    expect(merged.source).toBe('v3');
    expect(merged.total).toBe(2);
    expect(merged.officers.map(o => o.id)).toEqual(['1', '2', '3']);
  });

  it('dedups id-less rows by seat', () => {
    const seat = { company_name: 'ACME SL', position: 'APODERADO', date: '2020-01-01' };
    const merged = mergeExpandOfficerPages([
      { success: true, officers: [seat] },
      { success: true, officers: [{ ...seat, company: 'ACME SL' }] },
    ]);
    expect(merged.officers).toHaveLength(1);
  });

  it('skips a page without an officers array and never mutates its inputs', () => {
    const primary = { success: true, officers: [row('1', 'A')] };
    const snapshot = JSON.stringify(primary);
    const merged = mergeExpandOfficerPages([primary, { success: true }, { success: true, officers: [row('2', 'B')] }]);
    expect(merged.officers).toHaveLength(2);
    expect(JSON.stringify(primary)).toBe(snapshot);
    expect(merged).not.toBe(primary);
  });
});
