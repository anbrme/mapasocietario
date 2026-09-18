import { describe, it, expect } from 'vitest';
import { runSnapshotRefresh } from './runSnapshotRefresh';

const company = (id, name) => ({ id, name, type: 'spanish-company-group', companySummary: { totalEntries: 1 } });
const live = total => ({ company: { company_name: 'X' }, events: [{ event_date: '2020-01-01' }], total });

describe('runSnapshotRefresh', () => {
  it('fetches every company and applies the results to the current graph', async () => {
    // Arrange
    const graph = { nodes: [company('a', 'A SL'), company('b', 'B SL')], links: [] };

    // Act
    const outcome = await runSnapshotRefresh({
      getGraph: () => graph,
      fetchLive: async () => live(32),
      signal: new AbortController().signal,
    });

    // Assert
    expect(outcome.graph.nodes.map(n => n.companySummary.totalEntries)).toEqual([32, 32]);
    expect(outcome.summary).toMatchObject({ refreshed: 2, failed: [], cancelled: false, skipped: 0 });
  });

  it('keeps what was fetched when cancelled on the same graph', async () => {
    const graph = { nodes: [company('a', 'A SL'), company('b', 'B SL')], links: [] };
    const controller = new AbortController();

    const outcome = await runSnapshotRefresh({
      getGraph: () => graph,
      fetchLive: async () => { controller.abort(); return live(32); },
      signal: controller.signal,
      concurrency: 1,
    });

    expect(outcome.summary).toMatchObject({ refreshed: 1, cancelled: true, skipped: 1 });
    expect(outcome.graph.nodes[0].companySummary.totalEntries).toBe(32);
  });

  it('discards everything when a different graph was loaded mid-refresh', async () => {
    // Arrange: the user imports another snapshot while A is being refreshed.
    const snapshotA = { nodes: [company('a', 'A SL')], links: [] };
    const snapshotB = { nodes: [company('a', 'A SL')], links: [] }; // same id, different graph
    let current = snapshotA;
    let isAbandoned = false;

    // Act
    const outcome = await runSnapshotRefresh({
      getGraph: () => current,
      fetchLive: async () => { current = snapshotB; isAbandoned = true; return live(32); },
      signal: new AbortController().signal,
      isAbandoned: () => isAbandoned,
    });

    // Assert
    expect(outcome).toBeNull();
  });

  it('records a failed company and still applies the rest', async () => {
    const graph = { nodes: [company('a', 'A SL'), company('b', 'B SL')], links: [] };

    const outcome = await runSnapshotRefresh({
      getGraph: () => graph,
      fetchLive: async node => { if (node.id === 'b') throw new Error('429'); return live(32); },
      signal: new AbortController().signal,
    });

    expect(outcome.summary.failed).toEqual([{ id: 'b', name: 'B SL' }]);
    expect(outcome.graph.nodes[1]).toBe(graph.nodes[1]);
  });

  it('can be limited to chosen ids for a retry', async () => {
    const graph = { nodes: [company('a', 'A SL'), company('b', 'B SL')], links: [] };
    const fetched = [];

    await runSnapshotRefresh({
      getGraph: () => graph,
      fetchLive: async node => { fetched.push(node.id); return live(32); },
      signal: new AbortController().signal,
      onlyIds: new Set(['b']),
    });

    expect(fetched).toEqual(['b']);
  });
});
