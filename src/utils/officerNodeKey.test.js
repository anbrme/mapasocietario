import { describe, it, expect } from 'vitest';
import { officerNodeKey, officerIdFor } from './officerNodeKey';

describe('officerNodeKey', () => {
  it('produces the same key for every legal-form spelling of one entity', () => {
    // The graph must not create two nodes for the same corporate officer just
    // because autocomplete (raw BORME spelling) and v3 (canonical dotless)
    // disagree about the trailing legal form.
    const long = officerNodeKey('DROMO GESTION 2026 SOCIEDAD LIMITADA');
    const short = officerNodeKey('DROMO GESTION 2026 SL');
    const dotted = officerNodeKey('DROMO GESTION 2026 S.L.');

    expect(long).toBe(short);
    expect(dotted).toBe(short);
  });

  it('keeps different legal forms distinct', () => {
    expect(officerNodeKey('ACME SL')).not.toBe(officerNodeKey('ACME SA'));
  });

  it('lowercases and collapses whitespace/hyphens like the legacy key', () => {
    expect(officerNodeKey('FERNANDEZ-PACHECO SANCHEZ  ANTONIO')).toBe(
      'fernandez-pacheco-sanchez-antonio'
    );
  });

  it('is null-safe', () => {
    expect(officerNodeKey('')).toBe('');
    expect(officerNodeKey(null)).toBe('');
  });
});

describe('officerIdFor', () => {
  it('prefixes the canonical key', () => {
    expect(officerIdFor('DROMO GESTION 2026 SOCIEDAD LIMITADA')).toBe(
      'officer-dromo-gestion-2026-sl'
    );
  });
});
