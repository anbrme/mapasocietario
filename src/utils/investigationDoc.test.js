import { describe, expect, it } from 'vitest';
import { buildInvestigationDoc, REPORT_TITLE_MAX_LENGTH } from './investigationDoc';
import { collectAuthorLayer, visibleWithoutDismissed } from './authorLayer';
import { hasAnnexes } from './sitrepModel';

const AT = '2026-09-10T09:00:00.000Z';

// c1/c2 are subject companies; o1 bridges them (a connector); o2 sits at c1
// only, so the relationship rule drops it — but it carries a note, so the
// document must still surface it.
const graphData = {
  nodes: [
    { id: 'c1', type: 'company', name: 'ALFA SL', userNote: { text: 'Same address as BETA', flag: 'red', updatedAt: AT } },
    { id: 'c2', type: 'company', name: 'BETA SL' },
    { id: 'o1', type: 'officer', name: 'GARCIA LOPEZ ANA', userNote: { text: 'Signs for both', flag: 'amber', updatedAt: AT } },
    { id: 'o2', type: 'officer', name: 'RUIZ MARTIN LUIS', userNote: { text: 'Resigned days before the filing', flag: 'blue', updatedAt: AT } },
  ],
  links: [],
};

const scope = {
  companies: ['ALFA SL', 'BETA SL'],
  companyNodes: [{ name: 'ALFA SL', nodeId: 'c1' }, { name: 'BETA SL', nodeId: 'c2' }],
  connectors: [{ name: 'GARCIA LOPEZ ANA', nodeId: 'o1', type: 'individual', companies: ['ALFA SL', 'BETA SL'], roles: ['Administrador'], status: 'active' }],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  officersByCompany: { 'ALFA SL': ['GARCIA LOPEZ ANA', 'RUIZ MARTIN LUIS'], 'BETA SL': ['GARCIA LOPEZ ANA'] },
  counts: { companies: 2, officers: 2, sharedPeople: 1 },
};

const build = (over = {}) => buildInvestigationDoc({
  graphData, scope, networkNote: '', corrections: [],
  primarySubject: 'ALFA SL', generatedAt: AT, ...over,
});

