import { describe, expect, it } from 'vitest';
import { exportCopy } from './exportCopy';
import { walkthroughCopy } from '../walkthrough/walkthroughCopy';
import {
  renderCover, renderContents, renderSummary, renderMapFigure, renderChapters, renderAnnexes, renderFooter,
  renderStory, annexRows, stepEvidenceLine,
} from './documentSections';

const t = exportCopy('es');
const wt = walkthroughCopy('es');

const companyEvidence = (over = {}) => ({
  identity: 'NIF B12345678 · Hoja M-12345',
  status: { dissolved: false, concurso: false, lastFiling: null },
  capital: '3.000 €',
  activity: 'Comercio al por menor',
  board: [{
    name: 'GARCIA LOPEZ ANA', role: 'Administrador', since: '2020-01-01', status: 'active',
  }],
  filings: [{ date: '2024-03-11', type: 'Reducción de capital' }],
  findings: [{ text: 'Cambio de domicilio social reciente', date: '2024-03-11', cls: 'context' }],
  unseen: ['El registro no muestra el capital pendiente de desembolso.'],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  ...over,
});

const companyStep = (key, extra = {}) => ({
  key,
  nodeId: key,
  kind: 'company',
  order: 0,
  title: 'ALFA SL',
  narrative: null,
  authorNote: null,
  evidence: companyEvidence(),
  summary: 'NIF B12345678',
  text: 'NIF B12345678',
  nodeIds: [key],
  linkKeys: [],
  section: 'company',
  source: 'registry',
  date: null,
  flag: null,
  deepLink: '',
  ...extra,
});

const personStep = (key, extra = {}) => ({
  key,
  nodeId: key,
  kind: 'person',
  order: 1,
  title: 'GARCIA LOPEZ ANA',
  narrative: null,
  authorNote: null,
  evidence: {
    seats: [
      {
        company: 'ALFA SL', companyId: 'c1', role: 'Administrador', since: '2020-01-01', until: '', status: 'active',
      },
    ],
  },
  summary: '1 cargo en 1 empresa',
  text: '1 cargo en 1 empresa',
  nodeIds: [key, 'c1'],
  linkKeys: [],
  section: 'person',
  source: 'graph',
  date: null,
  flag: null,
  deepLink: '',
  ...extra,
});

const doc = {
  subject: 'ALFA SL',
  generatedAt: '2026-09-12T09:00:00.000Z',
  networkNote: 'Lo que vi',
  author: { name: 'Ana', organisation: 'NC' },
  coverage: { since: '2009-01-01', indexedThrough: '2026-09-11' },
  steps: [companyStep('c1'), personStep('o1')],
  flagged: [],
  // Deliberately NOT one of the step ids above, so this row stays an annex
  // (uncovered) in every combination the numbering tests exercise below.
  companies: [{ nodeId: 'other', name: 'OTRA SL', note: null }],
  connectors: [],
  ownership: [],
  otherNotes: [],
  corrections: [],
  counts: {
    companies: 1, officers: 3, sharedPeople: 0, notes: 1, flagged: 0,
  },
};

