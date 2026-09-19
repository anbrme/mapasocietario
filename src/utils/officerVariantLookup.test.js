import { describe, it, expect, vi } from 'vitest';
import {
  officerQueryNames,
  officerRecordKey,
  dedupeOfficerRecords,
  fetchOfficerRecordsForNames,
} from './officerVariantLookup';

describe('officerQueryNames', () => {
  it('returns the primary name first, then the merged-in variants', () => {
    const node = {
      name: 'LOPEZ MIRANDA GONZALEZ LUIS MIGUEL',
      nameVariants: ['LOPEZ-MIRANDA GONZALEZ LUIS MIGUEL', 'LOPEZ MIRANDA GONZALEZ LUIS MIGUEL'],
    };
    expect(officerQueryNames(node)).toEqual([
      'LOPEZ MIRANDA GONZALEZ LUIS MIGUEL',
      'LOPEZ-MIRANDA GONZALEZ LUIS MIGUEL',
    ]);
  });

  it('is a single name when nothing was merged', () => {
    expect(officerQueryNames({ name: 'GARCIA LOPEZ JUAN' })).toEqual(['GARCIA LOPEZ JUAN']);
  });

  it('drops blanks and case-duplicate spellings', () => {
    const node = {
      name: '  PAN YI  ',
      nameVariants: ['pan yi', '', null, 'PAN YI', 'PAN, YI'],
    };
    expect(officerQueryNames(node)).toEqual(['PAN YI', 'PAN, YI']);
  });

  it('survives a node with no name at all', () => {
    expect(officerQueryNames(null)).toEqual([]);
    expect(officerQueryNames({})).toEqual([]);
    expect(officerQueryNames({ nameVariants: 'not-an-array' })).toEqual([]);
  });
});

describe('officerRecordKey', () => {
  it('keys on company, role and date', () => {
    expect(officerRecordKey({
      company_name: 'Acme SL', specific_role: 'Administrador', date: '2020-01-01',
    })).toBe('ACME SL|ADMINISTRADOR|2020-01-01');
  });

  it('falls back through the company and role spellings the API uses', () => {
    // expandOfficerV3 rows carry company_name | company | name, and
    // specific_role | position. A record missing company_name must still key
    // on the company it names, or unrelated rows collapse into one.
    expect(officerRecordKey({ company: 'Beta SA', position: 'Socio', event_date: '2019-05-05' }))
      .toBe('BETA SA|SOCIO|2019-05-05');
    expect(officerRecordKey({ name: 'Gamma SL', specific_role: 'Consejero' }))
      .toBe('GAMMA SL|CONSEJERO|');
  });

  it('treats two rows differing only in company as different', () => {
    const a = { company_name: 'A SL', specific_role: 'Adm', date: '2020-01-01' };
    const b = { company_name: 'B SL', specific_role: 'Adm', date: '2020-01-01' };
    expect(officerRecordKey(a)).not.toBe(officerRecordKey(b));
  });
});

describe('dedupeOfficerRecords', () => {
  it('keeps the first occurrence across lists and drops repeats', () => {
    const shared = { company_name: 'ACME SL', specific_role: 'ADM', date: '2020-01-01' };
    const onlyVariant = { company_name: 'OTRA SL', specific_role: 'ADM', date: '2021-02-02' };
    const out = dedupeOfficerRecords([[shared], [{ ...shared }, onlyVariant]]);
    expect(out).toEqual([shared, onlyVariant]);
  });

  it('tolerates empty and missing lists', () => {
    expect(dedupeOfficerRecords([])).toEqual([]);
    expect(dedupeOfficerRecords([null, undefined, []])).toEqual([]);
  });
});

describe('fetchOfficerRecordsForNames', () => {
  const rowFor = company => ({ company_name: company, specific_role: 'ADM', date: '2020-01-01' });

  it('combines the seats filed under every spelling', async () => {
    // The whole point: the survivor spelling holds one company, the absorbed
    // spelling another. Expanding under one name alone loses the other.
    const fetchOne = vi.fn(async name => ({
      success: true,
      officers: name === 'LOPEZ MIRANDA JUAN' ? [rowFor('ACME SL')] : [rowFor('OTRA SL')],
    }));
    const out = await fetchOfficerRecordsForNames(
      ['LOPEZ MIRANDA JUAN', 'LOPEZ-MIRANDA JUAN'],
      fetchOne,
    );
    expect(out.officers.map(o => o.company_name)).toEqual(['ACME SL', 'OTRA SL']);
    expect(out.contributingNames).toEqual(['LOPEZ MIRANDA JUAN', 'LOPEZ-MIRANDA JUAN']);
    expect(fetchOne).toHaveBeenCalledTimes(2);
  });

  it('does not double-count a seat both spellings return', async () => {
    const fetchOne = async () => ({ success: true, officers: [rowFor('ACME SL')] });
    const out = await fetchOfficerRecordsForNames(['A', 'B'], fetchOne);
    expect(out.officers).toHaveLength(1);
  });

  it('reports only the spellings that actually contributed a seat', async () => {
    // Drives the disclosure: we may only claim we covered two spellings when
    // the second one really returned something.
    const fetchOne = async name => ({
      success: true, officers: name === 'A' ? [rowFor('ACME SL')] : [],
    });
    const out = await fetchOfficerRecordsForNames(['A', 'B'], fetchOne);
    expect(out.contributingNames).toEqual(['A']);
    expect(out.queriedNames).toEqual(['A', 'B']);
  });

  it('keeps the seats it did get when one variant lookup throws', async () => {
    const onError = vi.fn();
    const fetchOne = async name => {
      if (name === 'B') throw new Error('boom');
      return { success: true, officers: [rowFor('ACME SL')] };
    };
    const out = await fetchOfficerRecordsForNames(['A', 'B'], fetchOne, { onError });
    expect(out.officers).toHaveLength(1);
    expect(out.contributingNames).toEqual(['A']);
    expect(onError).toHaveBeenCalledWith('B', expect.any(Error));
  });

  it('treats an unsuccessful response as no seats, not as a throw', async () => {
    const fetchOne = async () => ({ success: false, officers: [rowFor('ACME SL')] });
    const out = await fetchOfficerRecordsForNames(['A'], fetchOne);
    expect(out.officers).toEqual([]);
    expect(out.contributingNames).toEqual([]);
  });

  it('returns empty for no names without calling the fetcher', async () => {
    const fetchOne = vi.fn();
    const out = await fetchOfficerRecordsForNames([], fetchOne);
    expect(out.officers).toEqual([]);
    expect(fetchOne).not.toHaveBeenCalled();
  });
});
