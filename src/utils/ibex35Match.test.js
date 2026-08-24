import { describe, it, expect } from 'vitest';
import {
  matchIbexSeed,
  listedBadgeFor,
  pinListedEntities,
  listedEntityForName,
  officerQueryVariants,
  buildListedKeyIndex,
} from './ibex35Match';
import { SEED } from '../../functions/empresa/_ibex35.js';

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

  it('leads with the synthetic seed entry — never dedups by name — when the payload only has a name-keyed owner record, even past the graph\'s 14-item slice', () => {
    // The live bug: the directory autocomplete payload for "santander"
    // carries a NAME-keyed owner record (`id: 'BANCO SANTANDER SA'`, not the
    // seed's `H:<hoja>` doc) at index 15. The graph then does
    // `companyItems.slice(0, 14)` (SpanishCompanyNetworkGraph.jsx ~2551), so
    // anything past index 13 is dropped. Name-based dedup used to see that
    // owner record as "the seed already present" and skip pinning — cutting
    // the bank from the dropdown entirely. Dedup is now id/groupKey ONLY, so
    // a same-named-but-different-id record can never suppress the pin: the
    // seed's own synthetic entry always leads at index 0, safely inside the
    // slice, and the unrelated owner record is left untouched later on.
    const unrelated = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`,
      name: `SANTANDER FILIAL ${i} SA`,
      type: 'company',
    }));
    const ownerRecord = { name: 'BANCO SANTANDER SA', id: 'BANCO SANTANDER SA', type: 'company' };
    const suggestions = [...unrelated, ownerRecord];
    expect(suggestions).toHaveLength(16);
    expect(suggestions[15]).toBe(ownerRecord);

    const result = pinListedEntities('santander', suggestions);

    expect(result[0]).toMatchObject({
      id: 'H:S-1960',
      name: 'BANCO SANTANDER, SA',
      type: 'company',
      source: 'ibex_seed',
      listed: true,
    });
    expect(result.some(r => r.id === 'BANCO SANTANDER SA')).toBe(true);
    // The synthetic pin is a NEW entry, not a promotion of the owner record —
    // both are present, with no dedup collapsing them into one.
    expect(result).toHaveLength(17);
  });

  it('promotes an existing suggestion carrying the seed\'s own id to the front, with listed: true added, instead of adding a synthetic twin', () => {
    const unrelated = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, name: `COMPANY ${i}`, type: 'company' }));
    const seedSuggestion = { id: 'H:S-1960', name: 'BANCO SANTANDER, S.A.', type: 'company', cif: 'A-39000013' };
    const suggestions = [...unrelated.slice(0, 5), seedSuggestion, ...unrelated.slice(5)];
    expect(suggestions).toHaveLength(10);
    expect(suggestions[5]).toBe(seedSuggestion);

    const result = pinListedEntities('santander', suggestions);

    expect(result).toHaveLength(10); // promoted, not duplicated — length unchanged
    expect(result[0]).toEqual({ ...seedSuggestion, listed: true });
    expect(result.filter(r => r.id === 'H:S-1960')).toHaveLength(1);
  });

  it('promotes by id/groupKey regardless of what the suggestion is named', () => {
    const suggestions = [{ id: 'H:S-1960', name: 'irrelevant name', type: 'officer' }];
    const result = pinListedEntities('santander', suggestions);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ ...suggestions[0], listed: true });
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

describe('listedEntityForName', () => {
  // BORME prints a corporate officer under whatever spelling the filing used —
  // "BANCO SANTANDER" with no legal form is a real 2009 APODERADO entry of
  // BANCO DE VASCONIA SA. Matching is EXACT WHOLE-NAME equality against the 35
  // curated seed entries only (registered name or brand), never a prefix,
  // substring or token reordering: a person whose surname is a brand must stay
  // a person.
  it('matches a suffix-less officer spelling of a listed entity (the brand)', () => {
    const seed = listedEntityForName('BANCO SANTANDER');
    expect(seed).not.toBeNull();
    expect(seed.name).toBe('Banco Santander');
  });

  it('matches the registered name in either punctuation form', () => {
    expect(listedEntityForName('BANCO SANTANDER, S.A.').name).toBe('Banco Santander');
    expect(listedEntityForName('banco santander sa').name).toBe('Banco Santander');
  });

  it('carries the seed slug and the "H:<hoja>" group key of the canonical doc', () => {
    const seed = listedEntityForName('BANCO SANTANDER');
    expect(seed.slug).toBe('banco-santander');
    expect(seed.groupKey).toBe('H:S-1960');
    expect(seed.v3Name).toBe('BANCO SANTANDER, SA');
  });

  it('maps a brand name to its listed entity even when the registered name differs', () => {
    // "INDITEX" as an officer spelling IS the listed Inditex, whose registered
    // name is INDUSTRIA DE DISEÑO TEXTIL, S.A.
    const seed = listedEntityForName('INDITEX');
    expect(seed).not.toBeNull();
    expect(seed.v3Name).toBe('INDUSTRIA DE DISEÑO TEXTIL, S.A.');
  });

  it('matches an accented brand written without accents', () => {
    expect(listedEntityForName('ENAGAS').name).toBe('Enagás');
  });

  it('never matches a person whose surname is a listed brand', () => {
    expect(listedEntityForName('GRIFOLS ROURA VICTOR')).toBeNull();
    expect(listedEntityForName('PUIG LOPEZ MARIA')).toBeNull();
  });

  it('never matches a name that is not a whole seed name', () => {
    // "SANTANDER" alone is the city/brand fragment, not the entity.
    expect(listedEntityForName('SANTANDER')).toBeNull();
    expect(listedEntityForName('BANCO SANTANDER TOTTA')).toBeNull();
  });

  it('leaves an unrelated small company and its founder alone', () => {
    expect(listedEntityForName('LUIS SANCHEZ')).toBeNull();
    expect(listedEntityForName('LUIS SANCHEZ SL')).toBeNull();
  });

  it('does not confuse the unlisted sibling that shares part of the name', () => {
    // "INDITEX, SA" is the unlisted group entity, not the listed company.
    expect(listedEntityForName('INDITEX, SA')).toBeNull();
  });

  it('returns null for empty, null, or undefined input', () => {
    expect(listedEntityForName('')).toBeNull();
    expect(listedEntityForName(null)).toBeNull();
    expect(listedEntityForName(undefined)).toBeNull();
  });
});

describe('listedBadgeFor with a suffix-less listed name', () => {
  it('badges the officer spelling of a listed entity', () => {
    const badge = listedBadgeFor('BANCO SANTANDER', 'es');
    expect(badge).not.toBeNull();
    expect(badge.ticker).toBe('BME:SAN');
  });

  it('still badges the canonical registered name', () => {
    expect(listedBadgeFor('REPSOL SA', 'en').label).toBe('Listed · IBEX 35');
  });

  it('does not badge a person whose surname is a listed brand', () => {
    expect(listedBadgeFor('GRIFOLS ROURA VICTOR', 'es')).toBeNull();
  });
});

describe('listedEntityForName with dotted registered names', () => {
  // entityNameKey turns the dots of "AENA S.M.E. SA" into separators
  // ("AENA S M E SA"), so it alone can never match the printed "AENA SME SA".
  // The index registers the nameKey folding too.
  it('resolves AENA from both the dotted and the dotless spelling', () => {
    expect(listedEntityForName('AENA S.M.E. SA').slug).toBe('aena');
    expect(listedEntityForName('AENA SME SA').slug).toBe('aena');
    expect(listedEntityForName('aena sme sa').slug).toBe('aena');
  });

  it('badges both spellings', () => {
    expect(listedBadgeFor('AENA SME SA', 'es').ticker).toBe('BME:AENA');
    expect(listedBadgeFor('AENA S.M.E. SA', 'es').ticker).toBe('BME:AENA');
  });

  it('resolves every curated seed from its own registered name', () => {
    Object.entries(SEED).forEach(([slug, seed]) => {
      const match = listedEntityForName(seed.v3Name);
      expect(match, `seed ${slug} did not resolve from "${seed.v3Name}"`).not.toBeNull();
      expect(match.slug).toBe(slug);
    });
  });

  it('resolves every curated seed from its brand name', () => {
    Object.entries(SEED).forEach(([slug, seed]) => {
      const match = listedEntityForName(seed.name);
      expect(match, `seed ${slug} did not resolve from brand "${seed.name}"`).not.toBeNull();
      expect(match.slug).toBe(slug);
    });
  });
});

describe('buildListedKeyIndex', () => {
  it('builds a key -> slug table for the real seed without collisions', () => {
    const index = buildListedKeyIndex(SEED);
    expect(index['BANCO SANTANDER']).toBe('banco-santander');
    expect(index['BANCO SANTANDER SA']).toBe('banco-santander');
    expect(index['AENA SME SA']).toBe('aena');
  });

  it('throws when two seeds claim the same key, instead of silently first-wins', () => {
    const colliding = {
      alpha: { name: 'Alpha', v3Name: 'ALPHA SA', hoja: 'M 1' },
      beta: { name: 'Alpha', v3Name: 'BETA SA', hoja: 'M 2' },
    };
    expect(() => buildListedKeyIndex(colliding)).toThrow(/collision/i);
  });

  it('does not throw when one seed produces the same key twice', () => {
    // entityNameKey and nameKey agree on a plain ASCII name — same slug, no clash.
    expect(() => buildListedKeyIndex({ repsol: { name: 'Repsol', v3Name: 'REPSOL SA', hoja: 'M 65289' } })).not.toThrow();
  });
});

describe('officerQueryVariants', () => {
  // The expand-officer endpoint matches by SUBSTRING and so only ever expands to
  // LONGER names: querying "BANCO SANTANDER, SA" can never return the row BORME
  // printed as plain "BANCO SANTANDER".
  it('adds the brand spelling for a listed company name', () => {
    // The input already IS the seed's registered name, so only two spellings
    // remain distinct once deduped by entityNameKey.
    expect(officerQueryVariants('BANCO SANTANDER, SA')).toEqual([
      'BANCO SANTANDER, SA',
      'Banco Santander',
    ]);
  });

  it('keeps the caller name first and adds the registered name for a brand input', () => {
    expect(officerQueryVariants('BANCO SANTANDER')).toEqual([
      'BANCO SANTANDER',
      'BANCO SANTANDER, SA',
    ]);
  });

  it('yields all three spellings when the input, the registered name and the brand all differ', () => {
    expect(officerQueryVariants('AENA SME SA')).toEqual([
      'AENA SME SA',
      'AENA S.M.E. SA',
      'AENA',
    ]);
  });

  it('queries any other name exactly as given', () => {
    expect(officerQueryVariants('LUIS SANCHEZ SL')).toEqual(['LUIS SANCHEZ SL']);
    expect(officerQueryVariants('GRIFOLS ROURA VICTOR')).toEqual(['GRIFOLS ROURA VICTOR']);
  });

  it('is empty for a missing name', () => {
    expect(officerQueryVariants('')).toEqual([]);
    expect(officerQueryVariants(null)).toEqual([]);
  });
});
