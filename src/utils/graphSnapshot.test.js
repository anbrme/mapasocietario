import { describe, expect, it } from 'vitest';
import {
  createGraphSnapshot,
  GRAPH_SNAPSHOT_FORMAT,
  GRAPH_SNAPSHOT_VERSION,
  parseGraphSnapshot,
} from './graphSnapshot';

describe('graph snapshots', () => {
  it('normalizes force-graph endpoint references and removes runtime fields', () => {
    const company = { id: 'company-a', name: 'A', x: 12, y: 20, fx: 12, fy: 20, vx: 2, index: 0 };
    const officer = { id: 'officer-b', name: 'B', x: 30, y: 40, __indexColor: '#fff' };
    const snapshot = createGraphSnapshot({
      graphData: {
        nodes: [company, officer],
        links: [{ id: 'a-b', source: company, target: officer, relationship: 'Administrador', index: 0 }],
      },
      view: { hiddenNodeIds: ['officer-b'] },
    });

    expect(snapshot.format).toBe(GRAPH_SNAPSHOT_FORMAT);
    expect(snapshot.version).toBe(GRAPH_SNAPSHOT_VERSION);
    expect(snapshot.graph.links[0]).toMatchObject({ source: 'company-a', target: 'officer-b' });
    expect(snapshot.graph.nodes[0]).toMatchObject({ x: 12, y: 20, fx: 12, fy: 20 });
    expect(snapshot.graph.nodes[0]).not.toHaveProperty('vx');
    expect(snapshot.graph.nodes[1]).not.toHaveProperty('__indexColor');
  });

  it('round-trips a valid snapshot', () => {
    const source = createGraphSnapshot({
      graphData: {
        nodes: [{ id: 'a' }, { id: 'b' }],
        links: [{ id: 'link', source: 'a', target: 'b' }],
      },
      context: { primarySubject: 'A' },
    });

    expect(parseGraphSnapshot(JSON.stringify(source))).toMatchObject({
      graph: { nodes: [{ id: 'a' }, { id: 'b' }], links: [{ id: 'link', source: 'a', target: 'b' }] },
      context: { primarySubject: 'A' },
    });
  });

  it('rejects snapshots with missing link endpoints', () => {
    expect(() => parseGraphSnapshot({
      format: GRAPH_SNAPSHOT_FORMAT,
      version: GRAPH_SNAPSHOT_VERSION,
      graph: { nodes: [{ id: 'a' }], links: [{ id: 'broken', source: 'a', target: 'b' }] },
    })).toThrow('points to a missing node');
  });

  it('rejects unsupported snapshot versions', () => {
    expect(() => parseGraphSnapshot({
      format: GRAPH_SNAPSHOT_FORMAT,
      version: GRAPH_SNAPSHOT_VERSION + 1,
      graph: { nodes: [], links: [] },
    })).toThrow('Unsupported graph snapshot version');
  });
});
