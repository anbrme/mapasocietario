import { describe, it, expect } from 'vitest';
import { matchIbexSeed } from './ibex35Match';

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
