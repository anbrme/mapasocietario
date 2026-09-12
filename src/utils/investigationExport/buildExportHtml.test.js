import { describe, expect, it } from 'vitest';
import { buildExportHtml, exportFileName } from './buildExportHtml';

const graphData = { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 10, y: 10 }], links: [] };
const doc = {
  subject: 'ALFA SL', generatedAt: '2026-09-12T09:00:00.000Z', networkNote: '', author: null, coverage: null,
  steps: [{ key: 'subject:c1', section: 'subject', nodeIds: ['c1'], linkKeys: [], title: 'ALFA SL', text: 'NIF B1', source: 'registry', date: null, evidence: null, flag: null, deepLink: 'https://mapasocietario.es/app?gk=c1&lang=es', authorNote: { text: 'x</script><script>alert(1)', flag: 'red', origin: 'step' } }],
  flagged: [], companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }], connectors: [], ownership: [], otherNotes: [], corrections: [],
  counts: { companies: 1, officers: 0, sharedPeople: 0, notes: 1, flagged: 0 },
};

describe('buildExportHtml', () => {
  it('is a self-contained document with embedded fonts, steps and labels', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).toContain('window.__SITREP__=');
    expect(html).toContain('"sectionLabel":"Sujeto"');
    expect(html).toContain('"sourceLabel":"Registro (BORME)"');
    expect(html).not.toContain('</script><script>alert');
    expect(html.match(/https?:\/\/[^"' )]+/g).every(u => u.startsWith('https://mapasocietario.es'))).toBe(true);
    expect(html).not.toMatch(/wordmark|<img/);
  });

  it('stays under 400 KB with a 200-node graph', () => {
    const nodes = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, type: i % 5 ? 'officer' : 'company', name: `NODE ${i}`, x: i, y: i * 2 }));
    const links = nodes.slice(1).map((n, i) => ({ source: nodes[i].id, target: n.id }));
    expect(buildExportHtml(doc, { nodes, links }, { lang: 'en' }).length).toBeLessThan(400 * 1024);
  });

  it('names the file by language, subject and date', () => {
    expect(exportFileName(doc, 'es')).toBe('Informe_de_situacion_ALFA_SL_20260912.html');
  });

  it('loads nothing from the network', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
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

  it('escapes a hostile network note instead of executing it', () => {
    const hostile = { ...doc, networkNote: '<script>alert(1)</script>' };
    const html = buildExportHtml(hostile, graphData, { lang: 'es' });

    // Escaping neutralises the angle brackets; the inner text necessarily
    // survives as literal characters. Assert on the tags, not on the payload.
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes a literal </script> inside a step note so the file is not truncated', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    // Only the two script tags the template itself writes (the JSON payload
    // and the walkthrough script) may close — the note's own "</script>"
    // must not produce a third one that truncates the document.
    expect((html.match(/<\/script>/gi) || []).length).toBe(2);

    const dataScript = html.match(/window\.__SITREP__=(.*?);<\/script>/s);
    expect(dataScript).not.toBeNull();
    const parsed = JSON.parse(dataScript[1]);
    expect(parsed.steps[0].authorNote.text).toBe('x</script><script>alert(1)');
  });

  it('does not throw on a null doc', () => {
    expect(() => buildExportHtml(null, { nodes: [], links: [] }, { lang: 'es' })).not.toThrow();
  });
});

describe('exportFileName', () => {
  it('strips characters a filesystem would reject', () => {
    expect(exportFileName({ ...doc, subject: 'A/B: "C" SL' }, 'en'))
      .toBe('Situation_report_A_B_C_SL_20260912.html');
  });

  it('still produces a name when there is no subject', () => {
    expect(exportFileName({ ...doc, subject: '' }, 'en')).toBe('Situation_report_20260912.html');
  });
});
