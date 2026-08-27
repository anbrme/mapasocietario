import { describe, it, expect } from 'vitest';
import { buildSeoMeta } from './_lib.js';
import { isSeoVariant, CONTROL_SLUGS, SEO_EXPERIMENT_ON } from './_seo_experiment.js';

const counts = { active: 27, former: 93, filings: 162, lastFiling: '4 ago 2026' };
const meta = (name, opts = {}) =>
  buildSeoMeta(opts.lang || 'es', name, {
    nif: opts.nif === undefined ? 'A08001851' : opts.nif,
    capital: '54.856.653 €',
    province: 'Madrid',
    variant: opts.variant !== false,
    counts: opts.counts === undefined ? counts : opts.counts,
  });

describe('the A/B split', () => {
  it('assigns the same slug to the same arm every time', () => {
    const first = ['sacyr', 'acciona', 'endesa'].map(isSeoVariant);
    const again = ['sacyr', 'acciona', 'endesa'].map(isSeoVariant);
    expect(again).toEqual(first);
  });

  it('never puts a page in both arms', () => {
    const overlap = CONTROL_SLUGS.filter(isSeoVariant);
    expect(overlap).toEqual([]);
  });

  it('leaves every page outside the experiment on the control template', () => {
    expect(isSeoVariant('a-company-not-in-the-experiment-sl')).toBe(false);
    expect(isSeoVariant('')).toBe(false);
    expect(isSeoVariant(null)).toBe(false);
  });

  it('is switched on (flip SEO_EXPERIMENT_ON to revert the whole estate)', () => {
    expect(SEO_EXPERIMENT_ON).toBe(true);
  });
});

describe('the variant title', () => {
  it('leads with the counts, not with the CIF the searcher came for', () => {
    const { title } = meta('Acciona');
    expect(title.indexOf('27 administradores')).toBeLessThan(title.indexOf('CIF'));
    expect(title).toContain('27 administradores y 93 cargos cesados');
  });

  // Ranking reads the whole title even when the SERP truncates it, so the CIF
  // must survive in the markup — dropping it is what would cost the position.
  it('always keeps the CIF in the markup, however long the name', () => {
    for (const name of ['Acciona', 'IKUSI REDES DE TELECOMUNICACIONES SL',
                        'ACEBSA AISLANTES Y CONDUCTORES ESPECIALES SA']) {
      expect(meta(name).title).toContain('CIF A08001851');
    }
  });

  it('drops the second count, then the first, as the name grows', () => {
    expect(meta('Acciona').title).toContain('y 93 cargos cesados');
    // 36 chars: room for one count only
    const mid = meta('IKUSI REDES DE TELECOMUNICACIONES SL').title;
    expect(mid).toContain('27 administradores');
    expect(mid).not.toContain('cargos cesados');
    // 44 chars: no room for any count
    const long = meta('ACEBSA AISLANTES Y CONDUCTORES ESPECIALES SA').title;
    expect(long).not.toContain('administradores');
    expect(long).toContain('ACEBSA AISLANTES Y CONDUCTORES ESPECIALES SA (CIF A08001851)');
  });

  it('keeps the visible portion within Google\'s budget before the brand', () => {
    const visible = meta('Acciona').title.split(' (CIF')[0];
    expect(visible.length).toBeLessThanOrEqual(58);
  });
});

describe('the variant description', () => {
  it('fits what Google renders', () => {
    for (const name of ['Acciona', 'IKUSI REDES DE TELECOMUNICACIONES SL']) {
      for (const lang of ['es', 'en']) {
        expect(meta(name, { lang }).desc.length).toBeLessThanOrEqual(155);
      }
    }
  });

  it('front-loads the counts and filing recency, padding only with what fits', () => {
    const { desc } = meta('Acciona');
    expect(desc.startsWith('Quién controla Acciona: 27 cargos vigentes, 93 cesados')).toBe(true);
    expect(desc).toContain('162 publicaciones BORME (última: 4 ago 2026)');
  });

  it('drops the optional tail rather than the counts on a long name', () => {
    const { desc } = meta('IKUSI REDES DE TELECOMUNICACIONES SL');
    expect(desc).toContain('cargos vigentes');
    expect(desc).toContain('publicaciones BORME');
    expect(desc.length).toBeLessThanOrEqual(155);
  });

  it('writes English for the English page', () => {
    const { title, desc } = meta('Acciona', { lang: 'en' });
    expect(desc).toContain('Who controls Acciona');
    expect(title).toContain('27 directors and 93 former officers');
  });
});

describe('when the counts are missing', () => {
  // A variant with no numbers would read "administradores y socios" — vaguer
  // than the control it replaced. Never ship a variant that is worse.
  it('falls back to the control template rather than promising nothing', () => {
    const empty = meta('Acciona', { counts: { active: 0, former: 0, filings: 0 } });
    const control = meta('Acciona', { variant: false });
    expect(empty).toEqual(control);
  });

  it('still renders when the company has no NIF at all', () => {
    const { title, desc } = meta('Acciona', { nif: null });
    expect(title).not.toContain('CIF');
    expect(title).toContain('27 administradores');
    expect(desc).not.toContain('CIF');
  });
});
