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
