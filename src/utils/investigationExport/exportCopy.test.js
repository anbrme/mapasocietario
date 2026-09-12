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
});
