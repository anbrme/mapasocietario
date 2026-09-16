import { describe, it, expect } from 'vitest';
import { balanceNeighbours, renderSiblingsBlock, MIN_SIBLINGS } from './_siblings.js';
import { renderCompanyPage } from './_lib.js';

const row = (name) => ({ slug: name.toLowerCase().replace(/ /g, '-'), canonical_name: name });
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const companyPath = (lang, slug) => (lang === 'en' ? `/en/company/${slug}` : `/empresa/${slug}`);
const T = {
  siblingsTitle: (p) => `Otras empresas en ${p}`,
  siblingsAll: (p) => `Ver todas las empresas en ${p} →`,
};

describe('balanceNeighbours', () => {
  it('takes from both sides and returns them in reading order', () => {
    const out = balanceNeighbours({
      // The query returns the "before" side nearest-first (DESC).
      before: [row('C SL'), row('B SL'), row('A SL')],
      after: [row('E SL'), row('F SL'), row('G SL')],
      limit: 4,
    });
    expect(out.map((r) => r.canonical_name)).toEqual(['B SL', 'C SL', 'E SL', 'F SL']);
  });

  it('fills from the far side at the edge of the alphabet', () => {
    // A company sorting first in its province has no "before" neighbours; it
    // should still get a full block rather than half of one.
    const after = Array.from({ length: 12 }, (_, i) => row(`N${i} SL`));
    expect(balanceNeighbours({ before: [], after, limit: 10 })).toHaveLength(10);
    expect(balanceNeighbours({ before: after, after: [], limit: 10 })).toHaveLength(10);
  });

  it('never exceeds the limit when both sides overflow', () => {
    const many = Array.from({ length: 12 }, (_, i) => row(`N${i} SL`));
    expect(balanceNeighbours({ before: many, after: many, limit: 10 })).toHaveLength(10);
  });

  it('survives an empty or missing province', () => {
    expect(balanceNeighbours({})).toEqual([]);
    expect(balanceNeighbours()).toEqual([]);
  });
});

describe('renderSiblingsBlock', () => {
  const neighbours = { before: [row('B SL'), row('A SL')], after: [row('D SL'), row('E SL')] };

  it('links siblings in the language of the page it is on', () => {
    const es = renderSiblingsBlock({ neighbours, province: 'Las Palmas', lang: 'es', t: T, companyPath, esc });
    expect(es).toContain('href="/empresa/a-sl"');
    expect(es).toContain('Otras empresas en Las Palmas');

    const en = renderSiblingsBlock({ neighbours, province: 'Las Palmas', lang: 'en', t: T, companyPath, esc });
    expect(en).toContain('href="/en/company/a-sl"');
  });

  it('links the province hub, slugged the same way the hub routes it', () => {
    const html = renderSiblingsBlock({ neighbours, province: 'A CORUÑA', lang: 'es', t: T, companyPath, esc });
    expect(html).toContain('href="/directorio/a-coruna"');
  });

  it('renders nothing below the useful minimum', () => {
    const one = { before: [row('A SL')], after: [] };
    expect(renderSiblingsBlock({ neighbours: one, province: 'Madrid', lang: 'es', t: T, companyPath, esc })).toBe('');
    expect(MIN_SIBLINGS).toBeGreaterThan(1);
  });

  it('renders nothing when D1 is absent or the company has no province', () => {
    expect(renderSiblingsBlock({ neighbours: null, province: 'Madrid', lang: 'es', t: T, companyPath, esc })).toBe('');
    expect(renderSiblingsBlock({ neighbours, province: '', lang: 'es', t: T, companyPath, esc })).toBe('');
  });
});

describe('the crawl edges on a company page', () => {
  const COMPANY = {
    company_name: 'ACME TEST SL',
    nif: 'B12345678',
    province: 'Las Palmas',
    last_seen: '2026-08-01',
    total_publications: 3,
  };
  const SEED = { name: 'ACME TEST SL' };
  const siblings = { before: [row('B SL'), row('A SL')], after: [row('D SL'), row('E SL')] };
  const render = (lang, options) => renderCompanyPage(COMPANY, [], 'acme-test-sl', SEED, lang, null, null, null, null, false, null, false, false, options);

  it('links the directory from the footer of every page, in both languages', () => {
    // This is what lifts /directorio out of orphan status: ~4,000 inbound links
    // from the pages it lists.
    expect(render('es', {})).toContain('<a href="/directorio">Directorio de empresas por provincia</a>');
    expect(render('en', {})).toContain('<a href="/directorio">Company directory by province</a>');
  });

  it('renders the sibling block when D1 supplied neighbours', () => {
    const html = render('es', { siblings });
    expect(html).toContain('Otras empresas en Las Palmas');
    expect(html).toContain('href="/empresa/a-sl"');
    expect(html).toContain('href="/directorio/las-palmas"');
  });

  it('omits the block, and only the block, when D1 answered nothing', () => {
    const html = render('es', { siblings: null });
    expect(html).not.toContain('Otras empresas en');
    // The page itself is unaffected — the province link and footer still stand.
    expect(html).toContain('href="/directorio/las-palmas"');
    expect(html).toContain('<a href="/directorio">');
  });
});