describe('buildInvestigationDoc', () => {
  it('surfaces a noted node the relationship rule dropped, under otherNotes', () => {
    const doc = build();

    expect(doc.otherNotes).toEqual([{
      nodeId: 'o2', name: 'RUIZ MARTIN LUIS', type: 'officer',
      flag: 'blue', text: 'Resigned days before the filing',
    }]);
  });

  it('lists red before amber in flagged and excludes other flags', () => {
    const doc = build();

    expect(doc.flagged.map(f => [f.flag, f.nodeId]))
      .toEqual([['red', 'c1'], ['amber', 'o1']]);
  });

  it('omits flagged entirely when nothing is flagged red or amber', () => {
    const unflagged = {
      ...graphData,
      nodes: graphData.nodes.map(n => (
        n.userNote ? { ...n, userNote: { ...n.userNote, flag: 'green' } } : n
      )),
    };
    const doc = build({ graphData: unflagged });

    expect(doc.flagged).toEqual([]);
    expect(doc.counts.flagged).toBe(0);
  });

  it('attaches each note to its company and connector by node id', () => {
    const doc = build();

    expect(doc.companies[0].note.text).toBe('Same address as BETA');
    expect(doc.companies[1].note).toBeNull();
    expect(doc.connectors[0].note.text).toBe('Signs for both');
  });

  it('never double-reports a note that already appears on a company or connector', () => {
    const doc = build();
    const otherIds = doc.otherNotes.map(n => n.nodeId);

    expect(otherIds).not.toContain('c1');
    expect(otherIds).not.toContain('o1');
  });

  it('does not double-report a flagged node that is neither a company nor a connector', () => {
    // o2 carries a 'blue' note in the base fixture, which never exercises this
    // path (only red/amber land in `flagged`). Bump it to 'red' here so it is
    // both flagged AND absent from companies/connectors — the overlap case.
    const withFlaggedOutsider = {
      ...graphData,
      nodes: graphData.nodes.map(n => (
        n.id === 'o2' ? { ...n, userNote: { ...n.userNote, flag: 'red' } } : n
      )),
    };
    const doc = build({ graphData: withFlaggedOutsider });

    expect(doc.flagged.map(f => f.nodeId)).toContain('o2');
    expect(doc.otherNotes.map(n => n.nodeId)).not.toContain('o2');
  });

  it('ignores notes whose text is blank', () => {
    const blank = {
      ...graphData,
      nodes: [...graphData.nodes, { id: 'o3', type: 'officer', name: 'EMPTY', userNote: { text: '   ', flag: 'red' } }],
    };
    const doc = build({ graphData: blank });

    expect(doc.otherNotes.map(n => n.nodeId)).not.toContain('o3');
    expect(doc.flagged.map(f => f.nodeId)).not.toContain('o3');
  });

  it('carries the network note, subject, corrections and counts through', () => {
    const doc = build({
      networkNote: '  Checking a suspected common controller.  ',
      corrections: [{ action: 'merge', name_a: 'GARCIA LOPEZ, ANA', name_b: 'GARCIA LOPEZ ANA' }],
    });

    expect(doc.networkNote).toBe('Checking a suspected common controller.');
    expect(doc.subject).toBe('ALFA SL');
    expect(doc.generatedAt).toBe(AT);
    expect(doc.corrections).toEqual([
      { action: 'merge', nameA: 'GARCIA LOPEZ, ANA', nameB: 'GARCIA LOPEZ ANA', resignedDate: '' },
    ]);
    expect(doc.counts).toEqual({
      companies: 2, officers: 2, sharedPeople: 1, notes: 3, flagged: 2, authorElements: 0,
    });
  });

  it('does not mutate its inputs', () => {
    const testCorrections = [{ action: 'merge', name_a: 'GARCIA LOPEZ, ANA', name_b: 'GARCIA LOPEZ ANA' }];
    const frozenGraphData = JSON.parse(JSON.stringify(graphData));
    const frozenScope = JSON.parse(JSON.stringify(scope));
    const frozenCorrections = JSON.parse(JSON.stringify(testCorrections));

    build({ corrections: testCorrections });

    expect(graphData).toEqual(frozenGraphData);
    expect(scope).toEqual(frozenScope);
    expect(testCorrections).toEqual(frozenCorrections);
  });

  it('returns document with no shared mutable structure with scope', () => {
    const doc = build();

    // Mutate the returned document's ownership
    if (doc.ownership.length > 0) {
      doc.ownership[0].owner = 'MUTATED';
    }
    // Mutate the returned document's connector arrays
    if (doc.connectors.length > 0) {
      doc.connectors[0].companies.push('FAKE');
      doc.connectors[0].roles.push('FAKE');
    }

    // Original scope must be unchanged
    expect(scope.ownership[0].owner).toBe('ALFA SL');
    expect(scope.connectors[0].companies).toEqual(['ALFA SL', 'BETA SL']);
    expect(scope.connectors[0].roles).toEqual(['Administrador']);
  });

  it('carries officersByCompany through, as a copy independent of scope', () => {
    const doc = build();

    expect(doc.officersByCompany).toEqual({
      'ALFA SL': ['GARCIA LOPEZ ANA', 'RUIZ MARTIN LUIS'],
      'BETA SL': ['GARCIA LOPEZ ANA'],
    });

    // Mutating the returned document must never reach the scope it was built
    // from — same purity guarantee as ownership/connectors above, extended to
    // this nested object-of-arrays shape.
    doc.officersByCompany['ALFA SL'].push('FAKE');
    doc.officersByCompany['NEW CO'] = ['GHOST'];

    expect(scope.officersByCompany['ALFA SL']).toEqual(['GARCIA LOPEZ ANA', 'RUIZ MARTIN LUIS']);
    expect(scope.officersByCompany['NEW CO']).toBeUndefined();
  });

  it('defaults officersByCompany to an empty object when scope omits it', () => {
    const { officersByCompany, ...scopeWithoutOfficers } = scope;
    const doc = build({ scope: scopeWithoutOfficers });

    expect(doc.officersByCompany).toEqual({});
  });

  it('preserves extra fields in scope.counts', () => {
    const customScope = {
      ...scope,
      counts: { companies: 2, officers: 2, sharedPeople: 1, custom: 7 },
    };
    const doc = build({ scope: customScope });

    expect(doc.counts.custom).toBe(7);
    expect(doc.counts.notes).toBe(3);
    expect(doc.counts.flagged).toBe(2);
  });

  it('carries steps, author and coverage through untouched, defaulting to empty', () => {
    const base = build();
    expect(base.steps).toEqual([]);
    expect(base.author).toBeNull();
    expect(base.coverage).toBeNull();
    const steps = [{ key: 'k' }];
    const doc = build({ steps, author: { name: 'A', organisation: '' }, coverage: { since: '2009-01-01', indexedThrough: '2026-09-11' } });
    expect(doc.steps).toEqual(steps);
    expect(doc.steps).not.toBe(steps);
    expect(doc.author).toEqual({ name: 'A', organisation: '' });
  });

  it('defaults blocks to all-true, mode to null and opening to null', () => {
    const doc = build();

    expect(doc.blocks).toEqual({
      identity: true, board: true, filings: true, findings: true,
    });
    expect(doc.mode).toBeNull();
    expect(doc.opening).toBeNull();
  });

  it('merges a partial blocks override over the defaults, ignoring non-boolean values', () => {
    const doc = build({ blocks: { board: false, filings: 'nope', extra: true } });

    expect(doc.blocks).toEqual({
      identity: true, board: false, filings: true, findings: true,
    });
    expect(doc.blocks.extra).toBeUndefined();
  });

  it('passes mode through only when it is a known value', () => {
    expect(build({ mode: 'selection' }).mode).toBe('selection');
    expect(build({ mode: 'draft' }).mode).toBe('draft');
    expect(build({ mode: 'bogus' }).mode).toBeNull();
  });

  it('carries opening through when it has a title or line, else null', () => {
    expect(build({ opening: { title: 'Recorrido', line: '' } }).opening).toEqual({ title: 'Recorrido', line: '' });
    expect(build({ opening: { title: '', line: '' } }).opening).toBeNull();
    expect(build({ opening: null }).opening).toBeNull();
  });
});

