import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/shared/buildGraph.js';

const company = {
  groupKey: 'H:M-1', name: 'ACME SA',
  officersActive: [
    { name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01', resignedDate: null },
  ],
  officersResigned: [
    { name: 'JOHN ROE', position: 'Apoderado', appointedDate: null, resignedDate: '2018-05-05' },
    { name: 'JANE DOE', position: 'Apoderado', appointedDate: null, resignedDate: '2017-01-01' },
  ],
};

describe('buildGraph', () => {
  it('puts the company at the center', () => {
    const { nodes } = buildGraph(company);
    expect(nodes[0]).toEqual({ id: 'H:M-1', label: 'ACME SA', type: 'company' });
  });
  it('creates one officer node per distinct person', () => {
    const { nodes } = buildGraph(company);
    const officers = nodes.filter((n) => n.type === 'officer');
    expect(officers.map((o) => o.label).sort()).toEqual(['JANE DOE', 'JOHN ROE']);
  });
  it('marks a person active if ANY seat is active', () => {
    const { links } = buildGraph(company);
    const jane = links.find((l) => l.target.endsWith('JANE DOE'));
    expect(jane.status).toBe('active');
    const john = links.find((l) => l.target.endsWith('JOHN ROE'));
    expect(john.status).toBe('ceased');
  });
  it('caps officer nodes at maxOfficers, board roles first', () => {
    const many = { groupKey: 'H:M-2', name: 'BIG SA', officersActive: [], officersResigned:
      Array.from({ length: 100 }, (_, i) => ({ name: `P${i}`,
        position: i < 3 ? 'Consejero' : 'Apoderado', resignedDate: '2020-01-01' })) };
    const { nodes } = buildGraph(many, { maxOfficers: 5 });
    const officers = nodes.filter((n) => n.type === 'officer');
    expect(officers.length).toBe(5);
    expect(officers.slice(0, 3).map((o) => o.label)).toEqual(['P0', 'P1', 'P2']);
  });
});
