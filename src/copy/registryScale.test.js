import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { registryScale, millionsLabel, REGISTRY_SCALE_RAW } from './registryScale';

/**
 * These figures are public claims about coverage. They were hand-typed in five
 * places and drifted: the English FAQ said 3.2 million companies while the
 * Spanish FAQ, in the same file, said 3,1 millones — and llms.txt claimed 9.4M
 * filings against a true 9.57M. The point of the shared module is that a
 * reader comparing two surfaces cannot find the product contradicting itself.
 */
describe('registryScale', () => {
  test('rounds to one decimal rather than implying an exact count', () => {
    // Arrange / Act — 3,152,861 companies
    const { companies } = registryScale('en');

    // Assert
    expect(companies).toBe('3.2');
  });

  test('uses the decimal comma in Spanish', () => {
    // Arrange / Act
    const es = registryScale('es');

    // Assert
    expect(es.companies).toBe('3,2');
    expect(es.filings).toContain(',');
    expect(es.filings).not.toContain('.');
  });

  test('both languages describe the same underlying figure', () => {
    // Arrange / Act
    const en = registryScale('en');
    const es = registryScale('es');

    // Assert — the drift this module exists to prevent
    expect(es.companies.replace(',', '.')).toBe(en.companies);
    expect(es.filings.replace(',', '.')).toBe(en.filings);
    expect(es.officerChanges.replace(',', '.')).toBe(en.officerChanges);
  });

  test('llms.txt quotes the same numbers as the app', () => {
    // Arrange
    const llms = readFileSync(new URL('../../public/llms.txt', import.meta.url), 'utf8');
    const { companies, filings } = registryScale('en');

    // Act
    const match = llms.match(/~([\d.]+)M companies and ~([\d.]+)M filings/);

    // Assert — llms.txt is prose, so it is checked rather than assumed
    expect(match).toBeTruthy();
    expect(match[1]).toBe(companies);
    expect(match[2]).toBe(filings);
  });

  test('the site-wide JSON-LD quotes the same numbers as the app', () => {
    // Arrange — index.html feeds every prerendered page's schema block
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const { companies, filings } = registryScale('en');

    // Act
    const co = html.match(/covering ([\d.]+) million companies since 2009/);
    const fi = html.match(/built on ([\d.]+) million official BORME publication records/);

    // Assert
    expect(co?.[1]).toBe(companies);
    expect(fi?.[1]).toBe(filings);
  });

  test('no surface hardcodes a scale figure any more', () => {
    // Arrange — the files that quote coverage to the public
    const files = ['../components/landingCopy.jsx', '../../scripts/prerender.mjs',
                   '../components/LandingPage.jsx'];

    // Act / Assert — a literal "N.N million" is how the drift started
    for (const rel of files) {
      const source = readFileSync(new URL(rel, import.meta.url), 'utf8');
      expect(source).not.toMatch(/\d\.\d million (companies|published|recorded)/);
      expect(source).not.toMatch(/\d,\d millones de (empresas|publicaciones|cambios)/);
    }
  });

  test('the landing stats band rounds, it does not truncate', () => {
    // Arrange — the exact bug: floor(3,152,861 / 1e5) / 10 renders "3.1M"
    // beside a FAQ that says 3.2 million.
    // Act / Assert
    expect(millionsLabel(3_152_861, 'en')).toBe('3.2M');
    expect(millionsLabel(3_152_861, 'es')).toBe('3,2M');
  });

  test('the band and the prose quote the same figure', () => {
    // Arrange
    const { companies, filings } = registryScale('en');

    // Act / Assert — one rounding rule, or the page contradicts itself
    expect(millionsLabel(REGISTRY_SCALE_RAW.totalCompanies, 'en')).toBe(`${companies}M`);
    expect(millionsLabel(REGISTRY_SCALE_RAW.totalEvents, 'en')).toBe(`${filings}M`);
  });

  test('raw counts are plausible, not placeholders', () => {
    // Arrange / Act / Assert
    for (const value of Object.values(REGISTRY_SCALE_RAW)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(1_000_000);
    }
  });
});
