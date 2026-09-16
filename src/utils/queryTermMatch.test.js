import { describe, it, expect } from 'vitest';
import { foldForMatch, matchesAllQueryTerms, filterByQueryTerms } from './queryTermMatch';

// Regression: typing "Fábregas" in the graph search dropped every company the
// API returned, because the client-side gate compared a lowercased-but-accented
// query against accent-less registry names with String.includes.

describe('foldForMatch', () => {
  it('strips accents and lowercases', () => {
    expect(foldForMatch('Fábregas')).toBe('fabregas');
    expect(foldForMatch('GARCÍA')).toBe('garcia');
  });

  it('folds ñ so a tilde-less query reaches an ñ-stored name and vice versa', () => {
    expect(foldForMatch('Muñoz')).toBe(foldForMatch('MUNOZ'));
  });

  it('collapses punctuation and whitespace runs to one space', () => {
    expect(foldForMatch('FABREGAS & CARBONELL, S.L.')).toBe('fabregas carbonell s l');
  });

  it('accepts NFD input (macOS paste) the same as NFC', () => {
    expect(foldForMatch('Fábregas')).toBe('fabregas');
  });

  it('tolerates null and undefined', () => {
    expect(foldForMatch(null)).toBe('');
    expect(foldForMatch(undefined)).toBe('');
  });
});

describe('matchesAllQueryTerms', () => {
  it('matches an accented query against an accent-less name', () => {
    expect(matchesAllQueryTerms('BODEGAS FABREGAS SL', 'Fábregas')).toBe(true);
  });

  it('matches an accent-less query against an accented name', () => {
    expect(matchesAllQueryTerms('BODEGAS FÁBREGAS SL', 'fabregas')).toBe(true);
  });

  it('ignores token order', () => {
    expect(matchesAllQueryTerms('FABREGAS SOLER FRANCESC', 'Soler Fabregas')).toBe(true);
  });

  it('requires every query term', () => {
    expect(matchesAllQueryTerms('BODEGAS FABREGAS SL', 'Fabregas Soler')).toBe(false);
  });

  it('keeps substring semantics of the previous gate', () => {
    expect(matchesAllQueryTerms('BODEGAS FABREGAS SL', 'fabr')).toBe(true);
  });

  it('matches everything on an empty query', () => {
    expect(matchesAllQueryTerms('BODEGAS FABREGAS SL', '')).toBe(true);
  });
});

describe('filterByQueryTerms', () => {
  const results = [
    { name: 'BODEGAS FABREGAS SL' },
    { company_name: 'HORNO FÁBREGAS SL' },
    { name: 'FINANHOUSE MARESME SL' },
  ];

  it('keeps rows matching under either name field and drops the rest', () => {
    expect(filterByQueryTerms(results, 'Fábregas')).toEqual(results.slice(0, 2));
  });

  it('returns a new array and leaves the input untouched', () => {
    const before = JSON.stringify(results);
    const out = filterByQueryTerms(results, 'Fábregas');
    expect(out).not.toBe(results);
    expect(JSON.stringify(results)).toBe(before);
  });

  it('tolerates a null result list', () => {
    expect(filterByQueryTerms(null, 'x')).toEqual([]);
  });
});
