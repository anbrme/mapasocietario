import { describe, expect, it } from 'vitest';
import {
  shortestPath, suggestConnections, connectionStep, connectionKey,
} from './connections';
import { pairKey } from './pairKey';

const co = (id, name, extra = {}) => ({ id, type: 'spanish-company-group', name, ...extra });
const off = (id, name) => ({ id, type: 'officer', name });
const link = (a, b, extra = {}) => ({ source: a, target: b, ...extra });

// A (company) — p1 — B (company); B — p2 — C; D isolated; p3 sits on A and B (a connector).
const graph = {
  nodes: [
    co('A', 'ALFA SL'), co('B', 'BETA SL'), co('C', 'GAMMA SL'), co('D', 'DELTA SL'),
    off('p1', 'PEREZ ANA'), off('p2', 'LOPEZ LUIS'), off('p3', 'RUIZ MARIA'),
  ],
  links: [
    link('A', 'p1', { category: 'nombramiento', relationship: 'Administradora única', date: '2020-01-01' }),
    link('B', 'p1', { category: 'cese', relationship: 'Consejera', date: '2021-06-01' }),
    link('B', 'p2', { category: 'nombramiento', relationship: 'Apoderado', date: '2019-03-03' }),
    link('C', 'p2', { category: 'nombramiento', relationship: 'Consejero', date: '2022-02-02' }),
    link('A', 'p3', { category: 'nombramiento', relationship: 'Auditor', date: '2018-01-01' }),
    link('B', 'p3', { category: 'nombramiento', relationship: 'Auditor', date: '2018-02-02' }),
  ],
};

describe('shortestPath', () => {
  it('finds the fewest hops and returns ids from a to b inclusive', () => {
    const p = shortestPath(graph, 'A', 'C');
    expect(p[0]).toBe('A');
    expect(p[p.length - 1]).toBe('C');
    expect(p).toHaveLength(5); // A - p? - B - p2 - C
  });
  it('returns null when unreachable or unknown, and [a] for a to itself', () => {
    expect(shortestPath(graph, 'A', 'D')).toBeNull();
    expect(shortestPath(graph, 'A', 'nope')).toBeNull();
    expect(shortestPath(graph, 'A', 'A')).toEqual(['A']);
  });
});

describe('suggestConnections', () => {
  it('offers the unselected intermediaries between selected companies, one suggestion per path', () => {
    const s = suggestConnections({ graphData: graph, selection: ['A', 'B'] });
    // Two one-hop paths exist (p1 and p3); BFS returns one of them; either is a valid suggestion.
    expect(s).toHaveLength(1);
    expect(s[0].hops).toBe(2);
    expect(s[0].ends).toEqual(['A', 'B']);
    expect(['p1', 'p3']).toContain(s[0].via[0]);
    expect(s[0].key).toBe(connectionKey(s[0].via, s[0].ends));
  });

  it('skips directly linked pairs and pairs whose path runs through a selected node', () => {
    expect(suggestConnections({ graphData: graph, selection: ['A', 'p1'] })).toEqual([]);
    // A→C runs through B; with B selected the connection is B's own story.
    const viaB = suggestConnections({ graphData: graph, selection: ['A', 'B', 'C'] })
      .filter(x => x.via.includes('B'));
    expect(viaB).toEqual([]);
  });

  it('groups several ends reached through the same intermediary into one suggestion', () => {
    const g = {
      nodes: [co('A', 'ALFA SL'), co('B', 'BETA SL'), co('C', 'GAMMA SL'), off('x', 'NEXO')],
      links: [link('A', 'x', { category: 'nombramiento' }), link('B', 'x', { category: 'nombramiento' }), link('C', 'x', { category: 'nombramiento' })],
    };
    const s = suggestConnections({ graphData: g, selection: ['A', 'B', 'C'] });
    expect(s).toHaveLength(1);
    expect(s[0].via).toEqual(['x']);
    expect(s[0].ends).toEqual(['A', 'B', 'C']);
  });

  it('skips unreachable pairs and dedupes the selection', () => {
    expect(suggestConnections({ graphData: graph, selection: ['A', 'D', 'A'] })).toEqual([]);
  });
});

