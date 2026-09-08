import { describe, it, expect } from 'vitest';
import { uiModeFor, statusForMode, factLabel, displayValue } from './factUi.js';
import { factsFromRegistry } from './facts.js';

describe('confirming a fact must not change what it says', () => {
  it("keeps insolvency's derived 'none' when confirmed", () => {
    // The bug: the radio bound to declared_status, 'none' matched no option, and
    // confirming wrote 'current' - i.e. "insolvency IS in force" on a solvent
    // company, with declared_value still 'none'.
    expect(statusForMode('confirm', 'none')).toBe('none');
  });

  it('keeps current as current', () => {
    expect(statusForMode('confirm', 'current')).toBe('current');
  });

  it('round-trips every status the registry can derive', () => {
    const company = { company_name: 'X SL', current_address: 'C/ A 1', is_in_concurso: false,
                      enriched_nif: 'B1', hojas: ['M-1'],
                      officers_active: [{ name: 'A B', position_normalized: 'ADM. UNICO' }] };
    for (const f of factsFromRegistry(company)) {
      expect(statusForMode(uiModeFor(f.declared_status), f.declared_status))
        .toBe(f.declared_status);
    }
  });

  it('round-trips for a company IN concurso too', () => {
    const company = { company_name: 'X SL', current_address: 'C/ A 1', is_in_concurso: true,
                      enriched_nif: 'B1', hojas: ['M-1'], officers_active: [] };
    const insolvency = factsFromRegistry(company).find((f) => f.fact_key === 'insolvency');
    expect(insolvency.declared_status).toBe('current');
    expect(statusForMode(uiModeFor('current'), 'current')).toBe('current');
  });

  it('maps the other two intents explicitly', () => {
    expect(statusForMode('correct', 'none')).toBe('corrected');
    expect(statusForMode('na', 'current')).toBe('not_applicable');
  });

  it('selects a radio for every derivable status', () => {
    for (const s of ['current', 'none', 'corrected', 'not_applicable']) {
      expect(['confirm', 'correct', 'na']).toContain(uiModeFor(s));
    }
  });
});

describe('presentation', () => {
  it('never shows a raw fact key', () => {
    for (const lang of ['es', 'en']) {
      for (const k of ['representation', 'officers', 'address', 'insolvency',
                       'nif', 'vat_intraeu', 'operational']) {
        expect(factLabel(k, lang)).not.toBe(k);
      }
    }
  });
  it('turns the insolvency token into a sentence', () => {
    expect(displayValue('insolvency', 'none', 'es')).toBe('Sin constancia de concurso');
    expect(displayValue('insolvency', 'concurso', 'en')).toBe('Insolvency proceeding on record');
  });
  it('renders an empty value as a dash, not as "None"', () => {
    expect(displayValue('operational', null, 'es')).toBe('—');
    expect(displayValue('vat_intraeu', undefined, 'en')).toBe('—');
  });
});
