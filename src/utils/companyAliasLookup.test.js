import { describe, it, expect, vi } from 'vitest';
import { buildCompanyAliasMap, ALIAS_LOOKUP_CHUNK } from './companyAliasLookup';

/** A lookup stub shaped like spanishCompaniesService.autocompleteCompanies. */
const lookupReturning = rows => name =>
  Promise.resolve({ suggestions: rows[name] || [] });

describe('buildCompanyAliasMap', () => {
  it('maps an old name onto the new one the registry published', async () => {
    const lookup = lookupReturning({
      'ACME SL': [{ name: 'ACME SL', has_new_name: true, new_company_name: 'acme global sl' }],
    });

    const aliases = await buildCompanyAliasMap(['ACME SL'], { lookup });

    expect(aliases.get('ACME SL')).toBe('ACME GLOBAL SL');
  });

  it('maps in the other direction when the row IS the new name', async () => {
    const lookup = lookupReturning({
      'ACME GLOBAL SL': [{ name: 'ACME GLOBAL SL', is_alias: true, original_name: 'acme sl' }],
    });

    const aliases = await buildCompanyAliasMap(['ACME GLOBAL SL'], { lookup });

    expect(aliases.get('ACME SL')).toBe('ACME GLOBAL SL');
  });

  it('ignores a suggestion that is not the exact name asked for', async () => {
    // The autocomplete endpoint matches by prefix, so "ACME SL" can come back
    // carrying "ACME SL DOS" — a different company, never this one's new name.
    const lookup = lookupReturning({
      'ACME SL': [{ name: 'ACME SL DOS', has_new_name: true, new_company_name: 'OTRA SL' }],
    });

    const aliases = await buildCompanyAliasMap(['ACME SL'], { lookup });

    expect(aliases.size).toBe(0);
  });

  it('survives a failing probe without sinking the rest', async () => {
    const lookup = name =>
      name === 'BOOM SL'
        ? Promise.reject(new Error('502'))
        : Promise.resolve({
            suggestions: [{ name, has_new_name: true, new_company_name: 'NUEVA SL' }],
          });

    const aliases = await buildCompanyAliasMap(['BOOM SL', 'ACME SL'], { lookup });

    expect(aliases.get('ACME SL')).toBe('NUEVA SL');
    expect(aliases.has('BOOM SL')).toBe(false);
  });

  it('probes in bounded parallel chunks, never one round-trip at a time', async () => {
    // The regression this guards: 199 sequential awaits took ~93s to expand
    // ERNST & YOUNG SL. Concurrency must stay capped (the API bans bursts) but
    // must never fall back to 1.
    let inFlight = 0;
    let peak = 0;
    const lookup = async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight--;
      return { suggestions: [] };
    };
    const names = Array.from({ length: 25 }, (_, i) => `EMPRESA ${i} SL`);

    await buildCompanyAliasMap(names, { lookup });

    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(ALIAS_LOOKUP_CHUNK);
  });

  it('reports progress as chunks land, ending on the full total', async () => {
    const names = Array.from({ length: 25 }, (_, i) => `EMPRESA ${i} SL`);
    const onProgress = vi.fn();

    await buildCompanyAliasMap(names, {
      lookup: () => Promise.resolve({ suggestions: [] }),
      onProgress,
    });

    expect(onProgress.mock.calls[0]).toEqual([0, 25]);
    expect(onProgress.mock.calls.at(-1)).toEqual([25, 25]);
  });

  it('does no work and reports nothing for an empty name list', async () => {
    const lookup = vi.fn();
    const onProgress = vi.fn();

    const aliases = await buildCompanyAliasMap([], { lookup, onProgress });

    expect(aliases.size).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('accepts a Set and de-duplicates blank names away', async () => {
    const lookup = vi.fn(() => Promise.resolve({ suggestions: [] }));

    await buildCompanyAliasMap(new Set(['ACME SL', 'ACME SL', '', '  ']), { lookup });

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith('ACME SL');
  });
});
