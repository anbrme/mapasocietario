import { describe, expect, it } from 'vitest';
import { exportCopy } from './exportCopy';
import { walkthroughCopy } from '../walkthrough/walkthroughCopy';
import {
  renderCover, renderContents, renderSummary, renderMapFigure, renderChapters, renderAnnexes, renderFooter,
} from './documentSections';

const t = exportCopy('es');
const wt = walkthroughCopy('es');
const step = (key, extra = {}) => ({ key, section: 'connects', nodeIds: ['o1'], linkKeys: [], title: 'ANA', text: 'ANA ocupa X en A y B', source: 'graph', date: null, evidence: null, flag: null, deepLink: '', authorNote: null, ...extra });
const doc = {
  subject: 'ALFA SL', generatedAt: '2026-09-12T09:00:00.000Z', networkNote: 'Lo que vi',
  author: { name: 'Ana', organisation: 'NC' }, coverage: { since: '2009-01-01', indexedThrough: '2026-09-11' },
  steps: [step('a'), step('b', { source: 'registry', date: '2024-03-11', text: 'Reducción de capital.', authorNote: { text: '<b>ojo</b>', flag: 'amber', origin: 'node' } })],
  flagged: [], companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }], connectors: [], ownership: [], otherNotes: [],
  corrections: [], counts: { companies: 1, officers: 3, sharedPeople: 0, notes: 1, flagged: 0 },
};

describe('documentSections', () => {
  it('cover shows the author line only when a field is set', () => {
    expect(renderCover(doc, t, 'es')).toContain('Elaborado por Ana · NC');
    expect(renderCover({ ...doc, author: { name: '', organisation: 'NC' } }, t, 'es')).toContain('Elaborado por NC');
    expect(renderCover({ ...doc, author: null }, t, 'es')).not.toContain('Elaborado por');
    expect(renderCover(doc, t, 'es')).not.toMatch(/logo|wordmark/i);
  });

  it('contents anchors every rendered section and skips empty ones', () => {
    const html = renderContents(doc, t);
    expect(html).toContain('href="#summary"');
    expect(html).toContain('href="#walkthrough"');
    expect(html).toContain('href="#annexes"');
    expect(renderContents({ ...doc, networkNote: '' }, t)).not.toContain('href="#summary"');
  });

  it('summary is omitted when empty', () => {
    expect(renderSummary({ ...doc, networkNote: '' }, t)).toBe('');
    expect(renderSummary(doc, t)).toContain('<p class="lead">Lo que vi</p>');
  });

  it('map figure carries legend, caption counts and the walkthrough controls', () => {
    const html = renderMapFigure(doc, { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2 }], links: [] }, t);
    expect(html).toContain('id="map"');
    expect(html).toContain('class="legend"');
    expect(html).toContain('1 empresas · 3 personas · 0 conexiones compartidas');
    expect(html).toContain('id="wt-start"');
  });

  it('omits the walkthrough controls and panel entirely when there are no steps', () => {
    const html = renderMapFigure({ ...doc, steps: [] }, { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2 }], links: [] }, t);
    expect(html).not.toContain('id="wt-start"');
    expect(html).not.toContain('id="wt-panel"');
  });

  it('rings a node on the map when its own step carries a red/amber author note', () => {
    const flaggedStep = step('c', { section: 'stands_out', nodeIds: ['c1'], authorNote: { text: 'Cuidado', flag: 'amber', origin: 'node' } });
    const html = renderMapFigure({ ...doc, steps: [flaggedStep] },
      { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2, userNote: { flag: 'amber', text: 'Cuidado' } }], links: [] }, t);
    expect(html).toContain('data-flag="amber"');
  });

  it('chapters number steps, label section and source, escape the note, and mark two voices', () => {
    const html = renderChapters(doc, t, wt);
    expect(html).toContain('id="ch-0"');
    expect(html).toContain('onclick="__sitrepShow(1)"');
    expect(html).toContain('Quién conecta');
    expect(html).toContain('Registro (BORME)');
    expect(html).toContain('&lt;b&gt;ojo&lt;/b&gt;');
    expect(html).toContain('class="who">Nota del autor');
    expect(html).toContain('2024-03-11');
  });

  it('an author-source chapter suppresses the body and shows the note under "Nota del autor"', () => {
    const authorStep = step('n', { source: 'author', flag: 'amber', text: 'Ojo con esto.', authorNote: null });
    const html = renderChapters({ ...doc, steps: [authorStep] }, t, wt);
    expect(html).toContain('<span class="src">Autor</span>');
    expect(html).not.toContain('<p>Ojo con esto.</p>');
    expect(html).toContain('class="who">Nota del autor');
    expect(html).toContain('Ojo con esto.');
  });

  it('renders the evidence line when a step carries one', () => {
    const withEvidence = step('e', { evidence: { kind: 'officer', ref: 'X123' } });
    const html = renderChapters({ ...doc, steps: [withEvidence] }, t, wt);
    expect(html).toContain('Evidencia: officer · X123');
  });

  it('annexes render only sections with rows', () => {
    const html = renderAnnexes(doc, t);
    expect(html).toContain('id="annexes"');
    expect(html).toContain('ALFA SL');
    expect(html).not.toContain('id="corrections"');
  });

  it('footer carries source, coverage and the site link only', () => {
    const html = renderFooter(doc, t, 'es');
    expect(html).toContain('2009');
    expect(html).toContain('2026-09-11');
    expect(html).toContain('12 de septiembre de 2026');
    // The bare-prefix pattern /https?:\/\// can never equal a full URL string;
    // match the whole href (up to the closing quote) to actually verify it.
    expect(html.match(/https?:\/\/[^"']+/g)).toEqual(['https://mapasocietario.es']);
  });

  describe('section numbering across the summary x steps combinations', () => {
    const graphData = { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2 }], links: [] };
    const numOf = html => {
      const m = html.match(/<span class="num">(\d+)<\/span>/);
      return m ? Number(m[1]) : null;
    };

    const cases = [
      { name: 'summary and steps both present', networkNote: 'Lo que vi', steps: doc.steps, summary: 1, map: 2, chapters: 3, annexes: 4 },
      { name: 'no summary', networkNote: '', steps: doc.steps, summary: null, map: 1, chapters: 2, annexes: 3 },
      { name: 'no steps', networkNote: 'Lo que vi', steps: [], summary: 1, map: 2, chapters: null, annexes: 3 },
      { name: 'neither summary nor steps', networkNote: '', steps: [], summary: null, map: 1, chapters: null, annexes: 2 },
    ];

    cases.forEach(c => {
      it(`numbers 1..N in reading order when ${c.name}`, () => {
        const d = { ...doc, networkNote: c.networkNote, steps: c.steps };

        expect(numOf(renderSummary(d, t))).toBe(c.summary);
        expect(numOf(renderMapFigure(d, graphData, t))).toBe(c.map);
        expect(numOf(renderChapters(d, t, wt))).toBe(c.chapters);
        expect(numOf(renderAnnexes(d, t))).toBe(c.annexes);

        // The contents nav must assign the same numbers, in the same order.
        const contentsNums = [...renderContents(d, t).matchAll(/<b>(\d+)<\/b>/g)].map(m => Number(m[1]));
        expect(contentsNums).toEqual([c.summary, c.map, c.chapters, c.annexes].filter(n => n != null));
      });
    });
  });
});
