import { describe, it, expect } from 'vitest';
import { STUDIES, HUB_PATHS, LANGS, studyPath, citationText, hubPath } from './studies.js';

describe('studies registry', () => {
  it('exposes at least the interlock study', () => {
    expect(STUDIES.length).toBeGreaterThan(0);
    expect(STUDIES.map((s) => s.id)).toContain('ibex35-interlocking-boards');
  });

  it('gives every study a path, title and blurb in both languages', () => {
    for (const study of STUDIES) {
      for (const lang of LANGS) {
        expect(study.paths[lang], `${study.id}.paths.${lang}`).toMatch(/^\/[a-z0-9/-]+$/);
        expect(study.paths[lang].endsWith('/'), `${study.id}.paths.${lang} trailing slash`).toBe(false);
        expect(study[lang].title.length).toBeGreaterThan(0);
        expect(study[lang].blurb.length).toBeGreaterThan(0);
      }
    }
  });

  it('names a data file so the date is read from the snapshot, never retyped', () => {
    for (const study of STUDIES) expect(study.dataFile).toMatch(/\.json$/);
  });

  it('keeps every path unique across studies and hubs', () => {
    const all = [...STUDIES.flatMap((s) => LANGS.map((l) => s.paths[l])), ...LANGS.map((l) => HUB_PATHS[l])];
    expect(new Set(all).size).toBe(all.length);
  });

  it('builds absolute study and hub URLs with a trailing slash', () => {
    const s = STUDIES[0];
    expect(studyPath(s, 'es')).toBe(`${s.paths.es}/`);
    expect(hubPath('en')).toBe('/en/studies/');
  });

  it('formats a citation carrying publisher, title, date and canonical URL', () => {
    const s = STUDIES.find((x) => x.id === 'ibex35-interlocking-boards');
    const cite = citationText(s, 'es', '2026-05-31', 'https://mapasocietario.es');
    expect(cite).toContain('Mapa Societario');
    expect(cite).toContain(s.es.title);
    expect(cite).toContain('2026');
    expect(cite).toContain('https://mapasocietario.es/estudios/consejos-cruzados-ibex-35/');
  });

  it('cites in the requested language', () => {
    const s = STUDIES[0];
    expect(citationText(s, 'en', '2026-05-31', 'https://mapasocietario.es')).toContain(s.en.title);
    expect(citationText(s, 'en', '2026-05-31', 'https://mapasocietario.es')).toContain('BORME');
  });
});
