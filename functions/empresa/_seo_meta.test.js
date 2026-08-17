import { describe, it, expect } from 'vitest';
import { resolveNif, buildSeoMeta, renderCompanyPage } from './_lib.js';

describe('resolveNif', () => {
  it('prefers the human-verified seed NIF over registry and enriched values', () => {
    const company = { nif: 'B11111111', enriched_nif: 'B22222222' };
    const seed = { nif: 'A33333333' };
    expect(resolveNif(company, seed)).toBe('A33333333');
  });

  it('falls back to the registry NIF, then the enriched NIF', () => {
    expect(resolveNif({ nif: 'B11111111', enriched_nif: 'B22222222' }, null)).toBe('B11111111');
    expect(resolveNif({ enriched_nif: 'B22222222' }, null)).toBe('B22222222');
  });

  it('returns null when no NIF is known anywhere', () => {
    expect(resolveNif({}, null)).toBeNull();
    expect(resolveNif(null, null)).toBeNull();
  });
});

describe('buildSeoMeta', () => {
  it('leads the Spanish title with the CIF when a NIF is known', () => {
    const { title } = buildSeoMeta('es', 'ACME SL', { nif: 'B12345678' });
    expect(title.startsWith('ACME SL: CIF B12345678')).toBe(true);
  });

  it('keeps the established Spanish title when no NIF is known', () => {
    const { title } = buildSeoMeta('es', 'ACME SL', { nif: null });
    expect(title).toBe(
      'ACME SL — Socios, administradores y estructura societaria (Registro Mercantil) | Mapa Societario',
    );
    expect(title).not.toContain('CIF');
  });

  it('includes the CIF in the English title only when known', () => {
    const withNif = buildSeoMeta('en', 'ACME SL', { nif: 'B12345678' });
    expect(withNif.title.startsWith('ACME SL: CIF B12345678')).toBe(true);
    const without = buildSeoMeta('en', 'ACME SL', {});
    expect(without.title).toBe('ACME SL: Directors & Company Records | Mapa Societario');
  });

  it('includes the CIF in the meta description only when known', () => {
    const withNif = buildSeoMeta('es', 'ACME SL', { nif: 'B12345678', capital: '3.000 €', province: 'MADRID' });
    expect(withNif.desc).toContain('CIF B12345678');
    expect(withNif.desc).toContain('MADRID');
    const without = buildSeoMeta('es', 'ACME SL', { capital: '3.000 €' });
    expect(without.desc).not.toContain('CIF');
  });

  it('falls back to Spanish for an unknown language', () => {
    const { title } = buildSeoMeta('xx', 'ACME SL', { nif: 'B12345678' });
    expect(title).toContain('CIF B12345678');
  });
});

describe('renderCompanyPage NIF wiring', () => {
  const baseCompany = {
    company_name: 'ACME SL',
    company_type: 'SL',
    province: 'MADRID',
    officers_active: [],
    officers_resigned: [],
    identifiers: [],
  };

  it('surfaces the CIF in the <title>, description and registry heading', () => {
    const html = renderCompanyPage({ ...baseCompany, enriched_nif: 'B12345678' }, [], 'acme-sl', null, 'es');
    expect(html).toContain('<title>ACME SL: CIF B12345678');
    expect(html).toMatch(/name="description" content="[^"]*CIF B12345678/);
    expect(html).toMatch(/<h2 id="registry-data">[^<]*CIF B12345678/);
  });

  it('renders without any CIF markers when no NIF is known', () => {
    const html = renderCompanyPage({ ...baseCompany }, [], 'acme-sl', null, 'es');
    expect(html).toContain('<title>ACME SL — Socios, administradores');
    expect(html).not.toContain('taxID');
  });

  it('emits taxID in JSON-LD for registry-verified NIFs but not enriched ones', () => {
    const verified = renderCompanyPage({ ...baseCompany, nif: 'B12345678' }, [], 'acme-sl', null, 'es');
    expect(verified).toContain('"taxID":"B12345678"');
    const enriched = renderCompanyPage({ ...baseCompany, enriched_nif: 'B12345678' }, [], 'acme-sl', null, 'es');
    expect(enriched).not.toContain('taxID');
  });
});

describe('normalizeNif', () => {
  it('strips separators and uppercases for titles and taxID', async () => {
    const { normalizeNif } = await import('./_lib.js');
    expect(normalizeNif('A-28004885')).toBe('A28004885');
    expect(normalizeNif(' a.480.10615 ')).toBe('A48010615');
    expect(normalizeNif('')).toBeNull();
  });

  it('applies to seed NIFs end to end', async () => {
    const { resolveNif } = await import('./_lib.js');
    expect(resolveNif({}, { nif: 'A-28004885' })).toBe('A28004885');
  });
});
