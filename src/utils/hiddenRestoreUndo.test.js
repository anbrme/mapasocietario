import { describe, expect, it } from 'vitest';
import { forceSimulation, forceLink, forceManyBody } from 'd3-force';
import { captureHiddenRestore, applyHiddenRestore, undoHiddenRestore } from './hiddenRestoreUndo';

function fixture() {
  const nodes = [
    { id: 'a', x: 20, y: 40, fx: 20, fy: 40, userNote: 'Keep me' },
    { id: 'b', x: 180, y: -30 },
    { id: 3, x: -90, y: 75 },
  ];
  return {
    nodes,
    links: [
      { id: 'ab', source: nodes[0], target: nodes[1] },
      { id: 'ac', source: nodes[0], target: nodes[2], dismissed: { by: 'author', reason: 'Not relevant', at: '2026-09-18' } },
    ],
  };
}

describe('undo hidden item restoration', () => {
  it('reverses Show all as one operation and recovers the layout after nodes move', () => {
    const graph = fixture();
    const hidden = new Set(['b', '3']);
    const snapshot = captureHiddenRestore(graph, hidden, { nodeIds: ['b', 3] });
    const shown = applyHiddenRestore(graph, hidden, snapshot);
    expect(shown.hiddenNodeIds.size).toBe(0);
    shown.graph.nodes.forEach(node => { node.x += 500; node.y -= 250; });
    const undone = undoHiddenRestore(shown.graph, shown.hiddenNodeIds, snapshot);
    expect(undone.hiddenNodeIds).toEqual(hidden);
    expect(undone.graph.nodes.map(({ x, y }) => ({ x, y }))).toEqual(graph.nodes.map(({ x, y }) => ({ x, y })));
    expect(graph.nodes[0]).toMatchObject({ x: 20, y: 40 });
    expect(undone.graph.links[1].dismissed).toEqual(graph.links[1].dismissed);
  });

  it('keeps both revealed and recovered positions fixed through simulation ticks and rebinds edges', () => {
    const graph = fixture();
    const snapshot = captureHiddenRestore(graph, new Set(['b']), { nodeIds: ['b'] });
    const shown = applyHiddenRestore(graph, new Set(['b']), snapshot);
    const checkSimulation = state => {
      const sim = forceSimulation(state.graph.nodes).stop()
        .force('link', forceLink(state.graph.links).id(node => node.id))
        .force('charge', forceManyBody().strength(-350));
      sim.tick(50);
      expect(state.graph.nodes.map(({ x, y }) => [x, y])).toEqual([[20, 40], [180, -30], [-90, 75]]);
      expect(state.graph.links[0].source).toBe(state.graph.nodes[0]);
      expect(state.graph.links[0].target).toBe(state.graph.nodes[1]);
    };
    checkSimulation(shown);
    checkSimulation(undoHiddenRestore(shown.graph, shown.hiddenNodeIds, snapshot));
  });

  it('undoes sequential node and connection restores independently in reverse order', () => {
    const graph = fixture();
    const hidden = new Set(['b', '3']);
    const first = captureHiddenRestore(graph, hidden, { nodeIds: ['b'] });
    const one = applyHiddenRestore(graph, hidden, first);
    const second = captureHiddenRestore(one.graph, one.hiddenNodeIds, { linkIds: ['ac'] });
    const two = applyHiddenRestore(one.graph, one.hiddenNodeIds, second);
    expect(two.graph.links[1]).not.toHaveProperty('dismissed');
    const undoTwo = undoHiddenRestore(two.graph, two.hiddenNodeIds, second);
    expect(undoTwo.hiddenNodeIds).toEqual(new Set(['3']));
    expect(undoTwo.graph.links[1].dismissed).toEqual(graph.links[1].dismissed);
    const undoOne = undoHiddenRestore(undoTwo.graph, undoTwo.hiddenNodeIds, first);
    expect(undoOne.hiddenNodeIds).toEqual(hidden);
  });

  it('preserves later notes, new nodes, links and hiding decisions without resurrecting deleted nodes', () => {
    const graph = fixture();
    const snapshot = captureHiddenRestore(graph, new Set(['b', '3']), { nodeIds: ['b', '3'], linkIds: ['ac'] });
    const shown = applyHiddenRestore(graph, new Set(['b', '3']), snapshot);
    const edited = {
      nodes: [...shown.graph.nodes.filter(n => n.id !== 'b').map(n => ({ ...n, userNote: 'Updated' })), { id: 'new', x: 900, y: 400 }],
      links: [{ ...shown.graph.links[1], relationship: 'Edited' }, { id: 'new-link', source: 'a', target: 'new' }],
    };
    const undone = undoHiddenRestore(edited, new Set(['a']), snapshot);
    expect(undone.hiddenNodeIds).toEqual(new Set(['a', '3']));
    expect(undone.graph.nodes.map(n => n.id)).toEqual(['a', 3, 'new']);
    expect(undone.graph.nodes[0].userNote).toBe('Updated');
    expect(undone.graph.nodes[2]).toBe(edited.nodes[2]);
    expect(undone.graph.links[0]).toMatchObject({ relationship: 'Edited', dismissed: graph.links[1].dismissed });
    expect(undone.graph.links[1].id).toBe('new-link');
  });

  it('preserves a newer dismissal and does not recreate a deleted link', () => {
    const graph = fixture();
    const snapshot = captureHiddenRestore(graph, new Set(), { linkIds: ['ac'] });
    const newer = { by: 'author', reason: 'New reason' };
    graph.links[1].dismissed = newer;
    expect(undoHiddenRestore(graph, new Set(), snapshot).graph.links[1].dismissed).toBe(newer);
    graph.links = [];
    expect(undoHiddenRestore(graph, new Set(), snapshot).graph.links).toEqual([]);
  });

  it('ignores no-op requests and leaves nodes with no coordinates available for layout', () => {
    const graph = fixture();
    expect(captureHiddenRestore(graph, new Set(), { nodeIds: ['a', 'missing'], linkIds: ['ab'] })).toBeNull();
    graph.nodes.push({ id: 'unplaced' });
    const snapshot = captureHiddenRestore(graph, new Set(['unplaced']), { nodeIds: ['unplaced'] });
    const shown = applyHiddenRestore(graph, new Set(['unplaced']), snapshot);
    expect(shown.graph.nodes[3]).not.toHaveProperty('fx');
    expect(shown.graph.nodes[3]).not.toHaveProperty('x');
  });
});
