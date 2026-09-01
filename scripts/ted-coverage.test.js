import { describe, expect, test } from 'vitest';
import {
  brandToken,
  expandIds,
  isWinnerNif,
  lotBidCounts,
  monthSlices,
} from './ted-coverage.mjs';

// These helpers decide which awards get attributed to which company. A
// regression in any of them changes the coverage numbers silently — the script
// still runs, still prints a percentage, and the percentage is wrong.

describe('isWinnerNif', () => {
  test('accepts a company NIF', () => {
    expect(isWinnerNif('B47336698')).toBe(true);
  });

  test('accepts a natural-person NIF', () => {
    expect(isWinnerNif('12345678Z')).toBe(true);
  });

  test('rejects buyer-side codes that leak into the winner field', () => {
    // P/Q/S prefixes are contracting authorities — a provincial council, a
    // public body, an administrative organ — never a contractor.
    expect(isWinnerNif('P4800000D')).toBe(false);
    expect(isWinnerNif('Q2826004J')).toBe(false);
    expect(isWinnerNif('S2826002D')).toBe(false);
  });

  test('rejects float artifacts from sloppy eSenders', () => {
    expect(isWinnerNif('34602.0')).toBe(false);
  });

  test('rejects GDPR-masked personal identifiers', () => {
    expect(isWinnerNif('****6894*')).toBe(false);
  });

  test('rejects empty and nullish input', () => {
    expect(isWinnerNif('')).toBe(false);
    expect(isWinnerNif(null)).toBe(false);
    expect(isWinnerNif(undefined)).toBe(false);
  });
});

describe('expandIds', () => {
  test('returns a single valid NIF', () => {
    expect(expandIds('B47336698')).toEqual(['B47336698']);
  });

  test('splits a concatenated UTE identifier into both members', () => {
    expect(expandIds('A15139314-B20890687')).toEqual(['A15139314', 'B20890687']);
  });

  test('keeps only the valid members of a mixed pair', () => {
    expect(expandIds('A15139314-34602.0')).toEqual(['A15139314']);
  });

  test('upper-cases and trims before validating', () => {
    expect(expandIds('  b47336698 ')).toEqual(['B47336698']);
  });

  test('returns nothing for an unusable value', () => {
    expect(expandIds('****6894*')).toEqual([]);
  });
});

describe('lotBidCounts', () => {
  test('reads only the tenders entries, pairing code to value by position', () => {
    // The two arrays are parallel: taking values without checking the code
    // would count SME sub-totals as if they were total bids per lot.
    const notice = {
      'received-submissions-type-code': ['t-sme', 'tenders', 't-sme', 'tenders'],
      'received-submissions-type-val': ['1', '3', '2', '5'],
    };
    expect(lotBidCounts(notice)).toEqual([3, 5]);
  });

  test('detects a single-bid lot', () => {
    const notice = {
      'received-submissions-type-code': ['tenders'],
      'received-submissions-type-val': ['1'],
    };
    expect(lotBidCounts(notice)).toEqual([1]);
  });

  test('returns empty when the notice carries no bid statistics', () => {
    expect(lotBidCounts({})).toEqual([]);
  });

  test('ignores values with no matching code', () => {
    const notice = {
      'received-submissions-type-code': ['tenders'],
      'received-submissions-type-val': ['2', '9'],
    };
    expect(lotBidCounts(notice)).toEqual([2]);
  });

  test('skips non-numeric values rather than emitting NaN', () => {
    const notice = {
      'received-submissions-type-code': ['tenders', 'tenders'],
      'received-submissions-type-val': ['', '4'],
    };
    expect(lotBidCounts(notice)).toEqual([4]);
  });
});

describe('monthSlices', () => {
  const slices = monthSlices();

  test('starts at the configured FROM month', () => {
    expect(slices[0]).toEqual({ from: '20240101', to: '20240131' });
  });

  test('every slice is a whole calendar month', () => {
    for (const s of slices) {
      expect(s.from).toMatch(/^\d{6}01$/);
      expect(s.from.slice(0, 6)).toBe(s.to.slice(0, 6));
    }
  });

  test('handles February and 30-day months', () => {
    const byMonth = new Map(slices.map((s) => [s.from.slice(0, 6), s.to]));
    expect(byMonth.get('202402')).toBe('20240229'); // leap year
    expect(byMonth.get('202502')).toBe('20250228');
    expect(byMonth.get('202404')).toBe('20240430');
  });

  test('slices are contiguous and strictly increasing', () => {
    const months = slices.map((s) => s.from);
    expect(months).toEqual([...new Set(months)]);
    expect([...months].sort()).toEqual(months);
  });
});

describe('brandToken', () => {
  test('takes the leading significant word', () => {
    expect(brandToken('IBERDROLA CLIENTES SA')).toBe('IBERDROLA');
  });

  test('skips filler words that would collide unrelated companies', () => {
    expect(brandToken('GRUPO COCUNAT SL')).toBe('COCUNAT');
  });

  test('rejects a short leading word rather than over-matching', () => {
    // A 3-letter token would group far too many unrelated companies.
    expect(brandToken('NTT DATA SPAIN SL')).toBe(null);
  });

  test('returns null for empty input', () => {
    expect(brandToken('')).toBe(null);
    expect(brandToken(null)).toBe(null);
  });
});
