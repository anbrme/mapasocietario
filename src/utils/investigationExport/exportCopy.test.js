import { describe, expect, it } from 'vitest';
import { exportCopy, EXPORT_COPY_KEYS } from './exportCopy';

describe('exportCopy', () => {
  it('names the artefact "Informe de situación" in Spanish', () => {
    expect(exportCopy('es').title).toBe('Informe de situación');
  });

  it('names it "Situation report" in English', () => {
    expect(exportCopy('en').title).toBe('Situation report');
  });

  it('never puts the medium in the title', () => {
    expect(exportCopy('es').title.toLowerCase()).not.toContain('interactiv');
    expect(exportCopy('en').title.toLowerCase()).not.toContain('interactiv');
  });

  it('defines every key in both languages', () => {
    EXPORT_COPY_KEYS.forEach(key => {
      const esVal = exportCopy('es')[key];
      const enVal = exportCopy('en')[key];
      if (typeof esVal === 'function') {
        expect(typeof enVal, `en.${key}`).toBe('function');
        return;
      }
      // A nested group (facts): same keys on both sides, each a string or function.
      if (esVal && typeof esVal === 'object') {
        expect(Object.keys(enVal || {}).sort(), `en.${key}`).toEqual(Object.keys(esVal).sort());
        Object.keys(esVal).forEach(k => {
          expect(typeof enVal[k], `en.${key}.${k}`).toBe(typeof esVal[k]);
          if (typeof esVal[k] === 'string') expect(esVal[k].length, `es.${key}.${k}`).toBeGreaterThan(0);
        });
        return;
      }
      expect(typeof esVal, `es.${key}`).toBe('string');
      expect(esVal.length, `es.${key}`).toBeGreaterThan(0);
      expect(typeof enVal, `en.${key}`).toBe('string');
      expect(enVal.length, `en.${key}`).toBeGreaterThan(0);
    });
    // Check bidirectional: EN must not have keys that ES doesn't have
    const esKeys = Object.keys(exportCopy('es')).sort();
    const enKeys = Object.keys(exportCopy('en')).sort();
    expect(enKeys).toEqual(esKeys);
  });

  it('falls back to Spanish for an unknown language', () => {
    expect(exportCopy('fr').title).toBe('Informe de situación');
  });

  it('carries the new document-model keys in both languages', () => {
    const newKeys = [
      'contents', 'map', 'walkthroughSection', 'annexes', 'authorNote', 'elaboratedBy',
      'legendCompany', 'legendPerson', 'legendOwnership', 'legendFlag', 'evidenceLabel',
    ];
    newKeys.forEach(key => {
      expect(typeof exportCopy('es')[key], `es.${key}`).toBe('string');
      expect(exportCopy('es')[key].length, `es.${key}`).toBeGreaterThan(0);
      expect(typeof exportCopy('en')[key], `en.${key}`).toBe('string');
      expect(exportCopy('en')[key].length, `en.${key}`).toBeGreaterThan(0);
    });
  });

  it('exposes mapCaption, coverage and steps as functions returning strings', () => {
    ['es', 'en'].forEach(lang => {
      const t = exportCopy(lang);
      expect(typeof t.mapCaption).toBe('function');
      expect(typeof t.mapCaption(1, 3, 0)).toBe('string');
      expect(t.mapCaption(1, 3, 0).length).toBeGreaterThan(0);

      expect(typeof t.coverage).toBe('function');
      expect(typeof t.coverage('2009-01-01', '2026-09-11')).toBe('string');
      expect(t.coverage('2009-01-01', '2026-09-11').length).toBeGreaterThan(0);

      expect(typeof t.steps).toBe('function');
      expect(typeof t.steps(7)).toBe('string');
      expect(t.steps(7).length).toBeGreaterThan(0);
    });
  });

  it('formats chapterLabel with zero-padded number in both languages', () => {
    expect(exportCopy('es').chapterLabel(1, 'ACME')).toBe('01 ACME');
    expect(exportCopy('en').chapterLabel(1, 'ACME')).toBe('01 ACME');
    expect(exportCopy('es').chapterLabel(12, 'BETA SL')).toBe('12 BETA SL');
    expect(exportCopy('en').chapterLabel(12, 'BETA SL')).toBe('12 BETA SL');
  });

  it('carries the v3 story keys in both languages', () => {
    ['es', 'en'].forEach(lang => {
      const c = exportCopy(lang);
      expect(c.registryAsOf('2024-03-11')).toContain('2024-03-11');
      expect(c.undated(3)).toContain('3');
      expect(typeof c.dissolvedProxy).toBe('string');
      expect(c.returnLink('13 de septiembre de 2026')).toContain('2026');
      expect(typeof c.watchLink).toBe('string');
      expect(typeof c.explorer).toBe('string');
    });
    expect(exportCopy('es').explorer).toBe('Explorar la evidencia');
    expect(exportCopy('en').explorer).toBe('Explore the evidence');
  });
});


describe('mapCaption plurals', () => {
  it('singularises each count independently in both languages', () => {
    expect(exportCopy('es').mapCaption(1, 8, 0)).toBe('1 empresa · 8 personas · 0 conexiones compartidas · disposición del autor');
    expect(exportCopy('es').mapCaption(2, 1, 1)).toBe('2 empresas · 1 persona · 1 conexión compartida · disposición del autor');
    expect(exportCopy('en').mapCaption(1, 1, 1)).toBe("1 company · 1 person · 1 shared connection · author's layout");
    expect(exportCopy('en').mapCaption(2, 8, 0)).toBe("2 companies · 8 people · 0 shared connections · author's layout");
  });
});