describe('connectionStep', () => {
  it('builds a connection step: no nodeId, ends then via, one link key per hop, hop rows with status and date', () => {
    const suggestion = { key: 'conn:p1', via: ['p1'], ends: ['A', 'B'], hops: 2 };
    const s = connectionStep({ suggestion, graphData: graph, order: 2, lang: 'es' });
    expect(s.kind).toBe('connection');
    expect(s.nodeId).toBeNull();
    expect(s.key).toBe('conn:p1');
    expect(s.title).toBe('PEREZ ANA');
    expect(s.nodeIds).toEqual(['A', 'B', 'p1']);
    expect(s.linkKeys).toEqual([pairKey('A', 'p1'), pairKey('B', 'p1')]);
    expect(s.evidence.hops).toEqual([
      { who: 'PEREZ ANA', whoId: 'p1', at: 'ALFA SL', atId: 'A', role: 'Administradora única', status: 'active', since: '2020-01-01', until: '' },
      { who: 'PEREZ ANA', whoId: 'p1', at: 'BETA SL', atId: 'B', role: 'Consejera', status: 'ceased', since: '', until: '2021-06-01' },
    ]);
    expect(s.moment).toBe('2021-06-01');
    expect(s.summary).toBe('ALFA SL y BETA SL se conectan a través de PEREZ ANA · 2 pasos');
    expect(s.source).toBe('graph');
  });

  it('writes the English sentence and joins three ends with "and"', () => {
    const g = {
      nodes: [co('A', 'ALFA SL'), co('B', 'BETA SL'), co('C', 'GAMMA SL'), off('x', 'NEXO')],
      links: [link('A', 'x', { category: 'nombramiento' }), link('B', 'x', { category: 'nombramiento' }), link('C', 'x', { category: 'nombramiento' })],
    };
    const s = connectionStep({ suggestion: { key: 'conn:x', via: ['x'], ends: ['A', 'B', 'C'], hops: 2 }, graphData: g, order: 0, lang: 'en' });
    expect(s.summary).toBe('ALFA SL, BETA SL and GAMMA SL connect through NEXO · 2 hops');
    expect(s.evidence.hops).toHaveLength(3);
  });

  it('a two-hop path through a company and a person lists each hop once', () => {
    // A — p1 — B — p2 — C with only A and C selected: via = [p1, B, p2]
    const suggestion = { key: connectionKey(['p1', 'B', 'p2'], ['A', 'C']), via: ['p1', 'B', 'p2'], ends: ['A', 'C'], hops: 4 };
    expect(suggestion.key).toBe('conn:A>p1+B+p2>C');
    const s = connectionStep({ suggestion, graphData: graph, order: 0, lang: 'es' });
    expect(s.nodeIds).toEqual(['A', 'C', 'p1', 'B', 'p2']);
    expect(s.title).toBe('PEREZ ANA → BETA SL → LOPEZ LUIS');
    const whoAt = s.evidence.hops.map(h => `${h.who}@${h.at}`);
    expect(whoAt).toContain('PEREZ ANA@ALFA SL');
    expect(whoAt).toContain('PEREZ ANA@BETA SL');
    expect(whoAt).toContain('LOPEZ LUIS@BETA SL');
    expect(whoAt).toContain('LOPEZ LUIS@GAMMA SL');
  });
});


describe('hopRows attribution per link', () => {
  it('two companies holding seats at each other in opposite directions each keep their own actor', () => {
    const g = {
      nodes: [co('A', 'ALFA SL', { unified: true }), co('B', 'BETA SL', { unified: true }), co('C', 'GAMMA SL')],
      links: [
        link('A', 'B', { type: 'officer-company', unified: true, category: 'nombramiento', relationship: 'Administrador único', date: '2020-01-01' }),
        link('B', 'A', { type: 'officer-company', unified: true, category: 'nombramiento', relationship: 'Auditor', date: '2021-01-01' }),
        link('B', 'C', { type: 'officer-company', unified: true, category: 'nombramiento', relationship: 'Consejero', date: '2022-01-01' }),
      ],
    };
    const s = connectionStep({ suggestion: { key: 'conn:B', via: ['B'], ends: ['A', 'C'], hops: 2 }, graphData: g, order: 0, lang: 'es' });
    const rows = s.evidence.hops.map(h => `${h.who} ${h.role} @ ${h.at}`);
    expect(rows).toContain('ALFA SL Administrador único @ BETA SL');
    expect(rows).toContain('BETA SL Auditor @ ALFA SL');
    expect(rows).toContain('BETA SL Consejero @ GAMMA SL');
  });
});