describe('documentSections', () => {
  it('cover shows the author line only when a field is set', () => {
    expect(renderCover(doc, t, 'es')).toContain('Elaborado por Ana · NC');
    expect(renderCover({ ...doc, author: { name: '', organisation: 'NC' } }, t, 'es')).toContain('Elaborado por NC');
    expect(renderCover({ ...doc, author: null }, t, 'es')).not.toContain('Elaborado por');
    expect(renderCover(doc, t, 'es')).not.toMatch(/logo|wordmark/i);
  });

  it('contents anchors every rendered section, lists chapters as sub-items and skips empty sections', () => {
    const html = renderContents(doc, t);
    expect(html).toContain('href="#summary"');
    expect(html).toContain('href="#walkthrough"');
    expect(html).toContain('href="#annexes"');
    expect(html).toContain('<a href="#ch-0" class="sub">01 ALFA SL</a>');
    expect(html).toContain('<a href="#ch-1" class="sub">02 GARCIA LOPEZ ANA</a>');
    expect(renderContents({ ...doc, networkNote: '' }, t)).not.toContain('href="#summary"');
  });

  it('summary is omitted when empty', () => {
    expect(renderSummary({ ...doc, networkNote: '' }, t)).toBe('');
    expect(renderSummary(doc, t)).toContain('<p class="lead">Lo que vi</p>');
  });

  it('map figure carries legend, caption counts and the panel the story fills, with no start button', () => {
    const html = renderMapFigure(doc, { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2 }], links: [] }, t);
    expect(html).toContain('id="map"');
    expect(html).toContain('class="legend"');
    expect(html).toContain('1 empresas · 3 personas · 0 conexiones compartidas');
    // The story starts on scroll: no start button, and the panel is present
    // from the first paint (the opening block fills it until a chapter enters).
    expect(html).not.toContain('id="wt-start"');
    expect(html).toContain('id="wt-panel"');
    expect(html).not.toMatch(/id="wt-panel"[^>]*hidden/);
  });

  it('moves the walkthrough panel out of the figure and adds the opening block and evidence line', () => {
    const html = renderMapFigure(doc, { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2 }], links: [] }, t);
    const figureEnd = html.indexOf('</figure>');
    const panelStart = html.indexOf('id="wt-panel"');
    expect(figureEnd).toBeGreaterThan(-1);
    expect(panelStart).toBeGreaterThan(figureEnd);
    expect(html).toContain('id="wt-opening"');
    expect(html).toContain('id="wt-open-title"');
    expect(html).toContain('id="wt-open-line"');
    expect(html).toContain('id="wt-ev"');
  });

  it('omits the walkthrough panel entirely when there are no steps', () => {
    const html = renderMapFigure({ ...doc, steps: [] }, { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2 }], links: [] }, t);
    expect(html).not.toContain('id="wt-start"');
    expect(html).not.toContain('id="wt-panel"');
  });

  it('rings a node on the map when its own step carries a red/amber narrative', () => {
    const flaggedStep = companyStep('c1', { narrative: { text: 'Cuidado', flag: 'amber' } });
    const html = renderMapFigure({ ...doc, steps: [flaggedStep] },
      { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2, userNote: { flag: 'amber', text: 'Cuidado' } }], links: [] }, t);
    expect(html).toContain('data-flag="amber"');
  });

  it('a company chapter renders the narrative before the evidence, and each evidence sub-block', () => {
    const withNarrative = companyStep('c1', { narrative: { text: '<b>ojo</b>', flag: 'amber' } });
    const html = renderChapters({ ...doc, steps: [withNarrative] }, t, wt);

    expect(html).toContain('id="ch-0"');
    expect(html).toContain('onclick="__sitrepShow(0)"');
    expect(html).toContain('<button type="button" class="num"');
    expect(html).toContain('Registro (BORME)');
    expect(html).toContain('Empresa');
    expect(html).toContain('&lt;b&gt;ojo&lt;/b&gt;');
    expect(html).toContain('class="who">Nota del autor');
    expect(html).toContain(withNarrative.evidence.identity);
    expect(html).toContain('Capital social: 3.000 €');
    expect(html).toContain('Actividad declarada: Comercio al por menor');
    expect(html).toContain('Órgano de administración');
    expect(html).toContain('GARCIA LOPEZ ANA');
    expect(html).toContain('Vigente');
    expect(html).toContain('Últimos actos');
    expect(html).toContain('2024-03-11');
    expect(html).toContain('Reducción de capital');
    expect(html).toContain('Lo que destaca');
    expect(html).toContain('Cambio de domicilio social reciente');
    expect(html).toContain('Lo que el registro no muestra');
    expect(html).toContain('El registro no muestra el capital pendiente de desembolso.');
    expect(html).toContain('es socio único de');

    // Narrative must precede the first evidence sub-heading.
    const noteIdx = html.indexOf('class="who">Nota del autor');
    const h4Idx = html.indexOf('<h4>');
    expect(noteIdx).toBeGreaterThan(-1);
    expect(h4Idx).toBeGreaterThan(noteIdx);
  });

  it('renders status words for a dissolved / in-concurso company', () => {
    const dissolved = companyStep('c1', {
      evidence: companyEvidence({ status: { dissolved: true, concurso: true, lastFiling: null } }),
    });
    const html = renderChapters({ ...doc, steps: [dissolved] }, t, wt);
    expect(html).toContain('Disuelta');
    expect(html).toContain('En concurso');
  });

  it('omits a company chapter with no narrative from having a note block, but never a placeholder', () => {
    const html = renderChapters({ ...doc, steps: [companyStep('c1')] }, t, wt);
    expect(html).not.toContain('class="who">Nota del autor');
  });

  it('respects the board block toggle', () => {
    const withBoardOff = { ...doc, steps: [companyStep('c1')], blocks: { board: false } };
    const html = renderChapters(withBoardOff, t, wt);
    expect(html).not.toContain('Órgano de administración');
    expect(html).not.toContain('GARCIA LOPEZ ANA');
    // Other blocks stay on.
    expect(html).toContain('Últimos actos');
  });

  it('respects the filings and findings block toggles', () => {
    const off = { ...doc, steps: [companyStep('c1')], blocks: { filings: false, findings: false } };
    const html = renderChapters(off, t, wt);
    expect(html).not.toContain('Últimos actos');
    expect(html).not.toContain('Lo que destaca');
    // unseen and ownership always render regardless of blocks.
    expect(html).toContain('Lo que el registro no muestra');
    expect(html).toContain('es socio único de');
  });

  it('omits the identity block when the identity toggle is off', () => {
    const off = { ...doc, steps: [companyStep('c1')], blocks: { identity: false } };
    const html = renderChapters(off, t, wt);
    expect(html).not.toContain(companyStep('c1').evidence.identity);
    expect(html).not.toContain('Capital social');
  });

  it('a person chapter renders the seats table', () => {
    const html = renderChapters({ ...doc, steps: [personStep('o1')] }, t, wt);
    expect(html).toContain('Persona');
    expect(html).toContain('Cargos en las empresas del mapa');
    expect(html).toContain('ALFA SL');
    expect(html).toContain('Administrador');
    expect(html).toContain('Vigente');
  });

  it('escapes a hostile narrative and a hostile board name', () => {
    const hostile = companyStep('c1', {
      narrative: { text: '<img src=x onerror=alert(1)>', flag: 'red' },
      evidence: companyEvidence({ board: [{
        name: '<script>alert(2)</script>', role: 'Administrador', since: '2020-01-01', status: 'active',
      }] }),
    });
    const html = renderChapters({ ...doc, steps: [hostile] }, t, wt);
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });

  it('annexRows excludes companies and connectors already covered by a chapter, and ownership rows already inside one', () => {
    const richDoc = {
      ...doc,
      companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }, { nodeId: 'c2', name: 'BETA SL', note: null }],
      connectors: [{
        nodeId: 'o1', name: 'GARCIA LOPEZ ANA', type: 'individual', companies: ['ALFA SL'], roles: ['Administrador'], status: 'active',
      }, {
        nodeId: 'o2', name: 'RUIZ MARTIN LUIS', type: 'individual', companies: ['BETA SL'], roles: ['Apoderado'], status: 'active',
      }],
      ownership: [
        { owner: 'ALFA SL', owned: 'BETA SL', lost: false },
        { owner: 'GAMMA SL', owned: 'DELTA SL', lost: false },
      ],
    };
    const rows = annexRows(richDoc);
    expect(rows.companies.map(c => c.nodeId)).toEqual(['c2']);
    expect(rows.connectors.map(c => c.nodeId)).toEqual(['o2']);
    expect(rows.ownership).toEqual([{ owner: 'GAMMA SL', owned: 'DELTA SL', lost: false }]);
  });

  it('keeps a company in the annex, note and all, when it is only a seat inside a person chapter (not itself a chapter)', () => {
    // o1's person step here has c2 among its nodeIds/seats — being pictured
    // in that seats table must NOT retire c2's own annex row.
    const richDoc = {
      ...doc,
      steps: [personStep('o1', {
        nodeIds: ['o1', 'c2'],
        evidence: { seats: [{
          company: 'BETA SL', companyId: 'c2', role: 'Apoderado', since: '2020-01-01', until: '', status: 'active',
        }] },
      })],
      companies: [{ nodeId: 'c2', name: 'BETA SL', note: { text: 'Same registered address', flag: 'amber' } }],
    };
    const rows = annexRows(richDoc);
    expect(rows.companies.map(c => c.nodeId)).toEqual(['c2']);
    expect(renderAnnexes(richDoc, t)).toContain('Same registered address');
  });

  it('keeps an ownership row in the annex when owner/owned only match a PERSON chapter title, never a company one', () => {
    const richDoc = {
      ...doc,
      steps: [personStep('o1')], // title 'GARCIA LOPEZ ANA'
      companies: [],
      connectors: [],
      ownership: [{ owner: 'GARCIA LOPEZ ANA', owned: 'BETA SL', lost: false }],
    };
    const rows = annexRows(richDoc);
    expect(rows.ownership).toEqual([{ owner: 'GARCIA LOPEZ ANA', owned: 'BETA SL', lost: false }]);
  });

  it('renderAnnexes returns an empty string when every annex would be empty', () => {
    const covered = {
      ...doc,
      companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }],
      connectors: [],
      ownership: [],
      corrections: [],
    };
    expect(renderAnnexes(covered, t)).toBe('');
  });

  it('annexes render only sections with rows', () => {
    const html = renderAnnexes(doc, t);
    expect(html).toContain('id="annexes"');
    expect(html).toContain('OTRA SL');
    expect(html).not.toContain('id="corrections"');
  });

  it('omits the connections annex entirely when there are no connectors, with no "none detected" fallback', () => {
    const html = renderAnnexes(doc, t);
    expect(html).not.toContain('id="connections"');
    expect(html).not.toContain(t.none);
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

  describe('stepEvidenceLine', () => {
    it('company: uses the first finding text when present', () => {
      expect(stepEvidenceLine(companyStep('c1'), wt)).toBe('Cambio de domicilio social reciente');
    });

    it('company: falls back to the last filing when there are no findings', () => {
      const noFindings = companyStep('c1', {
        evidence: companyEvidence({ findings: [], status: { dissolved: false, concurso: false, lastFiling: { date: '2024-03-11', type: 'Reducción de capital' } } }),
      });
      expect(stepEvidenceLine(noFindings, wt)).toBe('Últimos actos: 2024-03-11 · Reducción de capital');
    });

    it('company: empty string when neither findings nor last filing exist', () => {
      const bare = companyStep('c1', { evidence: companyEvidence({ findings: [], status: { dissolved: false, concurso: false, lastFiling: null } }) });
      expect(stepEvidenceLine(bare, wt)).toBe('');
    });

    it('person: joins the first two seats as role · company', () => {
      const twoSeats = personStep('o1', {
        evidence: {
          seats: [
            {
              company: 'ALFA SL', companyId: 'c1', role: 'Administrador', since: '2020-01-01', until: '', status: 'active',
            },
            {
              company: 'BETA SL', companyId: 'c2', role: 'Apoderado', since: '2021-01-01', until: '', status: 'active',
            },
            {
              company: 'GAMMA SL', companyId: 'c3', role: 'Consejero', since: '2022-01-01', until: '', status: 'active',
            },
          ],
        },
      });
      expect(stepEvidenceLine(twoSeats, wt)).toBe('Administrador · ALFA SL · Apoderado · BETA SL');
    });
  });

  describe('section numbering across the summary x steps combinations', () => {
    const graphData = { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 1, y: 2 }], links: [] };
    const numOf = html => {
      const m = html.match(/<span class="num">(\d+)<\/span>/);
      return m ? Number(m[1]) : null;
    };

    const cases = [
      {
        name: 'summary and steps both present', networkNote: 'Lo que vi', steps: doc.steps, summary: 1, map: 2, chapters: 3, annexes: 4,
      },
      {
        name: 'no summary', networkNote: '', steps: doc.steps, summary: null, map: 1, chapters: 2, annexes: 3,
      },
      {
        name: 'no steps', networkNote: 'Lo que vi', steps: [], summary: 1, map: 2, chapters: null, annexes: 3,
      },
      {
        name: 'neither summary nor steps', networkNote: '', steps: [], summary: null, map: 1, chapters: null, annexes: 2,
      },
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

    it('numbers correctly when there are no annexes at all', () => {
      const d = {
        ...doc, networkNote: 'Lo que vi', steps: doc.steps, companies: [], connectors: [], ownership: [], corrections: [],
      };

      expect(numOf(renderSummary(d, t))).toBe(1);
      expect(numOf(renderMapFigure(d, graphData, t))).toBe(2);
      expect(numOf(renderChapters(d, t, wt))).toBe(3);
      expect(renderAnnexes(d, t)).toBe('');

      const contentsNums = [...renderContents(d, t).matchAll(/<b>(\d+)<\/b>/g)].map(m => Number(m[1]));
      expect(contentsNums).toEqual([1, 2, 3]);
      expect(renderContents(d, t)).not.toContain('href="#annexes"');
    });
  });
});

