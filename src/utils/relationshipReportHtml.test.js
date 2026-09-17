import { describe, expect, it } from 'vitest';
import { buildReportHtml } from './relationshipReportHtml';

const doc = {
  subject: 'ALFA SL',
  generatedAt: '2026-09-10T09:00:00.000Z',
  networkNote: 'Checking a suspected common controller.',
  flagged: [{ nodeId: 'c1', name: 'ALFA SL', type: 'company', flag: 'red', text: 'Same address as BETA' }],
  companies: [{ nodeId: 'c1', name: 'ALFA SL', note: { text: 'Same address as BETA', flag: 'red' } }],
  connectors: [{ name: 'GARCIA LOPEZ ANA', nodeId: 'o1', type: 'individual', companies: ['ALFA SL', 'BETA SL'], roles: ['Administrador'], status: 'active', note: null }],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  otherNotes: [{ nodeId: 'o2', name: 'RUIZ MARTIN LUIS', type: 'officer', flag: 'blue', text: 'Resigned days before the filing' }],
  corrections: [],
  counts: { companies: 2, officers: 2, sharedPeople: 1, notes: 2, flagged: 1 },
};

// One chapter of the walkthrough, as the report modal hands it over.
const step = {
  key: 'step:c1',
  nodeId: 'c1',
  nodeIds: ['c1'],
  kind: 'company',
  title: 'ALFA SL',
  source: 'registry',
  summary: 'NIF B12345678 · Hoja M-12345',
  moment: '2024-03-11',
  momentSource: 'draft',
  narrative: { text: 'Controlada desde Madrid', flag: 'amber' },
  authorNote: null,
  evidence: {
    status: { lastFiling: { date: '2024-03-11', type: 'Reducción de capital' } },
    findings: [{ text: 'Cambio de domicilio social', date: '2024-03-11', cls: 'context' }],
  },
  annotations: [
    { id: 'n1', date: '2019-06-30', text: 'Sale del consejo' },
    { id: 'n2', date: '2011-04-02', text: 'Entra como administrador' },
    { id: 'n3', date: '', text: 'todavía escribiendo' },
  ],
};

