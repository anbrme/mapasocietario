import { describe, it, expect } from 'vitest';
import { captureMergeSnapshot, restoreMergeSnapshot } from './mergeUndo';

const makeGraph = () => ({
  nodes: [
    { id: 'off-a', type: 'officer', name: 'GARCIA LOPEZ ANA', userNote: { text: 'source note' } },
    { id: 'off-b', type: 'officer', name: 'GARCIA LOPEZ ANA MARIA' },
    { id: 'co-1', type: 'company', name: 'ACME SL' },
    { id: 'co-2', type: 'company', name: 'BETA SL' },
  ],
  links: [
    { id: 'l1', source: 'off-a', target: 'co-1', relationship: 'Administrador' },
    { id: 'l2', source: 'off-b', target: 'co-2', relationship: 'Apoderado' },
    { id: 'l3', source: 'co-1', target: 'co-2', relationship: 'Socio Único' },
  ],
});

// What the component's mergeNodes produces for merge(off-a → off-b):
// source removed, its links rewired onto the target.
const mergedGraph = () => ({
  nodes: [
    { id: 'off-b', type: 'officer', name: 'GARCIA LOPEZ ANA MARIA', userMerged: true },
    { id: 'co-1', type: 'company', name: 'ACME SL' },
    { id: 'co-2', type: 'company', name: 'BETA SL' },
  ],
  links: [
    { id: 'l1', source: 'off-b', target: 'co-1', relationship: 'Administrador' },
    { id: 'l2', source: 'off-b', target: 'co-2', relationship: 'Apoderado' },
    { id: 'l3', source: 'co-1', target: 'co-2', relationship: 'Socio Único' },
  ],
});

describe('captureMergeSnapshot', () => {
  it('returns null when either node is missing', () => {
    const graph = makeGraph();
    expect(captureMergeSnapshot(graph, 'off-a', 'nope')).toBeNull();
    expect(captureMergeSnapshot(graph, 'nope', 'off-b')).toBeNull();
  });

  it('captures both nodes and every link touching either one', () => {
    const snapshot = captureMergeSnapshot(makeGraph(), 'off-a', 'off-b');
    expect(snapshot.sourceNode.name).toBe('GARCIA LOPEZ ANA');
    expect(snapshot.targetNode.name).toBe('GARCIA LOPEZ ANA MARIA');
    expect(snapshot.links.map(l => l.id).sort()).toEqual(['l1', 'l2']);
  });

  it('normalizes d3-mutated object link endpoints to string ids', () => {
    const graph = makeGraph();
    const nodeA = graph.nodes[0];
    graph.links[0].source = nodeA; // simulate d3 force mutation
    const snapshot = captureMergeSnapshot(graph, 'off-a', 'off-b');
    expect(snapshot.links.find(l => l.id === 'l1').source).toBe('off-a');
  });
});

describe('restoreMergeSnapshot', () => {
  it('round-trips: restoring after a merge recovers the pre-merge graph', () => {
    const original = makeGraph();
    const snapshot = captureMergeSnapshot(original, 'off-a', 'off-b');
    const restored = restoreMergeSnapshot(mergedGraph(), snapshot);

    expect(restored.nodes.map(n => n.id).sort()).toEqual(['co-1', 'co-2', 'off-a', 'off-b']);
    const offB = restored.nodes.find(n => n.id === 'off-b');
    expect(offB.userMerged).toBeUndefined();
    const offA = restored.nodes.find(n => n.id === 'off-a');
    expect(offA.userNote).toEqual({ text: 'source note' });

    const linkIds = restored.links.map(l => l.id).sort();
    expect(linkIds).toEqual(['l1', 'l2', 'l3']);
    expect(restored.links.find(l => l.id === 'l1').source).toBe('off-a');
    expect(restored.links.find(l => l.id === 'l2').source).toBe('off-b');
  });

  it('preserves unrelated nodes and links added after the merge', () => {
    const snapshot = captureMergeSnapshot(makeGraph(), 'off-a', 'off-b');
    const graph = mergedGraph();
    graph.nodes.push({ id: 'co-3', type: 'company', name: 'GAMMA SL' });
    graph.links.push({ id: 'l4', source: 'co-1', target: 'co-3', relationship: 'Socio Único' });

    const restored = restoreMergeSnapshot(graph, snapshot);
    expect(restored.nodes.some(n => n.id === 'co-3')).toBe(true);
    expect(restored.links.some(l => l.id === 'l4')).toBe(true);
  });

  it('does not mutate the input graph and is a no-op for a null snapshot', () => {
    const graph = mergedGraph();
    const before = JSON.parse(JSON.stringify(graph));
    const snapshot = captureMergeSnapshot(makeGraph(), 'off-a', 'off-b');
    restoreMergeSnapshot(graph, snapshot);
    expect(graph).toEqual(before);
    expect(restoreMergeSnapshot(graph, null)).toBe(graph);
  });
});
