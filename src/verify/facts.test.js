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
