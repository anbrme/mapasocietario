import { describe, it, expect } from 'vitest';
import { FACT_KEYS, factsFromRegistry, applyEdits } from './facts.js';

const COMPANY = {
  company_name: 'NURNBERG CONSULTING SL',
  current_address: 'C/ ARZOBISPO COS 10, BAJO (MADRID)',
  is_in_concurso: false, is_dissolved: false, enriched_nif: 'B86829538',
  officers_active: [{ name: 'NURNBERG ALESSANDRO', position_normalized: 'ADM. UNICO' }],
};

describe('factsFromRegistry', () => {
  it('produces exactly the seven fact keys, in a stable order', () => {
    expect(factsFromRegistry(COMPANY).map((f) => f.fact_key)).toEqual(FACT_KEYS);
  });
  it('gives vat_intraeu the vies source and operational NO source', () => {
    const by = Object.fromEntries(factsFromRegistry(COMPANY).map((f) => [f.fact_key, f]));
    expect(by.vat_intraeu.check_source).toBe('vies');
    expect(by.operational.check_source).toBe('none');
    expect(by.address.check_source).toBe('borme');
  });
  it('does NOT infer operational from is_dissolved', () => {
    const by = Object.fromEntries(factsFromRegistry(COMPANY).map((f) => [f.fact_key, f]));
    expect(by.operational.registry_value_at_issue).toBeNull();
    expect(by.operational.declared_status).toBe('not_applicable');
  });
});

describe('applyEdits', () => {
  it('marks an edited value corrected and keeps the registry value', () => {
    const edited = applyEdits(factsFromRegistry(COMPANY),
      [{ fact_key: 'address', declared_status: 'corrected', declared_value: 'C/ NUEVA 5' }]);
    const address = edited.find((f) => f.fact_key === 'address');
    expect(address.declared_status).toBe('corrected');
    expect(address.declared_value).toBe('C/ NUEVA 5');
    expect(address.registry_value_at_issue).toBe('C/ ARZOBISPO COS 10, BAJO (MADRID)');
  });
  it('ignores an unknown fact key rather than inventing a fact', () => {
    const edited = applyEdits(factsFromRegistry(COMPANY),
      [{ fact_key: 'revenue', declared_status: 'current', declared_value: '1M' }]);
    expect(edited.map((f) => f.fact_key)).toEqual(FACT_KEYS);
  });
  it('leaves untouched facts alone', () => {
    const base = factsFromRegistry(COMPANY);
    expect(applyEdits(base, [])).toEqual(base);
  });
});

// --- Regression: code review 2026-09-08 -------------------------------------

import { projectRegistry, validateEdits } from './facts.js';

describe('insolvency status (finding 5)', () => {
  it('declares insolvency CURRENT when the registry reports concurso', () => {
    const by = Object.fromEntries(
      factsFromRegistry({ ...COMPANY, is_in_concurso: true }).map((f) => [f.fact_key, f]));
    expect(by.insolvency.registry_value_at_issue).toBe('concurso');
    // Previously hard-coded to 'none', so a company IN concurso pre-filled a
    // declaration of no insolvency and diff.js flagged nothing for the reviewer.
    expect(by.insolvency.declared_status).toBe('current');
  });

  it('still declares none when there is no concurso', () => {
    const by = Object.fromEntries(factsFromRegistry(COMPANY).map((f) => [f.fact_key, f]));
    expect(by.insolvency.declared_status).toBe('none');
  });
});

describe('projectRegistry (finding 2)', () => {
  it('is unchanged by pipeline metadata that moves nightly', () => {
    const before = projectRegistry({ ...COMPANY, processed_at: '2026-08-29T12:18:40',
      enriched_at: '2026-08-19T14:22:08', normalization_version: '1.1.0', total_publications: 2 });
    const after = projectRegistry({ ...COMPANY, processed_at: '2026-09-08T03:00:00',
      enriched_at: '2026-09-07T22:10:00', normalization_version: '1.1.0', total_publications: 3 });
    expect(after).toEqual(before);
  });

  it('DOES change when a registry fact changes', () => {
    expect(projectRegistry({ ...COMPANY, current_address: 'C/ NUEVA 5' }))
      .not.toEqual(projectRegistry(COMPANY));
  });

  it('is stable under officer ordering', () => {
    const two = [{ name: 'B PERSON', position_normalized: 'ADM. UNICO' },
                 { name: 'A PERSON', position_normalized: 'APODERADO' }];
    expect(projectRegistry({ ...COMPANY, officers_active: two }))
      .toEqual(projectRegistry({ ...COMPANY, officers_active: [...two].reverse() }));
  });

  it('carries none of the excluded keys', () => {
    const keys = Object.keys(projectRegistry({ ...COMPANY, processed_at: 'x', enriched_at: 'y',
      normalization_version: 'z', total_publications: 9, event_source_ids: ['a'] }));
    for (const k of ['processed_at', 'enriched_at', 'normalization_version',
                     'total_publications', 'event_source_ids']) {
      expect(keys).not.toContain(k);
    }
  });
});

describe('validateEdits (finding 3)', () => {
  it('accepts a well-formed correction', () => {
    expect(validateEdits([{ fact_key: 'address', declared_status: 'corrected',
      declared_value: ' C/ NUEVA 5 ' }]))
      .toEqual({ ok: true, value: [{ fact_key: 'address', declared_status: 'corrected',
        declared_value: 'C/ NUEVA 5' }] });
  });
  it('treats absent edits as an empty list', () => {
    expect(validateEdits(undefined)).toEqual({ ok: true, value: [] });
  });
  it('rejects an unknown fact key before it reaches the database', () => {
    expect(validateEdits([{ fact_key: 'revenue', declared_status: 'current' }]).reason)
      .toBe('unknown_fact_key');
  });
  it('rejects a declared_status the CHECK constraint would refuse', () => {
    expect(validateEdits([{ fact_key: 'address', declared_status: 'whatever' }]).reason)
      .toBe('invalid_declared_status');
  });
  it('rejects a missing declared_status rather than binding undefined', () => {
    expect(validateEdits([{ fact_key: 'address' }]).reason).toBe('invalid_declared_status');
  });
  it('rejects a non-string declared_value', () => {
    expect(validateEdits([{ fact_key: 'address', declared_status: 'current',
      declared_value: { evil: true } }]).reason).toBe('invalid_declared_value');
  });
  it('rejects an empty correction', () => {
    expect(validateEdits([{ fact_key: 'address', declared_status: 'corrected',
      declared_value: '  ' }]).reason).toBe('correction_requires_a_value');
  });
  it('caps the length', () => {
    expect(validateEdits([{ fact_key: 'address', declared_status: 'corrected',
      declared_value: 'x'.repeat(501) }]).reason).toBe('declared_value_too_long');
  });
  it('rejects a non-array', () => {
    expect(validateEdits('address').reason).toBe('edits_not_an_array');
  });
});
