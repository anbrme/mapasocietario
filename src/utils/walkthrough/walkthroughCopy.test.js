import { describe, expect, it } from 'vitest';
import {
  walkthroughCopy, graphOnlyLine, identityLine, platformModifier,
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

describe('v2 copy', () => {
  it('names the opening card in both languages', () => {
    expect(walkthroughCopy('es').opening(8)).toBe('Recorrido por esta red · 8 pasos');
    expect(walkthroughCopy('en').opening(1)).toBe('Walkthrough of this network · 1 step');
    expect(walkthroughCopy('es').openingCapped(15)).toBe('Se muestran los 12 primeros de 15 seleccionados');
    expect(walkthroughCopy('es').openingCapped(15, 5)).toBe('Se muestran los 5 primeros de 15 seleccionados');
    expect(walkthroughCopy('en').openingCapped(20, 12)).toBe('Showing the first 12 of 20 selected');
  });
  it('renders the selection hint with the platform modifier', () => {
    expect(walkthroughCopy('es').hint('⌘')).toBe('Selecciona nodos con ⌘+clic (Ctrl+clic en Windows/Linux) para elegir los pasos. Sin selección, se genera un borrador.');
    expect(walkthroughCopy('en').hint('Ctrl')).toBe('Select nodes with Ctrl+click (Ctrl+click on Windows/Linux) to choose the steps. With no selection, a draft is generated.');
  });
  it('detects the platform modifier', () => {
    expect(platformModifier({ platform: 'MacIntel' })).toBe('⌘');
    expect(platformModifier({ userAgentData: { platform: 'macOS' } })).toBe('⌘');
    expect(platformModifier({ platform: 'Win32' })).toBe('Ctrl');
    expect(platformModifier(undefined)).toBe('Ctrl');
  });
  it('carries kinds, blocks and subheads', () => {
    const t = walkthroughCopy('es');
    expect(t.kinds).toEqual({ company: 'Empresa', person: 'Persona', note: 'Nota' });
    expect(Object.keys(t.blocks)).toEqual(['identity', 'board', 'filings', 'findings']);
    expect(t.subheads.seats).toBe('Cargos en las empresas del mapa');
    expect(walkthroughCopy('en').openPreview).toBe('Open preview');
  });
  it('formats seatsLine with counts for companies and seats', () => {
    expect(walkthroughCopy('es').seatsLine(2, 2)).toBe('2 cargos en 2 empresas');
    expect(walkthroughCopy('es').seatsLine(1, 1)).toBe('1 cargo en 1 empresa');
    expect(walkthroughCopy('en').seatsLine(2, 2)).toBe('2 seats across 2 companies');
    expect(walkthroughCopy('en').seatsLine(1, 1)).toBe('1 seat across 1 company');
  });
  it('provides previewBlocked message', () => {
    expect(walkthroughCopy('es').previewBlocked).toBe('El navegador bloqueó la pestaña; permite ventanas emergentes para la vista previa.');
    expect(walkthroughCopy('en').previewBlocked).toBe('The browser blocked the tab; allow pop-ups to open the preview.');
  });
  it('labels the moment field in both languages', () => {
    expect(walkthroughCopy('es').momentLabel).toBe('Momento');
    expect(walkthroughCopy('en').momentLabel).toBe('Moment');
  });
});