describe('buildInvestigationDoc v3 fields', () => {
  const v3GraphData = { nodes: [{ id: 'H:1', type: 'spanish-company-group', name: 'ALFA SL', groupKey: 'gk-alfa' }], links: [] };
  const v3Scope = { companyNodes: [{ nodeId: 'H:1', name: 'ALFA SL' }], connectors: [], ownership: [], counts: { companies: 1, officers: 0, sharedPeople: 0 } };

  it('copies the timeline and stamps each company with its group key', () => {
    const timeline = { dates: ['2026-09-13'], nodes: {}, links: {}, undated: 0, readOn: '2026-09-13' };
    const doc = buildInvestigationDoc({ graphData: v3GraphData, scope: v3Scope, timeline });
    expect(doc.timeline).toEqual(timeline);
    expect(doc.timeline).not.toBe(timeline);
    expect(doc.companies[0].groupKey).toBe('gk-alfa');
  });
  it('a missing timeline is null, a company without a key gets null', () => {
    const doc = buildInvestigationDoc({ graphData: { nodes: [], links: [] }, scope: v3Scope });
    expect(doc.timeline).toBeNull();
    expect(doc.companies[0].groupKey).toBeNull();
  });
});

describe('report title', () => {
  it('an analyst-set title replaces the first subject as the document subject', () => {
    const doc = build({ title: 'Cartel of interests around ALFA' });
    expect(doc.subject).toBe('Cartel of interests around ALFA');
  });

  it('keeps the first subject reachable as defaultSubject for the placeholder', () => {
    const doc = build({ title: 'Cartel of interests around ALFA' });
    expect(doc.defaultSubject).toBe('ALFA SL');
  });

  it('a blank or whitespace title falls back to the first subject', () => {
    expect(build({ title: '' }).subject).toBe('ALFA SL');
    expect(build({ title: '   ' }).subject).toBe('ALFA SL');
    expect(build().subject).toBe('ALFA SL');
  });

  it('trims and caps the title', () => {
    const doc = build({ title: `  ${'x'.repeat(REPORT_TITLE_MAX_LENGTH + 20)}  ` });
    expect(doc.subject).toBe('x'.repeat(REPORT_TITLE_MAX_LENGTH));
  });

  it('a non-string title is tolerated', () => {
    expect(build({ title: null }).subject).toBe('ALFA SL');
    expect(build({ title: 42 }).subject).toBe('42');
  });
});

