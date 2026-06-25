import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/shared/buildGraph.js';

// Fixture with board roles (Consejero) and apoderado-only person
const company = {
  groupKey: 'H:M-1', name: 'ACME SA',
  officersActive: [
    { name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01', resignedDate: null },
  ],
  officersResigned: [
    // JOHN ROE is apoderado-only — must be excluded
    { name: 'JOHN ROE', position: 'Apoderado', appointedDate: null, resignedDate: '2018-05-05' },
    // JANE DOE also had a ceased Apoderado seat — ignored for board filter; she keeps board seat
    { name: 'JANE DOE', position: 'Apoderado', appointedDate: null, resignedDate: '2017-01-01' },
  ],
};

describe('buildGraph', () => {
  it('puts the company at the center', () => {
    const { nodes } = buildGraph(company);
    expect(nodes[0]).toEqual({ id: 'H:M-1', label: 'ACME SA', type: 'company' });
  });

  it('excludes apoderado-only people, keeps board members', () => {
    const { nodes } = buildGraph(company);
    const officers = nodes.filter((n) => n.type === 'officer');
    // JOHN ROE (apoderado-only) must NOT appear
    expect(officers.map((o) => o.label)).not.toContain('JOHN ROE');
    // JANE DOE (active Consejero) must appear
    expect(officers.map((o) => o.label)).toContain('JANE DOE');
    expect(officers.length).toBe(1);
  });

  it('counts apoderado-only people in hiddenNonBoard', () => {
    const { hiddenNonBoard } = buildGraph(company);
    // JOHN ROE is apoderado-only; JANE DOE has a board seat so not hidden
    expect(hiddenNonBoard).toBe(1);
  });

  it('officer nodes carry status', () => {
    const { nodes } = buildGraph(company);
    const jane = nodes.find((n) => n.label === 'JANE DOE');
    expect(jane.status).toBe('active');
  });

  it('marks a person active if ANY board seat is active', () => {
    // JANE has active Consejero + ceased Consejero — should be active
    const mixed = {
      groupKey: 'H:M-3', name: 'MIXED SA',
      officersActive: [
        { name: 'JANE DOE', position: 'Consejero', appointedDate: '2022-01-01', resignedDate: null },
      ],
      officersResigned: [
        { name: 'JANE DOE', position: 'Consejero', appointedDate: null, resignedDate: '2019-01-01' },
      ],
    };
    const { links } = buildGraph(mixed);
    const jane = links.find((l) => l.target.endsWith('JANE DOE'));
    expect(jane.status).toBe('active');
  });

  it('a purely-ceased board member produces no node or link', () => {
    const ceasedOnly = {
      groupKey: 'H:M-5', name: 'CEASED SA',
      officersActive: [],
      officersResigned: [
        { name: 'OLD BOSS', position: 'Administrador', appointedDate: null, resignedDate: '2019-01-01' },
      ],
    };
    const { nodes, links } = buildGraph(ceasedOnly);
    const officers = nodes.filter((n) => n.type === 'officer');
    expect(officers.length).toBe(0);
    expect(links.length).toBe(0);
  });

  it('a company whose officers are ALL apoderados yields nodes=[company] and hiddenNonBoard=count', () => {
    const apoOnly = {
      groupKey: 'H:M-4', name: 'APO SA',
      officersActive: [
        { name: 'APO ONE', position: 'Apoderado', appointedDate: '2020-01-01' },
        { name: 'APO TWO', position: 'APO.SOL.', appointedDate: '2020-01-01' },
      ],
      officersResigned: [],
    };
    const { nodes, hiddenNonBoard } = buildGraph(apoOnly);
    const officers = nodes.filter((n) => n.type === 'officer');
    expect(officers.length).toBe(0);
    expect(hiddenNonBoard).toBe(2);
  });

  it('caps officer nodes at maxOfficers using active officers', () => {
    // All 100 people are active Consejero (board) so they pass the filter; cap at 5
    const many = { groupKey: 'H:M-2', name: 'BIG SA',
      officersActive: Array.from({ length: 100 }, (_, i) => ({ name: `P${i}`,
        position: 'Consejero', appointedDate: '2020-01-01' })),
      officersResigned: [] };
    const { nodes } = buildGraph(many, { maxOfficers: 5 });
    const officers = nodes.filter((n) => n.type === 'officer');
    expect(officers.length).toBe(5);
  });
});
