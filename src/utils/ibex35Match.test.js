import { describe, it, expect } from 'vitest';
import { matchIbexSeed, listedBadgeFor, pinListedEntities } from './ibex35Match';

describe('matchIbexSeed', () => {
  it('matches a company name regardless of surrounding whitespace and case', () => {
    const match = matchIbexSeed('  repsol sa  ');
    expect(match).not.toBeNull();
    expect(match.nif).toBe('A78374725');
  });

  it('matches the canonical uppercase v3Name directly', () => {
    const match = matchIbexSeed('REPSOL SA');
    expect(match.name).toBe('Repsol');
  });

  it('returns null for a company name that is not in the IBEX 35 seed', () => {
    expect(matchIbexSeed('ACME SL')).toBeNull();
  });

  it('returns null for empty, null, or undefined input', () => {
    expect(matchIbexSeed('')).toBeNull();
    expect(matchIbexSeed(null)).toBeNull();
    expect(matchIbexSeed(undefined)).toBeNull();
  });

  it('matches a live name carrying a trailing registry-office annotation', () => {
    // The graph node can carry "INDUSTRIA DE DISEÑO TEXTIL, S.A.(R.M. A CORUÑA)"
    // while the SEED's v3Name has no suffix — the (R.M. …) office annotation
    // must be stripped BEFORE punctuation, or the suffixed live name never
    // matches the curated seed.
    const match = matchIbexSeed('INDUSTRIA DE DISEÑO TEXTIL, S.A.(R.M. A CORUÑA)');
    expect(match).not.toBeNull();
    expect(match.ticker).toBe('BME:ITX');
  });

  it('matches a registry-office annotation spelled without dots', () => {
    const match = matchIbexSeed('INDUSTRIA DE DISEÑO TEXTIL, S.A. (RM A CORUÑA)');
    expect(match).not.toBeNull();
    expect(match.ticker).toBe('BME:ITX');
  });
});

describe('listedBadgeFor', () => {
  it('returns the IBEX badge for a name matching the seed, in English', () => {
    expect(listedBadgeFor('REPSOL SA', 'en')).toEqual({ label: 'Listed · IBEX 35', ticker: 'BME:REP' });
  });

  it('returns the IBEX badge for a name matching the seed, in Spanish', () => {
    expect(listedBadgeFor('REPSOL SA', 'es')).toEqual({ label: 'Cotizada · IBEX 35', ticker: 'BME:REP' });
  });

  it('matches the listed entity even with a trailing registry-office suffix (the INDITEX case)', () => {
    const badge = listedBadgeFor('INDUSTRIA DE DISEÑO TEXTIL, S.A.(R.M. A CORUÑA)', 'en');
    expect(badge).toEqual({ label: 'Listed · IBEX 35', ticker: 'BME:ITX' });
  });

  it('returns null for the unlisted sibling entity that is not in the IBEX 35 seed', () => {
    // "INDITEX, SA" (H:C-22299) is the unlisted group entity, distinct from
    // "INDUSTRIA DE DISEÑO TEXTIL, S.A." (H:C-3342), the listed one.
    expect(listedBadgeFor('INDITEX, SA', 'en')).toBeNull();
  });

  it('returns null for empty, null, or undefined input', () => {
    expect(listedBadgeFor('', 'en')).toBeNull();
    expect(listedBadgeFor(null, 'en')).toBeNull();
    expect(listedBadgeFor(undefined, 'en')).toBeNull();
  });
});

import { matchAllIbexNodes } from './ibex35Match';

describe('matchAllIbexNodes', () => {
  it('returns an empty array for empty, null, or undefined input', () => {
    expect(matchAllIbexNodes([])).toEqual([]);
    expect(matchAllIbexNodes(null)).toEqual([]);
    expect(matchAllIbexNodes(undefined)).toEqual([]);
  });

  it('ignores non-company nodes and nodes without a name', () => {
    const nodes = [
      { type: 'officer', name: 'REPSOL SA' },
      { type: 'spanish-company-group', name: '' },
      { type: 'spanish-company-group' },
    ];
    expect(matchAllIbexNodes(nodes)).toEqual([]);
  });

  it('matches IBEX company nodes and ignores non-IBEX company nodes', () => {
    const nodes = [
      { type: 'spanish-company-group', name: 'REPSOL SA' },
      { type: 'spanish-company-group', name: 'ACME SL' },
    ];
    const matches = matchAllIbexNodes(nodes);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Repsol');
  });

  it('deduplicates multiple nodes matching the same IBEX company by NIF', () => {
    const nodes = [
      { type: 'spanish-company-group', name: 'REPSOL SA' },
      { type: 'spanish-company-group', name: 'REPSOL SA' },
      { type: 'spanish-company-group', name: 'BANCO SANTANDER, S.A.' },
    ];
    const matches = matchAllIbexNodes(nodes);
    expect(matches).toHaveLength(2);
    expect(matches.map(m => m.name).sort()).toEqual(['Banco Santander', 'Repsol']);
  });
});

