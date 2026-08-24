import { describe, it, expect } from 'vitest';
import {
  canonLegalForm,
  entityNameKey,
  normalizeCompanyName,
  looksLikeGroupKey,
  selectGroupKeyId,
  stripRegistryOffice,
  displayCompanyName,
  isSameUnifiableEntity,
} from './companyName';

describe('stripRegistryOffice', () => {
  it('strips a trailing (R.M. …) registry-office annotation', () => {
    expect(stripRegistryOffice('INDUSTRIA DE DISEÑO TEXTIL, S.A.(R.M. A CORUÑA)'))
      .toBe('INDUSTRIA DE DISEÑO TEXTIL, S.A.');
  });

  it('strips a dotless (RM …) spelling', () => {
    expect(stripRegistryOffice('ACME SL (RM MADRID)')).toBe('ACME SL');
  });

  it('leaves a name unchanged when there is no registry-office suffix', () => {
    expect(stripRegistryOffice('INDITEX, SA')).toBe('INDITEX, SA');
  });

  it('is null-safe and trims', () => {
    expect(stripRegistryOffice(null)).toBe('');
    expect(stripRegistryOffice(undefined)).toBe('');
  });
});

describe('displayCompanyName', () => {
  it('returns the registry-office-stripped, trimmed name', () => {
    expect(displayCompanyName('INDUSTRIA DE DISEÑO TEXTIL, S.A.(R.M. A CORUÑA)  '))
      .toBe('INDUSTRIA DE DISEÑO TEXTIL, S.A.');
  });

  it('is null-safe', () => {
    expect(displayCompanyName(null)).toBe('');
  });
});

describe('normalizeCompanyName', () => {
  it('strips a trailing period so registry variants compare equal', () => {
    expect(normalizeCompanyName('COCUNAT S.L.')).toBe('COCUNAT S.L');
    expect(normalizeCompanyName('COCUNAT S.L')).toBe('COCUNAT S.L');
  });

  it('strips a trailing (YYYY) year suffix', () => {
    expect(normalizeCompanyName('ACME SL (2024)')).toBe('ACME SL');
    expect(normalizeCompanyName('ACME SL (2024).')).toBe('ACME SL');
  });

  it('is null-safe and trims', () => {
    expect(normalizeCompanyName(null)).toBe('');
    expect(normalizeCompanyName('  ACME SL  ')).toBe('ACME SL');
  });
});

describe('looksLikeGroupKey', () => {
  it('accepts hoja and name-uniqueness keys', () => {
    expect(looksLikeGroupKey('H:B-441672')).toBe(true);
    expect(looksLikeGroupKey('N:M-396846')).toBe(true);
  });

  it('rejects opaque content-hash ids', () => {
    expect(looksLikeGroupKey('2b3200b6b59d301eeaaa72f7bb9f7d07')).toBe(false);
    expect(looksLikeGroupKey('')).toBe(false);
    expect(looksLikeGroupKey(null)).toBe(false);
  });
});

