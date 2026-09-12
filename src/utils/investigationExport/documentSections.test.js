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

  it('annexes render only sections with rows', () => {
    const html = renderAnnexes(doc, t);
    expect(html).toContain('id="annexes"');
    expect(html).toContain('ALFA SL');
    expect(html).not.toContain('id="corrections"');
  });

  it('footer carries source, coverage and the site link only', () => {
    const html = renderFooter(doc, t);
    expect(html).toContain('2009');
    expect(html).toContain('2026-09-11');
    // The bare-prefix pattern /https?:\/\// can never equal a full URL string;
    // match the whole href (up to the closing quote) to actually verify it.
    expect(html.match(/https?:\/\/[^"']+/g)).toEqual(['https://mapasocietario.es']);
  });
});