describe('pinListedEntities', () => {
  it('pins the listed Inditex entity first for "inditex"', () => {
    const suggestions = [{ id: 'H:C-22299', name: 'INDITEX, SA' }];
    const result = pinListedEntities('inditex', suggestions);
    expect(result[0]).toMatchObject({
      name: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.',
      label: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.',
      display_name: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.',
      id: 'H:C-3342',
      groupKey: 'H:C-3342',
      type: 'company',
      source: 'ibex_seed',
      listed: true,
    });
    expect(result[1]).toBe(suggestions[0]);
  });

  it('pins the listed entity for a 3-character prefix of the brand ("ind")', () => {
    // "ind" also prefixes "Indra" — both are expected to pin.
    const result = pinListedEntities('ind', []);
    expect(result.map(r => r.id)).toContain('H:C-3342');
  });

  it('does not pin for a 2-character query, even if it is a brand prefix', () => {
    const suggestions = [{ id: 'H:C-22299', name: 'INDITEX, SA' }];
    const result = pinListedEntities('in', suggestions);
    expect(result).toBe(suggestions);
  });

  it('adds nothing when the listed entity is already among the suggestions (matched by id)', () => {
    const suggestions = [{ id: 'H:C-3342', name: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.' }];
    const result = pinListedEntities('inditex', suggestions);
    expect(result).toBe(suggestions);
  });

  it('adds nothing when the listed entity is already present under a punctuation variant of its name', () => {
    const suggestions = [{ id: 'some-hash-id', name: 'INDUSTRIA DE DISEÑO TEXTIL SA' }];
    const result = pinListedEntities('inditex', suggestions);
    expect(result).toBe(suggestions);
  });

  it('returns the same array reference when the query matches no seed brand', () => {
    const suggestions = [{ id: 'x', name: 'ACME SL' }];
    const result = pinListedEntities('acme corp', suggestions);
    expect(result).toBe(suggestions);
  });

  it('ignores accents and case when matching the brand', () => {
    const result = pinListedEntities('  ÍnDiTeX  ', []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('H:C-3342');
  });

  it('pins every matching brand in seed order when multiple brands share the query prefix', () => {
    const result = pinListedEntities('banco', []);
    const ids = result.map(r => r.id);
    expect(ids).toContain('H:B-1561'); // Banco Sabadell
    expect(ids).toContain('H:S-1960'); // Banco Santander
    expect(ids.indexOf('H:B-1561')).toBeLessThan(ids.indexOf('H:S-1960'));
  });

  it('never mutates the input suggestions array', () => {
    const suggestions = [{ id: 'H:C-22299', name: 'INDITEX, SA' }];
    const before = [...suggestions];
    pinListedEntities('inditex', suggestions);
    expect(suggestions).toEqual(before);
  });

  it('pins Banco Santander for a query matching its second word ("santander")', () => {
    const result = pinListedEntities('santander', []);
    expect(result[0]).toMatchObject({ id: 'H:S-1960' }); // Banco Santander
  });

  it('pins Banco Sabadell for a query matching its second word ("sabadell")', () => {
    const result = pinListedEntities('sabadell', []);
    expect(result[0]).toMatchObject({ id: 'H:B-1561' }); // Banco Sabadell
  });

  it('still pins Inditex (and Indra) for a whole-brand prefix ("ind")', () => {
    const result = pinListedEntities('ind', []);
    const ids = result.map(r => r.id);
    expect(ids).toContain('H:C-3342'); // Inditex
    expect(ids).toContain('H:M-11339'); // Indra
  });

  it('pins Banco Santander for a 3-character prefix of its second word ("san")', () => {
    const result = pinListedEntities('san', []);
    expect(result.map(r => r.id)).toContain('H:S-1960');
  });

  it('does not pin for a word-internal substring that is not a prefix of any word ("tander")', () => {
    const result = pinListedEntities('tander', []);
    expect(result.map(r => r.id)).not.toContain('H:S-1960');
  });

  it('still pins Banco Santander when the only same-named suggestion is an OFFICER entry', () => {
    // A corporate-officer autocomplete row can be named identically to a
    // listed seed's registered name (e.g. Banco Santander appearing as an
    // officer/apoderado of another company). That's a different record from
    // the listed entity itself and must not suppress the pin — only a
    // `type: 'company'` suggestion (or id/groupKey match) should dedup.
    const suggestions = [
      { id: 'O:1', name: 'BANCO SANTANDER, S.A.', type: 'officer', company_count: 1 },
      { id: 'x', name: 'ACME SL', type: 'company' },
    ];
    const result = pinListedEntities('santander', suggestions);
    expect(result[0]).toMatchObject({ id: 'H:S-1960', name: 'BANCO SANTANDER, SA', type: 'company' });
  });

  it('dedups when a COMPANY suggestion already carries the seed name as a punctuation variant', () => {
    const suggestions = [{ id: 'some-hash-id', name: 'BANCO SANTANDER SA', type: 'company' }];
    const result = pinListedEntities('santander', suggestions);
    expect(result).toBe(suggestions);
  });

  it('dedups by id regardless of suggestion type', () => {
    const suggestions = [{ id: 'H:S-1960', name: 'irrelevant name', type: 'officer' }];
    const result = pinListedEntities('santander', suggestions);
    expect(result).toBe(suggestions);
  });
});

import { buildIbexCardViewModel } from './ibex35Match';

describe('buildIbexCardViewModel', () => {
  const seedEntry = { name: 'Repsol', nif: 'A78374725', ticker: 'BME:REP' };
  const apiRow = {
    ticker: 'REP.MC',
    current_price_eur: 11.5,
    change_percent: -0.42,
    market_cap_eur: 15234567890,
    volume: 3456789,
    pe_ratio: 8.1,
    eps: 1.42,
    high_52: 13.2,
    low_52: 9.8,
    dividend_yield: 6.5,
    shareholders: [
      { name: 'Sacyr', type: 'strategic', percentage: 3.2, shares: 0, reportDate: 45842 },
      { name: 'BlackRock', type: 'institutional', percentage: 5.1, shares: 0, reportDate: 46177 },
    ],
  };

  it('returns null when there is no seed entry or no api row', () => {
    expect(buildIbexCardViewModel(null, apiRow, 'es')).toBeNull();
    expect(buildIbexCardViewModel(seedEntry, null, 'es')).toBeNull();
  });

  it('formats the market snapshot fields', () => {
    const vm = buildIbexCardViewModel(seedEntry, apiRow, 'en');
    expect(vm.name).toBe('Repsol');
    expect(vm.priceLabel).toContain('11.50');
    expect(vm.changeLabel).toBe('-0.42%');
    expect(vm.changePositive).toBe(false);
    expect(vm.dividendYieldLabel).toBe('6.50%');
    expect(vm.marketCapLabel).toBe('€15.23bn');
    expect(vm.volumeLabel).toBe('3,456,789');
    expect(vm.epsLabel).toBe('€1.42');
    expect(vm.high52Label).toBe('€13.20');
    expect(vm.low52Label).toBe('€9.80');
  });

  it('sorts shareholders by percentage descending and formats their own as-of date', () => {
    const vm = buildIbexCardViewModel(seedEntry, apiRow, 'en');
    expect(vm.shareholders.map(s => s.name)).toEqual(['BlackRock', 'Sacyr']);
    expect(vm.shareholders[0].percentageLabel).toBe('5.10%');
    // reportDate 46177 -> 2026-06-04 (Excel serial date)
    expect(vm.shareholders[0].asOfLabel).toContain('2026');
    // reportDate 45842 -> 2025-07-04 (Excel serial date)
    expect(vm.shareholders[1].asOfLabel).toContain('2025');
  });

  it('omits dividend yield and P/E labels when the API returns null for them', () => {
    const vm = buildIbexCardViewModel(
      seedEntry,
      { ...apiRow, dividend_yield: null, pe_ratio: null },
      'en'
    );
    expect(vm.dividendYieldLabel).toBeNull();
    expect(vm.peRatioLabel).toBeNull();
  });

  it('does not throw and omits asOfLabel when a shareholder reportDate is not a valid Excel serial (real Naturgy data has a plain date string here)', () => {
    const rowWithMalformedDate = {
      ...apiRow,
      shareholders: [
        { name: 'Sonatrach', type: 'individual', percentage: 3.85, shares: 0, reportDate: '15/11/2011' },
        ...apiRow.shareholders,
      ],
    };
    let vm;
    expect(() => {
      vm = buildIbexCardViewModel(seedEntry, rowWithMalformedDate, 'en');
    }).not.toThrow();
    const sonatrach = vm.shareholders.find(s => s.name === 'Sonatrach');
    expect(sonatrach.percentageLabel).toBe('3.85%');
    expect(sonatrach.asOfLabel).toBeNull();
  });
});