describe('author layer', () => {
  const emptyScope = { companyNodes: [], connectors: [], ownership: [], counts: { companies: 0, officers: 0, sharedPeople: 0 } };

  it('carries the author layer and counts it', () => {
    const p = { id: 'author-node-p', name: 'P', type: 'officer', subtype: 'individual', provenance: { by: 'author', citation: null, asserted: null, note: '', at: 'T', author: '' } };
    const c = { id: 'company-c', name: 'C', type: 'company' };
    const l = {
      id: 'author-link-1', source: 'author-node-p', target: 'company-c', type: 'author', category: 'author',
      relationship: 'Director', directed: false,
      provenance: { by: 'author', citation: null, asserted: null, note: '', at: 'T', author: '' },
    };
    const docWithAuthorLayer = buildInvestigationDoc({ graphData: { nodes: [p, c], links: [l] }, scope: emptyScope });

    expect(docWithAuthorLayer.authorLayer.links).toHaveLength(1);
    expect(docWithAuthorLayer.authorLayer.nodes[0].name).toBe('P');
    expect(docWithAuthorLayer.counts.authorElements).toBe(2);
    expect(hasAnnexes(docWithAuthorLayer)).toBe(true);
  });

  it('lists a dismissal the visible graph can no longer show', () => {
    // The caller hands the document the graph it is looking at, which is past
    // visibleWithoutDismissed — the dismissed link is simply not in it.
    const a = { id: 'company-a', name: 'A', type: 'company' };
    const b = { id: 'company-b', name: 'B', type: 'company' };
    const dismissed = {
      id: 'l1', source: 'company-a', target: 'company-b', type: 'officer-company',
      relationship: 'Administrador',
      dismissed: { by: 'author', reason: 'Ceased in 2019', at: 'T' },
    };
    const full = { nodes: [a, b], links: [dismissed] };
    const visible = { ...full, links: visibleWithoutDismissed(full.links) };
    expect(visible.links).toHaveLength(0);

    const doc = buildInvestigationDoc({
      graphData: visible,
      scope: emptyScope,
      dismissedLinks: collectAuthorLayer(full).dismissed,
    });

    expect(doc.authorLayer.dismissed).toEqual([
      { from: 'A', to: 'B', relationship: 'Administrador', reason: 'Ceased in 2019', at: 'T' },
    ]);
    expect(doc.counts.authorElements).toBe(1);
  });

  it('lists a dismissal once when the caller passes the unfiltered graph as well', () => {
    const a = { id: 'company-a', name: 'A', type: 'company' };
    const b = { id: 'company-b', name: 'B', type: 'company' };
    const full = {
      nodes: [a, b],
      links: [{
        id: 'l1', source: 'company-a', target: 'company-b', type: 'officer-company',
        relationship: 'Administrador', dismissed: { by: 'author', reason: '', at: 'T' },
      }],
    };
    const doc = buildInvestigationDoc({
      graphData: full, scope: emptyScope, dismissedLinks: collectAuthorLayer(full).dismissed,
    });

    expect(doc.authorLayer.dismissed).toHaveLength(1);
    expect(doc.counts.authorElements).toBe(1);
  });

  it('counts zero and stays annex-empty when the graph carries no author elements', () => {
    const plainDoc = buildInvestigationDoc({ graphData: { nodes: [], links: [] }, scope: emptyScope });

    expect(plainDoc.counts.authorElements).toBe(0);
    expect(plainDoc.authorLayer).toEqual({
      nodes: [], links: [], dismissed: [], renamed: [],
    });
  });
});