describe('buildReportHtml', () => {
  it('carries the network note, flagged findings and other notes', () => {
    const html = buildReportHtml(doc, { es: true });

    expect(html).toContain('Checking a suspected common controller.');
    expect(html).toContain('Same address as BETA');
    expect(html).toContain('Resigned days before the filing');
  });

  it('uses the settled name in both languages', () => {
    expect(buildReportHtml(doc, { es: true })).toContain('Informe de situación');
    expect(buildReportHtml(doc, { es: false })).toContain('Situation report');
  });

  it('escapes hostile note text', () => {
    const hostile = { ...doc, networkNote: '<script>alert(1)</script>' };
    const html = buildReportHtml(hostile, { es: true });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes hostile correction data', () => {
    const hostile = {
      ...doc,
      corrections: [{ nameA: '<img src=x onerror="alert(1)">', action: 'hide' }],
    };
    const html = buildReportHtml(hostile, { es: true });

    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img src=x onerror');
  });

  it('omits the flagged block when nothing is flagged', () => {
    const html = buildReportHtml({ ...doc, flagged: [] }, { es: true });

    expect(html).not.toContain('Señalado');
  });

  it('still renders a document with no notes at all', () => {
    const bare = { ...doc, networkNote: '', flagged: [], otherNotes: [], companies: [{ nodeId: 'c1', name: 'ALFA SL', note: null }] };

    expect(buildReportHtml(bare, { es: true })).toContain('ALFA SL');
  });

  it('renders corrections with verbs mapped from actions', () => {
    const withCorrections = {
      ...doc,
      corrections: [
        { nameA: 'GARCIA LOPEZ ANA', action: 'hide' },
        { nameA: 'OLD NAME', action: 'merge', nameB: 'NEW NAME' },
        { nameA: 'OFFICER X', action: 'mark_resigned', resignedDate: '2026-01-15' },
        { nameA: 'OFFICER Y', action: 'mark_active' },
      ],
    };
    const html = buildReportHtml(withCorrections, { es: true });

    expect(html).toContain('GARCIA LOPEZ ANA');
    expect(html).toContain('OLD NAME');
    expect(html).toContain('NEW NAME');
    expect(html).toContain('OFFICER X');
    expect(html).toContain('2026-01-15');
  });

  it('omits the corrections block when nothing is corrected', () => {
    const html = buildReportHtml({ ...doc, corrections: [] }, { es: true });

    expect(html).not.toContain('Correcciones');
  });

  it('renders the chapters: what each one is, when, and what the author wrote', () => {
    const html = buildReportHtml({ ...doc, steps: [step] }, { es: true });

    expect(html).toContain('<h3>Recorrido</h3>');
    expect(html).toContain('01 · ALFA SL');
    // Eyebrow: source, kind and the chapter's own date, spelled out.
    expect(html).toContain('Registro (BORME) · Empresa · 11 de marzo de 2024');
    expect(html).toContain('NIF B12345678');
    expect(html).toContain('Evidencia: Cambio de domicilio social');
    expect(html).toContain('Nota del autor: Controlada desde Madrid');
  });

  it('gives every dated note its own line in the chapter and in the chronology', () => {
    const html = buildReportHtml({ ...doc, steps: [step] }, { es: true });

    expect(html).toContain('<h3>Cronología</h3>');
    expect(html).toContain('<b>Notas fechadas</b>');
    expect(html).toContain('<b>30 de junio de 2019</b> — Sale del consejo');
    expect(html).toContain('<b>2 de abril de 2011</b> — Entra como administrador');
    // Oldest first, and the chapter's own moment sits among them by date.
    expect(html.indexOf('Entra como administrador')).toBeLessThan(html.indexOf('Sale del consejo'));
    // An unfinished note is not a date.
    expect(html).not.toContain('todavía escribiendo');
  });

  it('leaves the chronology out until two dates make a sequence', () => {
    const oneDate = { ...doc, steps: [{ ...step, annotations: [] }] };
    expect(buildReportHtml(oneDate, { es: true })).not.toContain('<h3>Cronología</h3>');
  });

  it('does not repeat in the annexes what a chapter already told', () => {
    // ALFA SL has its own chapter, so its annex row and its ownership line go.
    const html = buildReportHtml({ ...doc, steps: [step] }, { es: true });
    expect(html).not.toContain('<h3>Empresas analizadas</h3>');
    expect(html).not.toContain('es socio único de');
    // The connector was never a chapter: it keeps its row.
    expect(html).toContain('GARCIA LOPEZ ANA');
  });

  it('is unchanged for a report with no walkthrough at all', () => {
    const html = buildReportHtml(doc, { es: true });
    expect(html).not.toContain('<h3>Recorrido</h3>');
    expect(html).not.toContain('<h3>Cronología</h3>');
    expect(html).toContain('<h3>Empresas analizadas</h3>');
    expect(html).toContain('ALFA SL');
    expect(html).toContain('es socio único de');
  });

  it('escapes hostile chapter and dated-note text', () => {
    const hostile = {
      ...doc,
      steps: [{
        ...step,
        title: '<img src=x onerror="alert(1)">',
        annotations: [{ id: 'n1', date: '2019-06-30', text: '<script>alert(2)</script>' }],
      }],
    };
    const html = buildReportHtml(hostile, { es: true });

    expect(html).not.toContain('<img src=x onerror');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).toContain('&lt;img src=x onerror');
    expect(html).toContain('&lt;script&gt;');
  });

  describe('author layer', () => {
    const authorLayerDoc = {
      ...doc,
      counts: { ...doc.counts, authorElements: 1 },
      authorLayer: {
        nodes: [{
          nodeId: 'author-node-p', name: 'P', kind: 'person', country: 'ES', identifier: '',
          citation: null, note: '', at: '2026-09-17T00:00:00.000Z', author: '',
        }],
        links: [{
          from: 'P', fromId: 'author-node-p', to: 'ALFA SL', toId: 'c1', label: 'Director', directed: false,
          citation: { text: '', url: 'https://example.com/proof' }, asserted: '2026-09-01', note: '', at: '2026-09-17T00:00:00.000Z', author: '',
        }],
        dismissed: [{
          from: 'ALFA SL', to: 'BETA SL', relationship: 'Administrador', reason: 'wrong link', at: '2026-09-17T00:00:00.000Z',
        }],
        renamed: [{ nodeId: 'c1', name: 'ALFA SL NUEVO', registryName: 'ALFA SL' }],
      },
    };

    it('mirrors the annex: a header-bearing relationships table and an entities list', () => {
      const html = buildReportHtml(authorLayerDoc, { es: false });

      expect(html).toContain('Added by the author');
      expect(html).toContain('Relationships');
      expect(html).toContain('Entities');
      expect(html).toContain('Director');
      expect(html).toContain('href="https://example.com/proof"');
      expect(html).toContain('<th>From</th>');
      expect(html).toContain('<th>To</th>');
      expect(html).toContain('<th>Label</th>');
      expect(html).toContain('<th>Date</th>');
      expect(html).toContain('<th>Note</th>');
    });

    it('appends author dismissals and renames to the corrections list', () => {
      const html = buildReportHtml(authorLayerDoc, { es: false });

      expect(html).toContain('relationship dismissed');
      expect(html).toContain('wrong link');
      expect(html).toContain('renamed from');
      expect(html).toContain('ALFA SL NUEVO');
    });

    it('omits the author-layer block entirely when the layer is empty', () => {
      const html = buildReportHtml(doc, { es: false });
      expect(html).not.toContain('Added by the author');
    });

    it('marks an asserted hop in a connection chapter', () => {
      const connectionWithAuthorHop = {
        key: 'conn:o1', nodeId: null, kind: 'connection', order: 2, title: 'GARCIA LOPEZ ANA', source: 'graph',
        summary: 'ALFA SL and OTRA SL connect through GARCIA LOPEZ ANA', text: '',
        narrative: null, authorNote: null, moment: null, nodeIds: ['c1', 'other', 'o1'], linkKeys: [],
        evidence: {
          hops: [
            {
              who: 'GARCIA LOPEZ ANA', whoId: 'o1', at: 'ALFA SL', atId: 'c1', role: 'Sole director', status: 'active', since: '2021-03-01', until: '',
            },
            {
              who: 'GARCIA LOPEZ ANA', whoId: 'o1', at: 'OTRA SL', atId: 'other', role: 'Declared link', status: 'asserted', since: '', until: '', origin: 'author',
            },
          ],
        },
      };
      const html = buildReportHtml({ ...doc, steps: [connectionWithAuthorHop] }, { es: false });

      expect(html).toContain('(asserted)');
    });

    it('does not mark a connection chapter with no author hops', () => {
      const registryOnly = {
        key: 'conn:o1', nodeId: null, kind: 'connection', order: 2, title: 'GARCIA LOPEZ ANA', source: 'graph',
        summary: 'x', text: '',
        narrative: null, authorNote: null, moment: null, nodeIds: ['c1', 'other', 'o1'], linkKeys: [],
        evidence: {
          hops: [{
            who: 'GARCIA LOPEZ ANA', whoId: 'o1', at: 'ALFA SL', atId: 'c1', role: 'Sole director', status: 'active', since: '2021-03-01', until: '',
          }],
        },
      };
      const html = buildReportHtml({ ...doc, steps: [registryOnly] }, { es: false });

      expect(html).not.toContain('(asserted)');
    });

    it('never emits an href for a javascript: url citation, printing it as escaped text instead', () => {
      const hostile = {
        ...doc,
        authorLayer: {
          nodes: [],
          dismissed: [],
          renamed: [],
          links: [{
            from: 'A', fromId: 'a', to: 'B', toId: 'b', label: 'L', directed: false,
            citation: { text: '', url: 'javascript:alert(1)' }, asserted: null, note: '', at: 'T', author: '',
          }],
        },
      };
      const html = buildReportHtml(hostile, { es: false });

      expect(html).not.toContain('href="javascript');
      expect(html).toContain('javascript:alert(1)');
    });

    it("lists a chapter's own author-added links, but not a connection chapter that touches none", () => {
      const connectionStep = {
        key: 'conn:o1',
        nodeId: null,
        kind: 'connection',
        order: 2,
        title: 'GARCIA LOPEZ ANA',
        source: 'graph',
        summary: 'x',
        text: '',
        narrative: null,
        authorNote: null,
        moment: null,
        nodeIds: ['c1', 'other', 'o1'],
        linkKeys: [],
        evidence: { hops: [] },
      };
      // step's nodeId is 'c1', which authorLayerDoc's one link touches (toId: 'c1').
      const html = buildReportHtml({ ...authorLayerDoc, steps: [step, connectionStep] }, { es: false });

      const companyChapterHtml = html.slice(html.indexOf('01 ·'), html.indexOf('02 ·'));
      expect(companyChapterHtml).toContain('Added by the author');
      expect(companyChapterHtml).toContain('Director');

      // Bounded to the chapters section only — the document-level annex
      // further down legitimately carries its own "Added by the author"
      // heading, which must not leak into this assertion.
      const connectionChapterHtml = html.slice(html.indexOf('02 ·'), html.indexOf('<h3>Shared connections'));
      expect(connectionChapterHtml).not.toContain('Added by the author');
    });
  });

  it('speaks English when the report does', () => {
    const html = buildReportHtml({ ...doc, steps: [step] }, { es: false });

    expect(html).toContain('<h3>Walkthrough</h3>');
    expect(html).toContain('<h3>Chronology</h3>');
    expect(html).toContain('Dated notes');
    expect(html).toContain('30 June 2019');
  });
});
