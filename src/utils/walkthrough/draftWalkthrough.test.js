import { describe, expect, it } from 'vitest';
import {
  draftWalkthrough, subjectCompanyIds, pairKey, SELECTION_CAP, openingCard,
} from './draftWalkthrough';

const AT = '2026-09-12T09:00:00.000Z';
const co = (id, name, extra = {}) => ({ id, type: 'spanish-company-group', name, groupKey: id, ...extra });
const off = (id, name, extra = {}) => ({ id, type: 'officer', name, ...extra });
const link = (a, b, extra = {}) => ({ source: a, target: b, ...extra });
const note = (text, flag) => ({ text, flag, updatedAt: AT });

// H:1/H:2 two companies with groupKey; o1 a connector at both; o2 at H:1 only
// with an amber note; o3 unselected (no company link) with a red note.
const graph = {
  nodes: [
    co('H:1', 'ALFA SL'),
    co('H:2', 'BETA SL'),
    off('o1', 'GARCIA LOPEZ ANA'),
    off('o2', 'RUIZ MARTIN LUIS', { userNote: note('Left days before the filing', 'amber') }),
    off('o3', 'ABAD SORIA CARLA', { userNote: note('Possible duplicate of another officer', 'red') }),
  ],
  links: [
    link('H:1', 'o1', { category: 'nombramiento', relationship: 'Administradora única' }),
    link('H:2', 'o1', { category: 'cese', relationship: 'Consejera' }),
    link('H:1', 'o2', { category: 'nombramiento', relationship: 'Apoderado' }),
  ],
};

const scope = {
  companyNodes: [{ name: 'ALFA SL', nodeId: 'H:1' }, { name: 'BETA SL', nodeId: 'H:2' }],
  connectors: [{
    name: 'GARCIA LOPEZ ANA', nodeId: 'o1', companies: ['ALFA SL', 'BETA SL'], roles: ['Administradora única', 'Consejera'], status: 'mixed',
  }],
  ownership: [],
};

// Reuses the profile/events/findings shapes from stepEvidence.test.js.
const profile = {
  is_dissolved: false, is_in_concurso: false, share_capital: '3.006,00 €', activity: 'Consultoría',
  officers_active: [
    { name: 'GARCIA LOPEZ MARIA', position_normalized: 'Administradora única', appointed_date: '2021-03-01', status: 'active' },
  ],
  officers_resigned: [
    { name: 'RUIZ MARTIN LUIS', position_normalized: 'Apoderado', appointed_date: '2018-01-01', resigned_date: '2020-06-30', status: 'resigned' },
  ],
};
const events = {
  events: [
    { event_date: '2026-06-03', event_types: [{ type: 'Datos registrales' }, { type: 'Nombramientos' }] },
    { event_date: '2024-03-11', event_types: [{ type: 'Reducción de capital' }] },
  ],
};
const findings = {
  company: {
    name: 'ALFA SL', nif: 'B1', province: 'Valencia', registry: 'V-1', previous_names: [], last_filing: { date: '2026-06-03', type: 'Nombramientos' },
  },
  findings: [
    { kind: 'capital_movement', cls: 'concern', text: 'Capital reduced 2024-03-11.', date: '2024-03-11' },
  ],
  verification: [],
};

const stepData = new Map([
  ['H:1', { profile, events, findings }],
  ['H:2', null],
]);

const build = (over = {}) => draftWalkthrough({
  graphData: graph, scope, stepData, primarySubjectId: 'H:1', lang: 'es', ...over,
});

describe('draftWalkthrough — selection mode', () => {
  it('honours the selection order and caps it at SELECTION_CAP', () => {
    const many = Array.from({ length: 14 }, (_, i) => off(`p${i}`, `P${i}`));
    const bigGraph = { nodes: [...graph.nodes, ...many], links: graph.links };
    const selection = many.map(n => n.id).reverse();
    const steps = build({ graphData: bigGraph, selection });
    expect(steps).toHaveLength(SELECTION_CAP);
    expect(steps.map(s => s.nodeId)).toEqual(selection.slice(0, SELECTION_CAP));
    expect(steps.map(s => s.order)).toEqual(steps.map((_, i) => i));
  });

  it('ignores selected ids that are not on the visible map', () => {
    const steps = build({ selection: ['H:1', 'ghost-id', 'o1'] });
    expect(steps.map(s => s.nodeId)).toEqual(['H:1', 'o1']);
  });
});

