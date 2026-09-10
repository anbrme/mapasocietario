import { describe, expect, it } from 'vitest';
import { buildExportHtml, exportFileName } from './buildExportHtml';

const doc = {
  subject: 'ALFA SL',
  generatedAt: '2026-09-10T09:00:00.000Z',
  networkNote: 'Checking a suspected common controller.',
  flagged: [{ nodeId: 'c1', name: 'ALFA SL', type: 'company', flag: 'red', text: 'Same address as BETA' }],
  companies: [{ nodeId: 'c1', name: 'ALFA SL', note: { text: 'Same address as BETA', flag: 'red' } }],
  connectors: [{ name: 'GARCIA LOPEZ ANA', nodeId: 'o1', type: 'individual', companies: ['ALFA SL', 'BETA SL'], roles: ['Administrador'], status: 'active', note: null }],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  otherNotes: [],
  corrections: [{ action: 'merge', nameA: 'GARCIA LOPEZ, ANA', nameB: 'GARCIA LOPEZ ANA', resignedDate: '' }],
  counts: { companies: 2, officers: 2, sharedPeople: 1, notes: 1, flagged: 1 },
};

const graphData = {
  nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 0, y: 0 }],
  links: [],
};

describe('buildExportHtml', () => {
  it('is a complete self-contained document', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('loads nothing from the network', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/https?:\/\/(?!mapasocietario\.es)/);
  });

  it('carries attribution and a non-authoritative statement', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html).toContain('no autoritativo');
    expect(html).toContain('mapasocietario.es');
  });

  it('never calls itself an investigation report', () => {
    const es = buildExportHtml(doc, graphData, { lang: 'es' });
    const en = buildExportHtml(doc, graphData, { lang: 'en' });

    expect(es.toLowerCase()).not.toContain('informe de investigación');
    expect(en.toLowerCase()).not.toContain('investigation report');
  });

  it('escapes a hostile note instead of executing it', () => {
    const hostile = {
      ...doc,
      networkNote: '<script>alert(1)</script>',
      flagged: [{ ...doc.flagged[0], text: '<img src=x onerror=alert(1)>' }],
    };
    const html = buildExportHtml(hostile, graphData, { lang: 'es' });

    // Escaping neutralises the angle brackets; the inner text necessarily
    // survives as literal characters. Assert on the tags, not on the payload.
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });

  it('writes the flagged notes into the walkthrough global', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html).toContain('__SITREP__');
    expect(html).toContain('Same address as BETA');
  });

  it('omits the walkthrough controls when nothing is flagged', () => {
    const html = buildExportHtml({ ...doc, flagged: [], counts: { ...doc.counts, flagged: 0 } }, graphData, { lang: 'es' });

    expect(html).not.toContain('<button id="wt-start"');
    expect(html).toContain('__SITREP__'); // the script is always inlined; only the controls are conditional
  });

  it('omits the summary section when no network note was written', () => {
    const html = buildExportHtml({ ...doc, networkNote: '' }, graphData, { lang: 'es' });

    expect(html).not.toContain('id="summary"');
  });

  it('defines colours for both themes', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    expect(html).toContain('prefers-color-scheme: dark');
  });
});

describe('exportFileName', () => {
  it('names the file after the subject and the generation date', () => {
    expect(exportFileName(doc, 'es')).toBe('Informe_de_situacion_ALFA_SL_20260910.html');
    expect(exportFileName(doc, 'en')).toBe('Situation_report_ALFA_SL_20260910.html');
  });

  it('strips characters a filesystem would reject', () => {
    expect(exportFileName({ ...doc, subject: 'A/B: "C" SL' }, 'en'))
      .toBe('Situation_report_A_B_C_SL_20260910.html');
  });

  it('still produces a name when there is no subject', () => {
    expect(exportFileName({ ...doc, subject: '' }, 'en')).toBe('Situation_report_20260910.html');
  });
});