describe('renderStory', () => {
  const graphData = { nodes: [{ id: 'c1', type: 'company', name: 'ALFA SL', x: 0, y: 0 }], links: [] };
  const timeline = { dates: ['2024-03-11', '2026-09-13'], nodes: {}, links: {}, undated: 2, readOn: '2026-09-13' };
  const storyDoc = { steps: [companyStep('c1', { moment: '2024-03-11' })], counts: {}, timeline };

  it('renders the grid with the map pane and the chapters once each', () => {
    const html = renderStory(storyDoc, graphData, t, wt);
    expect(html.match(/id="story"/g)).toHaveLength(1);
    expect(html.match(/id="graph"/g)).toHaveLength(1);
    expect(html.match(/id="walkthrough"/g)).toHaveLength(1);
    expect(html.match(/<svg id="map"/g)).toHaveLength(1);
  });

  it('chapters carry their index and moment, and show the moment in the head', () => {
    const html = renderStory(storyDoc, graphData, t, wt);
    expect(html).toContain('data-i="0"');
    expect(html).toContain('data-moment="2024-03-11"');
    expect(html).toContain('11 de marzo de 2024');
  });

  it('renders the slider with one tick per chapter moment and the undated caption', () => {
    const html = renderStory(storyDoc, graphData, t, wt);
    expect(html).toContain('id="wt-slider"');
    expect(html).toContain('max="1"');
    expect(html).toContain('<option value="0"');
    expect(html).toContain(t.undated(2));
  });

  it('says which day the slider stands on, for label and value alike', () => {
    const html = renderStory(storyDoc, graphData, t, wt);
    const asOf = t.registryAsOf('13 de septiembre de 2026');
    expect(html).toContain(`aria-label="${asOf}"`);
    expect(html).toContain(`aria-valuetext="${asOf}"`);
    expect(html).not.toContain(`aria-label="${t.registryAsOf('')}"`);
  });

  it('keeps the undated span but drops its separator when nothing is undated', () => {
    const html = renderStory({ ...storyDoc, timeline: { ...timeline, undated: 0 } }, graphData, t, wt);
    expect(html).toContain('<span id="wt-undated"></span>');
    expect(html).not.toMatch(/<\/span> · <span id="wt-undated">/);
    expect(html).not.toMatch(/<span id="wt-date">[^<]*<\/span> · /);
  });

  it('emits one tick per distinct moment when two chapters share one', () => {
    const shared = {
      ...storyDoc,
      steps: [companyStep('c1', { moment: '2024-03-11' }), companyStep('c2', { moment: '2024-03-11' })],
    };
    const html = renderStory(shared, graphData, t, wt);
    expect(html.match(/<option value="0">/g)).toHaveLength(1);
  });

  it('omits the slider when the domain has fewer than two dates', () => {
    const html = renderStory({ ...storyDoc, timeline: { ...timeline, dates: ['2026-09-13'] } }, graphData, t, wt);
    expect(html).not.toContain('id="wt-slider"');
  });

  it('renders only the map pane when there are no steps', () => {
    const html = renderStory({ steps: [], counts: {}, timeline }, graphData, t, wt);
    expect(html).toContain('id="graph"');
    expect(html).not.toContain('id="walkthrough"');
  });
});

