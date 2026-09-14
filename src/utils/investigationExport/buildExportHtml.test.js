import { describe, expect, it } from 'vitest';
import { buildExportHtml, exportFileName } from './buildExportHtml';

describe('no-script viewers', () => {
  it('marks the document nojs until the script runs, and carries the static-view note', () => {
    const html = buildExportHtml({ steps: [], companies: [], counts: {} }, { nodes: [], links: [] }, { lang: 'es' });
    expect(html).toContain('<html lang="es" class="nojs">');
    expect(html).toContain("<script>document.documentElement.classList.remove('nojs');window.__SITREP__=");
    expect(html).toContain('<noscript><p class="nojs-note">Vista estática');
  });
});

const graphData = { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 10, y: 10 }], links: [] };
const doc = {
  subject: 'ALFA SL',
  generatedAt: '2026-09-12T09:00:00.000Z',
  networkNote: '',
  author: null,
  coverage: null,
  opening: { title: 'Recorrido por esta red · 1 paso', line: 'Tu selección, en el orden elegido' },
  steps: [{
    key: 'step:c1',
    nodeId: 'c1',
    kind: 'company',
    title: 'ALFA SL',
    summary: 'NIF B1',
    source: 'registry',
    nodeIds: ['c1'],
    linkKeys: [],
    flag: 'red',
    deepLink: 'https://mapasocietario.es/app?gk=c1&lang=es',
    evidence: {
      identity: 'NIF B1',
      status: { dissolved: false, concurso: false, lastFiling: null },
      capital: null,
      activity: null,
      board: [],
      filings: [],
      findings: [{ text: 'Sin hallazgos relevantes', date: '2024-01-01', cls: 'context' }],
      unseen: [],
      ownership: [],
    },
    narrative: { text: 'x</script><script>alert(1)', flag: 'red' },
  }],
  flagged: [],
  companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }],
  connectors: [],
  ownership: [],
  otherNotes: [],
  corrections: [],
  counts: {
    companies: 1, officers: 0, sharedPeople: 0, notes: 1, flagged: 0,
  },
};

describe('buildExportHtml', () => {
  it('is a self-contained document with embedded fonts, steps and labels', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).toContain('window.__SITREP__=');
    expect(html).toContain('"kindLabel":"Empresa"');
    expect(html).toContain('"sourceLabel":"Registro (BORME)"');
    expect(html).not.toContain('</script><script>alert');
    expect(html.match(/https?:\/\/[^"' )]+/g).every(u => u.startsWith('https://mapasocietario.es'))).toBe(true);
    expect(html).not.toMatch(/wordmark|<img/);
  });

  it('embeds the opening block and the step evidenceLine', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });
    const dataScript = html.match(/window\.__SITREP__=(.*?);<\/script>/s);
    const parsed = JSON.parse(dataScript[1]);

    expect(parsed.opening).toEqual(doc.opening);
    expect(parsed.noteLabel).toBe('Nota del autor');
    expect(parsed.steps[0].evidenceLine).toBe('Sin hallazgos relevantes');
    expect(parsed.steps[0].narrative).toEqual({ text: 'x</script><script>alert(1)', flag: 'red' });
  });

  it('embeds the timeline and the language, with < escaped, and the chapter moment', () => {
    const html = buildExportHtml({
      ...doc,
      timeline: {
        dates: ['2026-09-12'], nodes: {}, links: {}, undated: 0, readOn: '2026-09-12', evil: '</script>',
      },
      steps: [{ ...doc.steps[0], moment: '2024-03-11' }],
    }, graphData, { lang: 'es' });
    expect(html).toContain('"timeline":{');
    expect(html).toContain('"lang":"es"');
    expect(html).toContain('"moment":"2024-03-11"');
    expect(html).not.toContain('</script>"');
    expect(html).toContain('id="story"');
  });

  it('embeds null for opening when the doc carries none', () => {
    const html = buildExportHtml({ ...doc, opening: null }, graphData, { lang: 'es' });
    const dataScript = html.match(/window\.__SITREP__=(.*?);<\/script>/s);
    const parsed = JSON.parse(dataScript[1]);
    expect(parsed.opening).toBeNull();
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

  it('escapes a literal </script> inside a step narrative so the file is not truncated', () => {
    const html = buildExportHtml(doc, graphData, { lang: 'es' });

    // Only the two script tags the template itself writes (the JSON payload
    // and the walkthrough script) may close — the narrative's own
    // "</script>" must not produce a third one that truncates the document.
    expect((html.match(/<\/script>/gi) || []).length).toBe(2);

    const dataScript = html.match(/window\.__SITREP__=(.*?);<\/script>/s);
    expect(dataScript).not.toBeNull();
    const parsed = JSON.parse(dataScript[1]);
    expect(parsed.steps[0].narrative.text).toBe('x</script><script>alert(1)');
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
