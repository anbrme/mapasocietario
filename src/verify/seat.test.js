import { describe, it, expect } from 'vitest';
import { nameTokens, matchSeat } from './seat.js';

const OFFICERS = [
  { name: 'NURNBERG ALESSANDRO', position_normalized: 'ADM. UNICO', appointed_date: '2013-10-16' },
  { name: 'GARCIA LOPEZ MARIA', position_normalized: 'APODERADO', appointed_date: '2020-01-05' },
];

describe('nameTokens', () => {
  it('strips accents and punctuation and uppercases', () => {
    expect(nameTokens('Alessandro Nürnberg')).toEqual(['ALESSANDRO', 'NURNBERG']);
  });
  it('handles ñ', () => {
    expect(nameTokens('Muñoz')).toEqual(['MUNOZ']);
  });
});

describe('matchSeat', () => {
  it('matches regardless of surname-first ordering', () => {
    expect(matchSeat('Alessandro Nürnberg', OFFICERS)).toEqual({
      name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO', appointed_date: '2013-10-16',
    });
  });
  it('REJECTS a subset match - the bug in the old matcher', () => {
    expect(matchSeat('Maria Garcia', OFFICERS)).toBeNull();
  });
  it('rejects a superset', () => {
    expect(matchSeat('Alessandro Nurnberg Garcia', OFFICERS)).toBeNull();
  });
  it('returns null for an empty name rather than matching anything', () => {
    expect(matchSeat('', OFFICERS)).toBeNull();
    expect(matchSeat('  ', OFFICERS)).toBeNull();
  });
  it('returns null when there are no officers', () => {
    expect(matchSeat('Alessandro Nürnberg', [])).toBeNull();
    expect(matchSeat('Alessandro Nürnberg', undefined)).toBeNull();
  });
});