describe('renderAnnexes explorer', () => {
  const base = {
    steps: [],
    companies: [{ nodeId: 'x', name: 'GAMMA SL', note: null }],
    connectors: [{
      nodeId: 'p', name: 'PEREZ RUIZ JUAN', type: 'individual', companies: ['GAMMA SL'], roles: ['Apoderado'], status: 'active',
    }],
    ownership: [],
    corrections: [],
  };

  it('wraps two or more non-empty annexes in a tab strip, first selected, every panel present', () => {
    const html = renderAnnexes(base, t);
    expect(html).toContain(t.explorer);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('aria-selected="true"');
    expect(html.match(/role="tabpanel"/g)).toHaveLength(2);
    expect(html).toContain('id="companies"');
    expect(html).toContain('id="connections"');
  });

  it('renders no tab strip when only one annex has rows', () => {
    const html = renderAnnexes({ ...base, connectors: [] }, t);
    expect(html).not.toContain('role="tab"');
    expect(html).toContain('id="companies"');
  });
});

describe('renderFooter return links', () => {
  const docWithKeys = {
    generatedAt: '2026-09-13T10:00:00.000Z',
    companies: [
      { nodeId: 'a', name: 'ALFA SL', groupKey: 'H:M-1234', note: null },
      { nodeId: 'b', name: 'BETA SL', groupKey: null, note: null },
    ],
    coverage: null,
  };

  it('links back with one c= per keyed company, since and source', () => {
    const html = renderFooter(docWithKeys, t, 'es');
    expect(html).toContain('c=H%3AM-1234%7CALFA+SL');
    expect(html).not.toContain('BETA');
    expect(html).toContain('since=2026-09-13');
    expect(html).toContain('source=sitrep');
    expect(html).toContain('watch=1');
    expect(html).toContain(t.watchLink);
  });

  it('renders no return links when no company has a key', () => {
    const html = renderFooter({ ...docWithKeys, companies: [docWithKeys.companies[1]] }, t, 'es');
    expect(html).not.toContain('since=');
    expect(html).not.toContain(t.watchLink);
  });

  it('omits a company whose key is a hash duplicate, not an entity key', () => {
    const html = renderFooter({
      ...docWithKeys,
      companies: [...docWithKeys.companies, { nodeId: 'h', name: 'HASHED SL', groupKey: '2b3200b6c9d4e1f0', note: null }],
    }, t, 'es');
    expect(html).toContain('c=H%3AM-1234%7CALFA+SL');
    expect(html).not.toContain('HASHED');
    expect(html).not.toContain('2b3200b6c9d4e1f0');
  });

  it('emits at most the twelve companies the app will read back, in document order', () => {
    const companies = Array.from({ length: 14 }, (_, i) => ({
      nodeId: `n${i}`, name: `CO${i} SL`, groupKey: `H:M-${100 + i}`, note: null,
    }));
    const html = renderFooter({ ...docWithKeys, companies }, t, 'es');
    // Two links (return + watch), twelve companies each.
    expect((html.match(/c=H%3AM-/g) || []).length).toBe(2 * 12);
    expect(html).toContain('CO11+SL');
    expect(html).not.toContain('CO12+SL');
    expect(html).not.toContain('CO13+SL');
  });

  it('renders no return links when the document carries no usable generated day', () => {
    [null, '', 'not a date'].forEach(generatedAt => {
      const html = renderFooter({ ...docWithKeys, generatedAt }, t, 'es');
      expect(html).not.toContain('since=');
      expect(html).not.toContain(t.watchLink);
    });
  });
});

describe('renderChapters — unified company step', () => {
  it('renders the seats table under the company evidence and the unified eyebrow', () => {
    const seats = [{ company: 'BETA SL', companyId: 'H:2', role: 'Administrador único', since: '2020-01-01', until: '', status: 'active' }];
    const unified = companyStep('H:1', { unified: true, evidence: companyEvidence({ seats }) });
    const html = renderChapters({ ...doc, steps: [unified] }, t, wt);
    expect(html).toContain('Empresa y cargo');
    expect(html).toContain('Cargos en las empresas del mapa');
    expect(html).toContain('BETA SL');
  });

  it('a plain company chapter has no seats table', () => {
    const html = renderChapters({ ...doc, steps: [companyStep('H:1')] }, t, wt);
    expect(html).not.toContain('Cargos en las empresas del mapa');
  });
});
