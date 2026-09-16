import { describe, it, expect } from 'vitest';
import { linkKey, graphKeys, diffExpansion, collapseExpansion } from './expansionCollapse';

// Expanding a node appends nodes and links; nothing recorded what it brought
// in, so nothing could take it back. These utilities record the diff and
// remove exactly that, sparing whatever the user or a later expansion claimed.

const node = (id, extra = {}) => ({ id, name: id, type: 'officer', ...extra });
const link = (source, target, extra = {}) => ({ source, target, ...extra });

const before = {
  nodes: [node('C1', { type: 'company' }), node('O1')],
  links: [link('O1', 'C1', { category: 'nombramiento' })],
};
// Expanding O1 brought C2, C3 and links O1→C2, O1→C3.
const after = {
  nodes: [...before.nodes, node('C2', { type: 'company' }), node('C3', { type: 'company' })],
  links: [...before.links, link('O1', 'C2', { category: 'nombramiento' }), link('O1', 'C3', { category: 'cese' })],
};

describe('linkKey', () => {
  it('is stable whether endpoints are ids or d3-mutated node objects', () => {
    const asIds = link('A', 'B', { category: 'x' });
    const asObjects = { source: { id: 'A' }, target: { id: 'B' }, category: 'x' };
    expect(linkKey(asIds)).toBe(linkKey(asObjects));
  });

  it('distinguishes two links between the same pair with different roles', () => {
    expect(linkKey(link('A', 'B', { category: 'nombramiento' })))
      .not.toBe(linkKey(link('A', 'B', { category: 'cese' })));
  });
});

describe('diffExpansion', () => {
  it('records the nodes and links the expansion added', () => {
    const record = diffExpansion('O1', graphKeys(before), after);
    expect(record.nodeId).toBe('O1');
    expect(record.addedNodeIds).toEqual(['C2', 'C3']);
    expect(record.addedLinkKeys).toEqual([
      linkKey(link('O1', 'C2', { category: 'nombramiento' })),
      linkKey(link('O1', 'C3', { category: 'cese' })),
    ]);
  });

  it('records nothing when the expansion added nothing', () => {
    const record = diffExpansion('O1', graphKeys(before), before);
    expect(record.addedNodeIds).toEqual([]);
    expect(record.addedLinkKeys).toEqual([]);
  });
});

describe('collapseExpansion', () => {
  const record = diffExpansion('O1', graphKeys(before), after);

  it('removes exactly what the expansion added', () => {
    const { graphData, removedNodeIds } = collapseExpansion(after, record);
    expect(graphData.nodes.map(n => n.id)).toEqual(['C1', 'O1']);
    expect(graphData.links.map(linkKey)).toEqual([linkKey(before.links[0])]);
    expect(removedNodeIds).toEqual(['C2', 'C3']);
  });

  it('keeps a node the user protected, and its link to the collapsed node', () => {
    const { graphData, removedNodeIds } = collapseExpansion(after, record, { protectedIds: new Set(['C3']) });
    expect(graphData.nodes.map(n => n.id)).toEqual(['C1', 'O1', 'C3']);
    expect(graphData.links.map(linkKey)).toContain(linkKey(link('O1', 'C3', { category: 'cese' })));
    expect(removedNodeIds).toEqual(['C2']);
  });

  it('keeps a node that a later expansion attached to', () => {
    // C2 was later expanded and brought O2: C2 now has a link this record never added.
    const later = {
      nodes: [...after.nodes, node('O2')],
      links: [...after.links, link('O2', 'C2', { category: 'nombramiento' })],
    };
    const { graphData, removedNodeIds } = collapseExpansion(later, record);
    expect(graphData.nodes.map(n => n.id)).toEqual(['C1', 'O1', 'C2', 'O2']);
    expect(removedNodeIds).toEqual(['C3']);
  });

  it('keeps a node the collapsed one shares with a pre-existing neighbour', () => {
    // C2 is ALSO linked to C1 by a link added in this expansion (a shared
    // seat surfaced by expanding O1) — still removable: nothing else claims it.
    // But if the link came from elsewhere it must stay.
    const shared = {
      nodes: after.nodes,
      links: [...after.links, link('C1', 'C2', { type: 'ownership' })],
    };
    const { graphData } = collapseExpansion(shared, record);
    expect(graphData.nodes.map(n => n.id)).toEqual(['C1', 'O1', 'C2']);
  });

  it('leaves surviving node objects identical so the canvas keeps its positions', () => {
    const { graphData } = collapseExpansion(after, record);
    expect(graphData.nodes[0]).toBe(after.nodes[0]);
    expect(graphData.nodes[1]).toBe(after.nodes[1]);
  });

  it('does not mutate the input graph', () => {
    const snapshot = JSON.stringify(after);
    collapseExpansion(after, record);
    expect(JSON.stringify(after)).toBe(snapshot);
  });

  it('tolerates a record for nodes already gone', () => {
    const { graphData, removedNodeIds } = collapseExpansion(before, record);
    expect(graphData.nodes.map(n => n.id)).toEqual(['C1', 'O1']);
    expect(removedNodeIds).toEqual([]);
  });
});
