import { describe, expect, it } from 'vitest';
import {
  walkthroughCopy, connectorSentence, ownershipSentence, graphOnlyLine, identityLine,
} from './walkthroughCopy';

describe('walkthroughCopy', () => {
  it('falls back to Spanish for any unknown language', () => {
    expect(walkthroughCopy('fr').button).toBe('Recorrido');
    expect(walkthroughCopy('en').button).toBe('Walkthrough');
  });

  it('labels all seven sections and three sources in both languages', () => {
    for (const lang of ['es', 'en']) {
      const t = walkthroughCopy(lang);
      expect(Object.keys(t.sections)).toEqual([
        'subject', 'stands_out', 'connects', 'ownership', 'other_companies', 'unseen', 'author']);
      expect(Object.keys(t.sources)).toEqual(['registry', 'graph', 'author']);
    }
  });

  it('writes the connector sentence by status', () => {
    const t = walkthroughCopy('es');
    const base = { name: 'ANA GARCIA', roles: ['Administradora única', 'Consejera'], companies: ['ALFA SL', 'BETA SL'] };
    expect(connectorSentence(t, { ...base, status: 'active' }))
      .toBe('ANA GARCIA ocupa Administradora única, Consejera en ALFA SL y BETA SL');
    expect(connectorSentence(t, { ...base, status: 'ceased' })).toMatch(/^ANA GARCIA ocupó /);
    expect(connectorSentence(t, { ...base, status: 'mixed' })).toMatch(/^ANA GARCIA ocupa y ocupó /);
    expect(connectorSentence(walkthroughCopy('en'), { ...base, status: 'active' }))
      .toBe('ANA GARCIA holds Administradora única, Consejera at ALFA SL and BETA SL');
  });

  it('joins three companies with commas and a final conjunction', () => {
    const t = walkthroughCopy('en');
    expect(connectorSentence(t, { name: 'X', status: 'active', roles: ['Director'], companies: ['A', 'B', 'C'] }))
      .toBe('X holds Director at A, B and C');
  });

  it('writes ownership present and past', () => {
    expect(ownershipSentence(walkthroughCopy('es'), { owner: 'A', owned: 'B', lost: false })).toBe('A es socio único de B');
    expect(ownershipSentence(walkthroughCopy('es'), { owner: 'A', owned: 'B', lost: true })).toBe('A fue socio único de B');
    expect(ownershipSentence(walkthroughCopy('en'), { owner: 'A', owned: 'B', lost: false })).toBe('A is sole shareholder of B');
  });

  it('writes the graph-only line with the count', () => {
    expect(graphOnlyLine(walkthroughCopy('es'), 9)).toBe('9 cargos visibles en el mapa');
    expect(graphOnlyLine(walkthroughCopy('en'), 1)).toBe('1 officer visible on the map');
  });

  it('renders the identity line from a findings header, skipping blanks', () => {
    const t = walkthroughCopy('es');
    const line = identityLine(t, {
      nif: 'B12345678', province: 'Valencia', registry: 'V-98765',
      previous_names: ['ACME LEVANTE SL'], last_filing: { date: '2026-06-03', type: 'Nombramiento' },
    });
    expect(line).toBe('NIF B12345678 · Valencia · Hoja V-98765 · antes ACME LEVANTE SL · último acto BORME 2026-06-03, Nombramiento');
    expect(identityLine(t, { nif: null, province: null, registry: null, previous_names: [], last_filing: null })).toBe('');
  });

  it('builds the reset confirmation with counts', () => {
    expect(walkthroughCopy('en').resetConfirm(2, 1)).toBe('Discard 2 hidden steps and 1 note and rebuild the draft?');
  });
});