describe('selectGroupKeyId', () => {
  // The bug: node labelled "COCUNAT S.L" (no trailing period) whose directory
  // returns the real hoja doc AND a nameless opaque-hash duplicate. Raw
  // uppercase matching missed the period-different name and fell to the hash.
  it('resolves a period-different name to the real hoja key, not the hash', () => {
    const suggestions = [
      { id: 'H:B-441672', company_name_normalized: 'COCUNAT S.L.' },
      { id: '2b3200b6b59d301eeaaa72f7bb9f7d07', company_name_normalized: null },
    ];
    expect(selectGroupKeyId('COCUNAT S.L', suggestions)).toBe('H:B-441672');
  });

  it('resolves even when the hash duplicate is ranked first', () => {
    const suggestions = [
      { id: '2b3200b6b59d301eeaaa72f7bb9f7d07', company_name_normalized: null },
      { id: 'H:B-441672', company_name_normalized: 'COCUNAT S.L.' },
    ];
    expect(selectGroupKeyId('COCUNAT S.L', suggestions)).toBe('H:B-441672');
  });

  it('prefers a real group_key when several docs share the exact name', () => {
    const suggestions = [
      { id: 'deadbeefdeadbeefdeadbeefdeadbeef', company_name_normalized: 'ACME SL' },
      { id: 'H:M-12345', company_name_normalized: 'ACME SL' },
    ];
    expect(selectGroupKeyId('ACME SL', suggestions)).toBe('H:M-12345');
  });

  it('falls back to the best-ranked usable suggestion when nothing matches', () => {
    const suggestions = [
      { id: 'H:B-999', company_name_normalized: 'ACME HOLDINGS SL' },
      { id: 'H:B-111', company_name_normalized: 'ACME CAPITAL SL' },
    ];
    expect(selectGroupKeyId('ACME', suggestions)).toBe('H:B-999');
  });

  it('skips nameless hash duplicates when falling back on a non-exact match', () => {
    const suggestions = [
      { id: 'ffffffffffffffffffffffffffffffff', company_name_normalized: null },
      { id: 'H:B-222', company_name_normalized: 'ACME PARTNERS SL' },
    ];
    expect(selectGroupKeyId('ACME', suggestions)).toBe('H:B-222');
  });

  it('still returns a legitimate hash-keyed exact match', () => {
    const suggestions = [
      { id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', company_name_normalized: 'SOLO ENTITY SL' },
    ];
    expect(selectGroupKeyId('SOLO ENTITY SL', suggestions)).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('returns null for empty input', () => {
    expect(selectGroupKeyId('ACME', [])).toBe(null);
    expect(selectGroupKeyId('ACME', null)).toBe(null);
  });

  it('reads the legacy .name field when company_name_normalized is absent', () => {
    const suggestions = [
      { id: 'H:B-441672', name: 'COCUNAT S.L.' },
      { id: '2b3200b6b59d301eeaaa72f7bb9f7d07', name: null },
    ];
    expect(selectGroupKeyId('COCUNAT S.L', suggestions)).toBe('H:B-441672');
  });
});

describe('canonLegalForm', () => {
  it('collapses a trailing long-form legal suffix to the dotless code', () => {
    // v3 stores "DROMO GESTION 2026 SL"; autocomplete hands the UI the raw
    // BORME long form — both must canonicalize to the same string.
    expect(canonLegalForm('DROMO GESTION 2026 SOCIEDAD LIMITADA')).toBe(
      'DROMO GESTION 2026 SL'
    );
    expect(canonLegalForm('DROMO GESTION 2026 SL')).toBe('DROMO GESTION 2026 SL');
  });

  it('collapses dotted and spaced spellings', () => {
    expect(canonLegalForm('DELOITTE S.L.')).toBe('DELOITTE SL');
    expect(canonLegalForm('DELOITTE S. L.')).toBe('DELOITTE SL');
  });

  it('keeps different legal forms distinct', () => {
    expect(canonLegalForm('ACME SOCIEDAD ANONIMA')).toBe('ACME SA');
    expect(canonLegalForm('ACME SOCIEDAD LIMITADA UNIPERSONAL')).toBe('ACME SLU');
  });

  it('leaves personal names untouched', () => {
    expect(canonLegalForm('GARCIA LOPEZ MARIA')).toBe('GARCIA LOPEZ MARIA');
  });

  it('is case-insensitive on the suffix and null-safe', () => {
    expect(canonLegalForm('Dromo Gestion 2026 Sociedad Limitada')).toBe(
      'Dromo Gestion 2026 SL'
    );
    expect(canonLegalForm('')).toBe('');
    expect(canonLegalForm(null)).toBe('');
  });
});

describe('canonLegalForm SRL', () => {
  it('collapses foreign S.R.L. spelling variants to one dotless token', () => {
    expect(canonLegalForm('FIAT ARGENTINA S.R.L.')).toBe('FIAT ARGENTINA SRL');
    expect(canonLegalForm('FIAT ARGENTINA S. R. L.')).toBe('FIAT ARGENTINA SRL');
    expect(canonLegalForm('FIAT ARGENTINA SRL')).toBe('FIAT ARGENTINA SRL');
  });

  it('keeps SRL distinct from SL — foreign forms must not merge with Spanish SLs', () => {
    expect(canonLegalForm('ACME SRL')).not.toBe(canonLegalForm('ACME SL'));
  });
});

describe('entityNameKey', () => {
  it('folds the BORME comma the canonical company name keeps', () => {
    // The v3 expand exact-match filter dropped all 95 of the bank's seats
    // because "BANCO SANTANDER, SA" !== "BANCO SANTANDER SA" — unify no-opped.
    expect(entityNameKey('BANCO SANTANDER, SA')).toBe(entityNameKey('BANCO SANTANDER SA'));
    expect(entityNameKey('BANCO SANTANDER, S.A.')).toBe(entityNameKey('BANCO SANTANDER SA'));
  });

  it('still separates different entities and suffix-less names', () => {
    expect(entityNameKey('BANCO SANTANDER SA')).not.toBe(entityNameKey('BANCO SANTANDER BRASIL SA'));
    expect(entityNameKey('GARCIA LOPEZ JUAN')).not.toBe(entityNameKey('GARCIA LOPEZ JUAN SL'));
  });

  it('folds accents like the ES analyzer', () => {
    expect(entityNameKey('PEÑASANTA SA')).toBe(entityNameKey('PENASANTA SA'));
  });
});

describe('isSameUnifiableEntity', () => {
  // The identity decision behind "Unificar cargos": a cargo (officer) row and a
  // loaded COMPANY node are the same entity when their names key the same way.
  // mergeCargoIntoCompanyNode itself takes ids, so this predicate is the rule
  // that decides WHICH cargo rows belong to the company node.
  it('matches two spellings of one company (punctuation and legal-form folding)', () => {
    expect(isSameUnifiableEntity('BANCO SANTANDER, SA', 'BANCO SANTANDER S.A.')).toBe(true);
    expect(isSameUnifiableEntity('ACME CONSULTING SOCIEDAD LIMITADA', 'ACME CONSULTING SL')).toBe(true);
  });

  it('unifies a suffix-less listed officer with its company node', () => {
    // BORME printed "BANCO SANTANDER" as APODERADO of BANCO DE VASCONIA SA in
    // 2009; the company node carries the canonical "BANCO SANTANDER, SA".
    expect(isSameUnifiableEntity('BANCO SANTANDER', 'BANCO SANTANDER, SA')).toBe(true);
    expect(isSameUnifiableEntity('BANCO SANTANDER, SA', 'BANCO SANTANDER')).toBe(true);
  });

  it('SAFETY: never unifies a person with a company that shares their name', () => {
    // A small company's founder must stay a separate node. Neither name is in
    // the curated listed seed, so only the (differing) entity keys are compared.
    expect(isSameUnifiableEntity('LUIS SANCHEZ', 'LUIS SANCHEZ SL')).toBe(false);
    expect(isSameUnifiableEntity('LUIS SANCHEZ SL', 'LUIS SANCHEZ')).toBe(false);
  });

  it('SAFETY: never unifies a person whose surname is a listed brand', () => {
    expect(isSameUnifiableEntity('GRIFOLS ROURA VICTOR', 'GRIFOLS SA')).toBe(false);
    expect(isSameUnifiableEntity('PUIG LOPEZ MARIA', 'PUIG BRANDS S.A.')).toBe(false);
  });

  it('does not unify two different companies', () => {
    expect(isSameUnifiableEntity('ACME SL', 'ACME SA')).toBe(false);
    expect(isSameUnifiableEntity('BANCO SANTANDER', 'BANCO DE SABADELL SA')).toBe(false);
  });

  it('is false for empty or missing names on either side', () => {
    expect(isSameUnifiableEntity('', 'ACME SL')).toBe(false);
    expect(isSameUnifiableEntity('ACME SL', null)).toBe(false);
    expect(isSameUnifiableEntity(undefined, undefined)).toBe(false);
  });
  it('unifies the dotted registered spelling of a listed entity with its dotless print', () => {
    // "AENA S.M.E. SA" and "AENA SME SA" are the same filing spelled two ways.
    expect(isSameUnifiableEntity('AENA SME SA', 'AENA S.M.E. SA')).toBe(true);
  });
});
