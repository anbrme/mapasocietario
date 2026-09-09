import { describe, it, expect } from 'vitest';
import { COPY, TURNSTILE_SITEKEY, CONDITIONS } from './verificacion.js';

const langs = ['es', 'en'];
const flat = (lang) => JSON.stringify(COPY[lang]);

describe('the verification request page copy', () => {
  it('exists in both languages', () => {
    for (const l of langs) expect(COPY[l]).toBeTruthy();
  });

  it('says we do not verify identity and do not certify truth', () => {
    expect(flat('es')).toContain('No comprobamos su identidad');
    expect(flat('es')).toContain('no certificamos');
    expect(flat('en')).toContain('do not verify your identity');
    expect(flat('en')).toContain('do not certify');
  });

  it('excludes mancomunados up front, not after the form', () => {
    expect(flat('es')).toContain('mancomunados');
    expect(flat('en')).toContain('mancomunados');
  });

  it('says only the company may ask, about its own data', () => {
    expect(flat('es')).toMatch(/solo la (propia )?empresa/i);
    expect(flat('en')).toMatch(/only the company/i);
  });

  it('never calls the requester\'s company verified', () => {
    for (const l of langs) {
      expect(flat(l)).not.toMatch(/\bverificad[oa]s?\b/i);
      expect(flat(l)).not.toMatch(/\bis verified\b/i);
    }
  });

  it('promises no date for the stronger methods', () => {
    for (const l of langs) {
      expect(flat(l)).not.toMatch(/20\d\d/);
      expect(flat(l)).not.toMatch(/\bQ[1-4]\b/);
    }
  });

  it('carries the corporate-domain rule and a way through it', () => {
    for (const l of langs) expect(flat(l)).toContain('mapasocietario@ncdata.eu');
  });

  it('uses the shared public sitekey', () => {
    expect(TURNSTILE_SITEKEY).toBe('0x4AAAAAADp3WnZGNiZai_32');
  });
});

// CONDITIONS is read from both the /verificacion page and the company-profile
// panel (functions/empresa/_lib.js). The two doors must show the same terms.
describe('the shared CONDITIONS list', () => {
  it('has the same number of points in both languages', () => {
    expect(CONDITIONS.es.length).toBe(CONDITIONS.en.length);
  });

  it('mentions mancomunados in both languages', () => {
    expect(CONDITIONS.es.join(' ')).toContain('mancomunados');
    expect(CONDITIONS.en.join(' ')).toContain('mancomunados');
  });

  it('carries the no-identity, no-truth point in both languages', () => {
    expect(CONDITIONS.es.join(' ')).toMatch(/no comprobamos su identidad/i);
    expect(CONDITIONS.en.join(' ')).toMatch(/do not verify identity/i);
  });
});
