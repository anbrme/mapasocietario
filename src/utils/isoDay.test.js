import { describe, it, expect } from 'vitest';
import { isoDayLong, isoDayShort } from './isoDay';

describe('isoDayLong', () => {
  it('spells a registry day out in the report’s language', () => {
    expect(isoDayLong('2024-03-11', 'es')).toBe('11 de marzo de 2024');
    expect(isoDayLong('2024-03-11', 'en')).toBe('11 March 2024');
    expect(isoDayLong('2024-03-11')).toBe('11 de marzo de 2024');
  });

  it('keeps the day the registry meant, west of Greenwich too', () => {
    // Read as UTC midnight this would render as 10 March in the Americas; the
    // noon rule is what stops a filing drifting a day when it is shown.
    expect(isoDayLong('2024-03-11', 'es')).toContain('11');
    expect(isoDayLong('2024-01-01', 'es')).toBe('1 de enero de 2024');
  });

  it('accepts a full timestamp by reading its day', () => {
    expect(isoDayLong('2024-03-11T23:30:00.000Z', 'es')).toBe('11 de marzo de 2024');
  });

  it('gives a caller nothing to print when there is no day', () => {
    expect(isoDayLong('')).toBe('');
    expect(isoDayLong(null)).toBe('');
    expect(isoDayLong(undefined)).toBe('');
  });
});

describe('isoDayShort', () => {
  it('is the compact form, for a field or a list', () => {
    expect(isoDayShort('2024-03-11', 'es')).toBe('11/03/2024');
    expect(isoDayShort('2024-03-11', 'en')).toBe('11/03/2024');
    expect(isoDayShort('')).toBe('');
  });
});
