import { describe, it, expect } from 'vitest';
import { normalizeCompanyName, looksLikeGroupKey, selectGroupKeyId } from './companyName';

describe('normalizeCompanyName', () => {
  it('strips a trailing period so registry variants compare equal', () => {
    expect(normalizeCompanyName('COCUNAT S.L.')).toBe('COCUNAT S.L');
    expect(normalizeCompanyName('COCUNAT S.L')).toBe('COCUNAT S.L');
  });

  it('strips a trailing (YYYY) year suffix', () => {
    expect(normalizeCompanyName('ACME SL (2024)')).toBe('ACME SL');
    expect(normalizeCompanyName('ACME SL (2024).')).toBe('ACME SL');
  });

  it('is null-safe and trims', () => {
    expect(normalizeCompanyName(null)).toBe('');
    expect(normalizeCompanyName('  ACME SL  ')).toBe('ACME SL');
  });
});

describe('looksLikeGroupKey', () => {
  it('accepts hoja and name-uniqueness keys', () => {
    expect(looksLikeGroupKey('H:B-441672')).toBe(true);
    expect(looksLikeGroupKey('N:M-396846')).toBe(true);
  });

  it('rejects opaque content-hash ids', () => {
    expect(looksLikeGroupKey('2b3200b6b59d301eeaaa72f7bb9f7d07')).toBe(false);
    expect(looksLikeGroupKey('')).toBe(false);
    expect(looksLikeGroupKey(null)).toBe(false);
  });
});

describe('selectGroupKeyId', () => {
  // The bug: node labelled "COCUNAT S.L" (no trailing period) whose directory
  // returns the real hoja doc AND a nameless opaque-hash duplicate. Raw
  // uppercase matching missed the period-different name and fell to the hash.
  it('resolves a period-different name to the real hoja key, not the hash', () => {
    const suggestions = [
      { id: 'H:B-441672', company_name_normalized: 'COCUNAT S.L.' },
      { id: '2b3200b6b59d301eeaaa72f7bb9f7d07', company_name_normalized: null },
    ];
    expect(selectGroupKeyId('COCUNAT S.L', suggestions)).toBe('H:B-441672');
  });

  it('resolves even when the hash duplicate is ranked first', () => {
    const suggestions = [
      { id: '2b3200b6b59d301eeaaa72f7bb9f7d07', company_name_normalized: null },
      { id: 'H:B-441672', company_name_normalized: 'COCUNAT S.L.' },
    ];
    expect(selectGroupKeyId('COCUNAT S.L', suggestions)).toBe('H:B-441672');
  });

  it('prefers a real group_key when several docs share the exact name', () => {
    const suggestions = [
      { id: 'deadbeefdeadbeefdeadbeefdeadbeef', company_name_normalized: 'ACME SL' },
      { id: 'H:M-12345', company_name_normalized: 'ACME SL' },
    ];
    expect(selectGroupKeyId('ACME SL', suggestions)).toBe('H:M-12345');
  });

  it('falls back to the best-ranked usable suggestion when nothing matches', () => {
    const suggestions = [
      { id: 'H:B-999', company_name_normalized: 'ACME HOLDINGS SL' },
      { id: 'H:B-111', company_name_normalized: 'ACME CAPITAL SL' },
    ];
    expect(selectGroupKeyId('ACME', suggestions)).toBe('H:B-999');
  });

  it('skips nameless hash duplicates when falling back on a non-exact match', () => {
    const suggestions = [
      { id: 'ffffffffffffffffffffffffffffffff', company_name_normalized: null },
      { id: 'H:B-222', company_name_normalized: 'ACME PARTNERS SL' },
    ];
    expect(selectGroupKeyId('ACME', suggestions)).toBe('H:B-222');
  });

  it('still returns a legitimate hash-keyed exact match', () => {
    const suggestions = [
      { id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', company_name_normalized: 'SOLO ENTITY SL' },
    ];
    expect(selectGroupKeyId('SOLO ENTITY SL', suggestions)).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('returns null for empty input', () => {
    expect(selectGroupKeyId('ACME', [])).toBe(null);
    expect(selectGroupKeyId('ACME', null)).toBe(null);
  });

  it('reads the legacy .name field when company_name_normalized is absent', () => {
    const suggestions = [
      { id: 'H:B-441672', name: 'COCUNAT S.L.' },
      { id: '2b3200b6b59d301eeaaa72f7bb9f7d07', name: null },
    ];
    expect(selectGroupKeyId('COCUNAT S.L', suggestions)).toBe('H:B-441672');
  });
});
