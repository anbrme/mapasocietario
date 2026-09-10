import { describe, expect, it } from 'vitest';
import { buildInvestigationDoc } from './investigationDoc';

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
    expect(doc.counts).toEqual({ companies: 2, officers: 2, sharedPeople: 1, notes: 3, flagged: 2 });
  });

  it('does not mutate its inputs', () => {
    const frozenGraphData = JSON.parse(JSON.stringify(graphData));
    const frozenScope = JSON.parse(JSON.stringify(scope));
    const frozenCorrections = JSON.parse(JSON.stringify([]));

    build({ corrections: [] });

    expect(graphData).toEqual(frozenGraphData);
    expect(scope).toEqual(frozenScope);
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
});
