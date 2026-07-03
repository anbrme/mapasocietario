import { describe, it, expect } from 'vitest';
import { isLegalEntityName } from './legalEntity';

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
