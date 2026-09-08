import { describe, it, expect } from 'vitest';
import { factDiff } from './diff.js';

describe('factDiff', () => {
  it('flags a corrected value as differing', () => {
    const [row] = factDiff([{ fact_key: 'address', declared_status: 'corrected',
      declared_value: 'C/ NUEVA 5', registry_value_at_issue: 'C/ VIEJA 1' }]);
    expect(row).toEqual({ fact_key: 'address', declared: 'C/ NUEVA 5',
      registry: 'C/ VIEJA 1', differs: true });
  });
  it('does not flag an unchanged confirmation', () => {
    expect(factDiff([{ fact_key: 'address', declared_status: 'current',
      declared_value: 'C/ VIEJA 1', registry_value_at_issue: 'C/ VIEJA 1' }])[0].differs).toBe(false);
  });
  it('treats a null registry value with a declared value as differing', () => {
    expect(factDiff([{ fact_key: 'operational', declared_status: 'current',
      declared_value: 'trading', registry_value_at_issue: null }])[0].differs).toBe(true);
  });
  it('does not flag two nulls', () => {
    expect(factDiff([{ fact_key: 'vat_intraeu', declared_status: 'not_applicable',
      declared_value: null, registry_value_at_issue: null }])[0].differs).toBe(false);
  });
});
