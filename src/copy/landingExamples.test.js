import { describe, expect, it } from 'vitest';
import { LANDING_EXAMPLES, exampleSearchOption } from './landingExamples';
import { buildLandingSearchHref } from '../components/LandingEntitySearch';

describe('LANDING_EXAMPLES — the example searches under the landing field', () => {
  it('offers Endesa, Inditex and FTI Consulting, in that order', () => {
    expect(LANDING_EXAMPLES.map(e => e.label)).toEqual(['Endesa', 'Inditex', 'FTI Consulting']);
  });

  it('binds every example to a registry group key, never to a name search', () => {
    // Typing "Inditex" into the live autocomplete ranks INDITEX LOGISTICA first
    // and never surfaces the parent, whose legal name is INDUSTRIA DE DISEÑO
    // TEXTIL. A chip that merely searched the label would open the wrong company.
    for (const example of LANDING_EXAMPLES) {
      expect(example.id).toMatch(/^H:[A-Z]+-\d+$/);
      expect(example.name.length).toBeGreaterThan(0);
    }
  });

  it('turns an example into the same option shape a picked suggestion has', () => {
    const inditex = LANDING_EXAMPLES.find(e => e.label === 'Inditex');
    expect(exampleSearchOption(inditex)).toEqual({
      type: 'company',
      name: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.',
      value: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.',
      label: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.',
      id: 'H:C-3342',
    });
  });

  it('deep-links each example to its exact entity, attributed to the example chip', () => {
    for (const example of LANDING_EXAMPLES) {
      const href = buildLandingSearchHref(exampleSearchOption(example), 'en', 'home_example');
      expect(href).toContain(`gk=${encodeURIComponent(example.id)}`);
      expect(href).toContain('source=home_example');
      expect(href).toContain('type=company');
    }
  });
});
