import { describe, it, expect } from 'vitest';
import { mergeEntitySuggestions } from './entitySuggestions';

const company = (name, extra = {}) => ({ name, type: 'company', ...extra });
const officer = (name, count) => ({ name, type: 'officer', company_count: count });

describe('mergeEntitySuggestions', () => {
  it('drops an officer row whose entity is already listed as a company', () => {
    // The two spellings of one entity: company directory serves the canonical
    // form, officers-autocomplete the raw BORME form.
    const { companies, officers } = mergeEntitySuggestions(
      [company('DROMO GESTION 2026 SL')],
      [officer('DROMO GESTION 2026 SOCIEDAD LIMITADA', 1)]
    );

    expect(officers).toEqual([]);
    expect(companies).toHaveLength(1);
  });

  it('stamps the surviving company row with the cargo count', () => {
    const { companies } = mergeEntitySuggestions(
      [company('DROMO GESTION 2026 SL')],
      [officer('DROMO GESTION 2026 SOCIEDAD LIMITADA', 1)]
    );

    expect(companies[0].company_count).toBe(1);
  });

  it('keeps officer rows with no company twin', () => {
    const { companies, officers } = mergeEntitySuggestions(
      [company('DROMO GESTION 2026 SL')],
      [officer('GARCIA LOPEZ MARIA', 3)]
    );

    expect(officers).toHaveLength(1);
    expect(companies).toHaveLength(1);
  });

  it('does not overwrite an existing cargo count on the company row', () => {
    const { companies } = mergeEntitySuggestions(
      [company('ACME SL', { company_count: 5 })],
      [officer('ACME SOCIEDAD LIMITADA', 2)]
    );

    expect(companies[0].company_count).toBe(5);
  });

  it('matches case-insensitively and preserves company order', () => {
    const { companies, officers } = mergeEntitySuggestions(
      [company('Primera SL'), company('SEGUNDA SA')],
      [officer('PRIMERA SOCIEDAD LIMITADA', 2), officer('Segunda Sociedad Anonima', 1)]
    );

    expect(officers).toEqual([]);
    expect(companies.map(c => c.name)).toEqual(['Primera SL', 'SEGUNDA SA']);
  });

  it('folds across punctuation: comma-carrying canonical company name', () => {
    // Regression: the bank's canonical name keeps the BORME comma
    // ("BANCO SANTANDER, SA") while officers-autocomplete serves the
    // comma-less printed spelling — the twin was never found.
    const { companies, officers } = mergeEntitySuggestions(
      [company('BANCO SANTANDER, SA')],
      [officer('BANCO SANTANDER SA', 27)]
    );

    expect(officers).toEqual([]);
    expect(companies[0].company_count).toBe(27);
  });

  it('never folds a suffix-less name into a suffixed company', () => {
    // "GARCIA LOPEZ JUAN" the person is NOT "GARCIA LOPEZ JUAN SL".
    const { officers } = mergeEntitySuggestions(
      [company('GARCIA LOPEZ JUAN SL')],
      [officer('GARCIA LOPEZ JUAN', 4)]
    );

    expect(officers).toHaveLength(1);
  });

  it('is null-safe on both sides', () => {
    expect(mergeEntitySuggestions(null, null)).toEqual({ companies: [], officers: [] });
  });
});
