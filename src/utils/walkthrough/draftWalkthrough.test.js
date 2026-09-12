import { describe, expect, it } from 'vitest';
import {
  draftWalkthrough, subjectCompanyIds, pairKey, STANDS_OUT_CAP, CONNECTS_CAP,
} from './draftWalkthrough';

const AT = '2026-09-12T09:00:00.000Z';
const co = (id, name, extra = {}) => ({ id, type: 'spanish-company-group', name, groupKey: id, ...extra });
const off = (id, name, extra = {}) => ({ id, type: 'officer', name, ...extra });
const link = (a, b, extra = {}) => ({ source: a, target: b, ...extra });

const graph = {
  nodes: [
    co('H:1', 'ALFA SL'), co('H:2', 'BETA SL'),
    off('o1', 'GARCIA LOPEZ ANA'), off('o2', 'RUIZ MARTIN LUIS', { userNote: { text: 'Left days before the filing', flag: 'blue', updatedAt: AT } }),
  ],
  links: [
    link('H:1', 'o1', { category: 'nombramiento', relationship: 'Administradora única' }),
    link('H:2', 'o1', { category: 'cese', relationship: 'Consejera' }),
    link('H:1', 'o2', { category: 'cese', relationship: 'Apoderado' }),
    link('H:1', 'H:2', { type: 'ownership', category: 'socio_unico' }),
  ],
};

const scope = {
  companies: ['ALFA SL', 'BETA SL'],
  companyNodes: [{ name: 'ALFA SL', nodeId: 'H:1' }, { name: 'BETA SL', nodeId: 'H:2' }],
  connectors: [{ name: 'GARCIA LOPEZ ANA', nodeId: 'o1', type: 'individual', companies: ['ALFA SL', 'BETA SL'], roles: ['Administradora única', 'Consejera'], status: 'mixed' }],
  ownership: [{ owner: 'ALFA SL', owned: 'BETA SL', lost: false }],
  officersByCompany: { 'ALFA SL': ['GARCIA LOPEZ ANA', 'RUIZ MARTIN LUIS'], 'BETA SL': ['GARCIA LOPEZ ANA'] },
  counts: { companies: 2, officers: 2, sharedPeople: 1 },
};

const finding = (kind, cls, date, extra = {}) => ({
  kind, cls, date, layer: 'shape', text: `${kind} text`, evidence: [], borme_ref: null, ...extra,
});

const alfaFindings = {
  company: { name: 'ALFA SL', group_key: 'H:1', nif: 'B1', province: 'Valencia', registry: 'V-1', previous_names: [], last_filing: { date: '2026-06-03', type: 'Nombramiento' } },
  findings: [
    finding('capital_movement', 'concern', '2024-03-11'),
    finding('governing_body_turnover', 'context', '2026-06-03', { evidence: [{ kind: 'officer', ref: 'Ana García López' }] }),
    finding('no_insolvency_notice', 'limitation', null),
    finding('sole_shareholder_declared', 'context', '2019-01-01'),
    finding('previous_name', 'context', '2018-01-01'),
    finding('structural_event', 'concern', '2020-05-05'),
  ],
  verification: ['The registry does not show beneficial owners.'],
  coverage: { since: '2009-01-01', indexed_through: '2026-09-11' },
};

const draft = (over = {}) => draftWalkthrough({
  graphData: graph, scope, findingsByKey: new Map([['H:1', alfaFindings], ['H:2', null]]),
  primarySubjectId: 'H:1', lang: 'es', ...over,
});

