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
      expect(typeof exportCopy('es')[key], `es.${key}`).toBe('string');
      expect(exportCopy('es')[key].length, `es.${key}`).toBeGreaterThan(0);
      expect(typeof exportCopy('en')[key], `en.${key}`).toBe('string');
      expect(exportCopy('en')[key].length, `en.${key}`).toBeGreaterThan(0);
    });
    // Check bidirectional: EN must not have keys that ES doesn't have
    const esKeys = Object.keys(exportCopy('es')).sort();
    const enKeys = Object.keys(exportCopy('en')).sort();
    expect(enKeys).toEqual(esKeys);
  });

  it('falls back to Spanish for an unknown language', () => {
    expect(exportCopy('fr').title).toBe('Informe de situación');
  });
});