describe('draftWalkthrough — company step', () => {
  it('carries kind company, the identity line as summary, board evidence and focuses visible board members', () => {
    const [step] = build({ selection: ['H:1'] });
    expect(step).toMatchObject({
      key: 'step:H:1', nodeId: 'H:1', kind: 'company', section: 'company', source: 'registry', title: 'ALFA SL',
    });
    expect(step.summary).toContain('NIF B1');
    expect(step.text).toBe(step.summary);
    expect(step.evidence.board).toHaveLength(2);
    expect([...step.nodeIds].sort()).toEqual(['H:1', 'o1', 'o2']);
    expect([...step.linkKeys].sort()).toEqual([pairKey('H:1', 'o1'), pairKey('H:1', 'o2')].sort());
  });

  it('falls back to the graph-only line when there is no stepData entry', () => {
    const [step] = build({ selection: ['H:2'] });
    expect(step).toMatchObject({ kind: 'company', source: 'graph', summary: '1 cargo visible en el mapa' });
    expect(step.nodeIds).toEqual(['H:2', 'o1']);
  });
});

describe('draftWalkthrough — person step', () => {
  it('carries kind person, the seats line as summary and seats evidence', () => {
    const [step] = build({ selection: ['o1'] });
    expect(step).toMatchObject({
      key: 'step:o1', nodeId: 'o1', kind: 'person', section: 'person', source: 'graph', summary: '2 cargos en 2 empresas',
    });
    expect(step.evidence.seats).toHaveLength(2);
    expect([...step.nodeIds].sort()).toEqual(['H:1', 'H:2', 'o1']);
    expect([...step.linkKeys].sort()).toEqual([pairKey('o1', 'H:1'), pairKey('o1', 'H:2')].sort());
  });
});

describe('draftWalkthrough — notes', () => {
  it('turns a note on a selected node into narrative, and drops notes on unselected nodes', () => {
    const steps = build({ selection: ['H:1', 'o2'] });
    const person = steps.find(s => s.nodeId === 'o2');
    expect(person.narrative).toEqual({ text: 'Left days before the filing', flag: 'amber' });
    expect(person.authorNote).toEqual({ text: 'Left days before the filing', flag: 'amber', origin: 'node' });
    expect(person.flag).toBe('amber');
    expect(steps.some(s => s.nodeId === 'o3')).toBe(false);
  });
});

describe('draftWalkthrough — draft mode', () => {
  it('orders subject, other companies, connectors, then loose notes, with no node repeated', () => {
    const steps = build();
    expect(steps.map(s => s.nodeId)).toEqual(['H:1', 'H:2', 'o1', 'o3', 'o2']);
    const titles = steps.map(s => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('draftWalkthrough — keys and purity', () => {
  it('keys every step step:<nodeId>', () => {
    const steps = build({ selection: ['H:1', 'o1'] });
    expect(steps.map(s => s.key)).toEqual(['step:H:1', 'step:o1']);
  });

  it('never mutates the graph, scope or stepData inputs', () => {
    const before = JSON.stringify({ graph, scope, stepData: [...stepData] });
    build({ selection: ['H:1', 'o1'] });
    build();
    expect(JSON.stringify({ graph, scope, stepData: [...stepData] })).toBe(before);
  });
});

describe('openingCard', () => {
  it('titles the card by step count and picks the line by mode', () => {
    expect(openingCard({ steps: [1, 2, 3], mode: 'selection', selectedCount: 3, lang: 'es' })).toEqual({
      title: 'Recorrido por esta red · 3 pasos', line: 'Tu selección, en el orden elegido',
    });
    expect(openingCard({ steps: [1, 2, 3], mode: 'draft', selectedCount: 0, lang: 'es' }).line)
      .toBe('Borrador generado: empresas, conexiones y tus notas');
    expect(openingCard({
      steps: Array.from({ length: SELECTION_CAP }), mode: 'selection', selectedCount: 15, lang: 'es',
    }).line).toBe('Se muestran los 12 primeros de 15 seleccionados');
  });
});

describe('subjectCompanyIds', () => {
  it('puts the primary subject first and keeps scope order for the rest', () => {
    expect(subjectCompanyIds(scope, 'H:2')).toEqual(['H:2', 'H:1']);
    expect(subjectCompanyIds(scope, null)).toEqual(['H:1', 'H:2']);
  });
});

describe('pairKey', () => {
  it('is order-independent', () => {
    expect(pairKey('b', 'a')).toBe('a|b');
    expect(pairKey('a', 'b')).toBe('a|b');
  });
});