describe('draftWalkthrough', () => {
  it('emits sections in the fixed order', () => {
    const sections = [...new Set(draft().map(s => s.section))];
    expect(sections).toEqual(['subject', 'stands_out', 'connects', 'ownership', 'other_companies', 'unseen', 'author']);
  });

  it('opens with the subject identity line from the findings header', () => {
    const [first] = draft();
    expect(first).toMatchObject({
      key: 'subject:H:1', section: 'subject', nodeIds: ['H:1'], source: 'registry',
      title: 'ALFA SL', deepLink: 'https://mapasocietario.es/app?gk=H%3A1&lang=es',
    });
    expect(first.text).toContain('NIF B1');
  });

  it('puts concerns before context, drops limitations, and caps at STANDS_OUT_CAP', () => {
    const standsOut = draft().filter(s => s.section === 'stands_out');
    expect(standsOut.length).toBe(STANDS_OUT_CAP);
    expect(standsOut.map(s => s.key)).toEqual([
      'stands_out:H:1:capital_movement:2024-03-11',
      'stands_out:H:1:structural_event:2020-05-05',
      'stands_out:H:1:governing_body_turnover:2026-06-03',
      'stands_out:H:1:sole_shareholder_declared:2019-01-01',
    ]);
    expect(standsOut.every(s => s.source === 'registry')).toBe(true);
    expect(standsOut[0].text).toBe('capital_movement text');
  });

  it('resolves officer evidence to a visible node by folded name and links it to the subject', () => {
    const turnover = draft().find(s => s.key.startsWith('stands_out:H:1:governing_body_turnover'));
    expect(turnover.nodeIds).toEqual(['H:1', 'o1']);
    expect(turnover.linkKeys).toEqual([pairKey('H:1', 'o1')]);
  });

  it('writes one connects step per connector with both companies and their links', () => {
    const connects = draft().filter(s => s.section === 'connects');
    expect(connects).toHaveLength(1);
    expect(connects[0]).toMatchObject({
      key: 'connects:o1', source: 'graph', title: 'GARCIA LOPEZ ANA',
      nodeIds: ['o1', 'H:1', 'H:2'],
    });
    expect(connects[0].linkKeys.sort()).toEqual([pairKey('H:1', 'o1'), pairKey('H:2', 'o1')].sort());
    expect(connects[0].text).toBe('GARCIA LOPEZ ANA ocupa y ocupó Administradora única, Consejera en ALFA SL y BETA SL');
  });

  it('caps connectors at CONNECTS_CAP, most companies first', () => {
    const many = Array.from({ length: CONNECTS_CAP + 3 }, (_, i) => ({
      name: `P${i}`, nodeId: `p${i}`, type: 'individual', companies: i === 0 ? ['ALFA SL', 'BETA SL', 'GAMMA SL'] : ['ALFA SL', 'BETA SL'],
      roles: ['Consejero'], status: 'active',
    }));
    const nodes = [...graph.nodes, ...many.map(c => off(c.nodeId, c.name))];
    const steps = draft({ graphData: { ...graph, nodes }, scope: { ...scope, connectors: many } });
    const connects = steps.filter(s => s.section === 'connects');
    expect(connects).toHaveLength(CONNECTS_CAP);
    expect(connects[0].key).toBe('connects:p0');
  });

  it('writes an ownership step focusing both nodes and their edge', () => {
    const own = draft().find(s => s.section === 'ownership');
    expect(own).toMatchObject({
      key: 'ownership:H:1|H:2', nodeIds: ['H:1', 'H:2'], linkKeys: [pairKey('H:1', 'H:2')],
      text: 'ALFA SL es socio único de BETA SL', source: 'graph',
    });
  });

  it('gives a company with no findings payload the graph-only line', () => {
    const other = draft().find(s => s.section === 'other_companies');
    expect(other).toMatchObject({ key: 'other_companies:H:2', title: 'BETA SL', source: 'graph', text: '1 cargo visible en el mapa' });
  });

  it('gives a company with a concern its top concern as the other_companies text', () => {
    const betaFindings = { ...alfaFindings, company: { ...alfaFindings.company, name: 'BETA SL', group_key: 'H:2' } };
    const other = draft({ findingsByKey: new Map([['H:1', alfaFindings], ['H:2', betaFindings]]) })
      .find(s => s.section === 'other_companies');
    expect(other).toMatchObject({ source: 'registry', text: 'capital_movement text', date: '2024-03-11' });
  });

  it('collects verification lines and limitation findings into one unseen step', () => {
    const unseen = draft().find(s => s.section === 'unseen');
    expect(unseen.key).toBe('unseen:H:1');
    expect(unseen.text).toContain('The registry does not show beneficial owners.');
    expect(unseen.text).toContain('no_insolvency_notice text');
  });

  it('turns a note on an unfocused node into an author step, and attaches focused notes', () => {
    const nodes = graph.nodes.map(n => (n.id === 'o1'
      ? { ...n, userNote: { text: 'Same person as the 2019 apoderada?', flag: 'amber', updatedAt: AT } } : n));
    const steps = draft({ graphData: { ...graph, nodes } });
    const author = steps.filter(s => s.section === 'author');
    expect(author).toEqual([expect.objectContaining({
      key: 'author:o2', title: 'RUIZ MARTIN LUIS', text: 'Left days before the filing', flag: 'blue', source: 'author', nodeIds: ['o2'],
    })]);
    const connects = steps.find(s => s.key === 'connects:o1');
    expect(connects.authorNote).toEqual({ text: 'Same person as the 2019 apoderada?', flag: 'amber', origin: 'node' });
  });

  it('orders author steps red, amber, then the rest, then by name', () => {
    const nodes = [
      ...graph.nodes.filter(n => n.id !== 'o2'),
      off('z', 'ZETA', { userNote: { text: 'z', flag: 'none', updatedAt: AT } }),
      off('r', 'ROJO', { userNote: { text: 'r', flag: 'red', updatedAt: AT } }),
      off('a', 'AMBAR', { userNote: { text: 'a', flag: 'amber', updatedAt: AT } }),
      off('b', 'BLUE', { userNote: { text: 'b', flag: 'blue', updatedAt: AT } }),
    ];
    const keys = draft({ graphData: { ...graph, nodes } }).filter(s => s.section === 'author').map(s => s.key);
    expect(keys).toEqual(['author:r', 'author:a', 'author:b', 'author:z']);
  });

  it('yields exactly one subject step for a lone company with no payload', () => {
    const lone = { nodes: [co('H:9', 'SOLA SL')], links: [] };
    const loneScope = { ...scope, companies: ['SOLA SL'], companyNodes: [{ name: 'SOLA SL', nodeId: 'H:9' }], connectors: [], ownership: [], officersByCompany: { 'SOLA SL': [] } };
    const steps = draft({ graphData: lone, scope: loneScope, findingsByKey: new Map(), primarySubjectId: null });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ key: 'subject:H:9', source: 'graph', text: '0 cargos visibles en el mapa' });
  });

  it('falls back to the first pinned company when the primary subject is not on the map', () => {
    const [first] = draft({ primarySubjectId: 'H:404' });
    expect(first.key).toBe('subject:H:1');
  });

  it('does not mutate its inputs', () => {
    const before = JSON.stringify({ graph, scope, alfaFindings });
    draft();
    expect(JSON.stringify({ graph, scope, alfaFindings })).toBe(before);
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
