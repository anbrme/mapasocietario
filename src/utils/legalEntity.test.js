import { describe, it, expect } from 'vitest';
import { isLegalEntityName, isCorporateName } from './legalEntity';

describe('isLegalEntityName', () => {
  it('detects a Spanish SGIIC/SA compound suffix', () => {
    expect(isLegalEntityName('CAJAMAR GESTION SGIIC SA')).toBe(true);
  });

  it('detects a plain SL suffix', () => {
    expect(isLegalEntityName('ACME CONSULTING SL')).toBe(true);
  });

  it('detects a cooperative (SCOOP) suffix', () => {
    expect(isLegalEntityName('COOPERATIVA AGRICOLA SCOOP')).toBe(true);
  });

  it('detects an AIE (economic interest grouping) suffix', () => {
    expect(isLegalEntityName('CONSORCIO INDUSTRIAL AIE')).toBe(true);
  });

  it('detects a foreign GMBH suffix', () => {
    expect(isLegalEntityName('SIEMENS DEUTSCHLAND GMBH')).toBe(true);
  });

  it('detects other common foreign legal forms', () => {
    expect(isLegalEntityName('GLOBAL HOLDINGS LTD')).toBe(true);
    expect(isLegalEntityName('EUROPEAN TRADING SARL')).toBe(true);
    expect(isLegalEntityName('ITALIA ROSSI SPA')).toBe(true);
    expect(isLegalEntityName('DUTCH VENTURES BV')).toBe(true);
  });

  it('handles periods in Spanish suffixes (S.L., S.A.)', () => {
    expect(isLegalEntityName('ACME, S.L.')).toBe(true);
    expect(isLegalEntityName('ACME, S.A.')).toBe(true);
  });

  it('handles spaced-out "S. COOP." forms', () => {
    expect(isLegalEntityName('SDAD COOPERATIVA EJEMPLO S. COOP.')).toBe(true);
  });

  it('returns false for a plain person name', () => {
    expect(isLegalEntityName('GARCIA LOPEZ JUAN')).toBe(false);
  });

  it('does not false-positive on a surname containing suffix-like letters', () => {
    // "CASADO" contains "SA" as a substring but not as a trailing token.
    expect(isLegalEntityName('MARIA CASADO')).toBe(false);
    expect(isLegalEntityName('LUIS MASSA')).toBe(false);
  });

  it('handles empty/nullish input gracefully', () => {
    expect(isLegalEntityName('')).toBe(false);
    expect(isLegalEntityName(null)).toBe(false);
    expect(isLegalEntityName(undefined)).toBe(false);
  });
});

describe('isCorporateName', () => {
  it('keeps every isLegalEntityName verdict (the suffix rule still applies)', () => {
    expect(isCorporateName('CAJAMAR GESTION SGIIC SA')).toBe(true);
    expect(isCorporateName('ACME CONSULTING SL')).toBe(true);
    expect(isCorporateName('GARCIA LOPEZ JUAN')).toBe(false);
  });

  it('also accepts a suffix-less name that IS one of the 35 curated listed entities', () => {
    // BORME prints "BANCO SANTANDER" (no legal form) as an APODERADO; the
    // suffix rule alone renders the bank as a person.
    expect(isLegalEntityName('BANCO SANTANDER')).toBe(false);
    expect(isCorporateName('BANCO SANTANDER')).toBe(true);
    expect(isCorporateName('INDITEX')).toBe(true);
  });

  it('never promotes a person whose surname is a listed brand', () => {
    expect(isCorporateName('GRIFOLS ROURA VICTOR')).toBe(false);
    expect(isCorporateName('PUIG LOPEZ MARIA')).toBe(false);
  });

  it("never promotes a small company's founder", () => {
    expect(isCorporateName('LUIS SANCHEZ')).toBe(false);
  });

  it('returns false for empty, null, or undefined input', () => {
    expect(isCorporateName('')).toBe(false);
    expect(isCorporateName(null)).toBe(false);
    expect(isCorporateName(undefined)).toBe(false);
  });
});
