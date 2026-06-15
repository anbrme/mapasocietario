// mapasocietario/test/relationship-scope.test.mjs
import assert from 'node:assert';
import test from 'node:test';
import { extractVisibleScope, isActiveOfficerCategory } from '../src/utils/relationshipScope.js';

const graph = {
  nodes: [
    { id: 'c:alpha', type: 'company', name: 'ALPHA SA' },
    { id: 'c:beta', type: 'company', name: 'BETA SA' },
    { id: 'o:juana', type: 'officer', name: 'JUANA DIR' },
    { id: 'o:paco', type: 'officer', name: 'PACO APO' },
  ],
  links: [
    { source: 'o:juana', target: 'c:alpha', type: 'officer-company' },
    { source: 'o:juana', target: 'c:beta', type: 'officer-company' },
    { source: 'o:paco', target: 'c:alpha', type: 'officer-company' },
  ],
};

test('lists visible companies', () => {
  const s = extractVisibleScope(graph);
  assert.deepStrictEqual(s.companies.sort(), ['ALPHA SA', 'BETA SA']);
});

test('maps visible officers per company (handles object refs too)', () => {
  const s = extractVisibleScope(graph);
  assert.deepStrictEqual(s.officersByCompany['ALPHA SA'].sort(), ['JUANA DIR', 'PACO APO']);
  assert.deepStrictEqual(s.officersByCompany['BETA SA'], ['JUANA DIR']);
});

test('counts companies, distinct officers, and shared people (>=2 companies)', () => {
  const s = extractVisibleScope(graph);
  assert.strictEqual(s.counts.companies, 2);
  assert.strictEqual(s.counts.officers, 2);
  assert.strictEqual(s.counts.sharedPeople, 1); // JUANA at both
});

test('tolerates link refs that are node objects', () => {
  const g2 = {
    nodes: graph.nodes,
    links: [{ source: { id: 'o:juana' }, target: { id: 'c:alpha' }, type: 'officer-company' }],
  };
  const s = extractVisibleScope(g2);
  assert.deepStrictEqual(s.officersByCompany['ALPHA SA'], ['JUANA DIR']);
});

test('empty graph yields empty scope', () => {
  const s = extractVisibleScope({ nodes: [], links: [] });
  assert.deepStrictEqual(s.companies, []);
  assert.strictEqual(s.counts.companies, 0);
});

test('subjectIds limits subjects to the given companies (excludes others)', () => {
  // Only ALPHA is a subject; BETA is context (e.g. an auto-pulled subsidiary).
  const s = extractVisibleScope(graph, (x) => x, new Set(['c:alpha']));
  assert.deepStrictEqual(s.companies, ['ALPHA SA']);
  assert.deepStrictEqual(s.officersByCompany['ALPHA SA'].sort(), ['JUANA DIR', 'PACO APO']);
  assert.strictEqual(s.officersByCompany['BETA SA'], undefined);
  assert.strictEqual(s.counts.companies, 1);
  assert.strictEqual(s.counts.sharedPeople, 0); // JUANA only counts at ALPHA now
});

test('connectors lists officers at >=2 subject companies with detail', () => {
  const s = extractVisibleScope(graph);
  assert.strictEqual(s.connectors.length, 1);
  const c = s.connectors[0];
  assert.strictEqual(c.name, 'JUANA DIR');
  assert.strictEqual(c.type, 'individual');
  assert.deepStrictEqual(c.companies.sort(), ['ALPHA SA', 'BETA SA']);
  assert.strictEqual(c.nodeId, 'o:juana');
});

test('connectors marks entity officers by subtype', () => {
  const g = {
    nodes: [
      { id: 'c:a', type: 'company', name: 'A SA' },
      { id: 'c:b', type: 'company', name: 'B SA' },
      { id: 'o:holding', type: 'officer', subtype: 'company', name: 'HOLDING SL' },
    ],
    links: [
      { source: 'o:holding', target: 'c:a', type: 'officer-company', category: 'nombramientos' },
      { source: 'o:holding', target: 'c:b', type: 'officer-company', category: 'ceses_dimisiones' },
    ],
  };
  const s = extractVisibleScope(g);
  assert.strictEqual(s.connectors[0].type, 'entity');
  assert.strictEqual(s.connectors[0].status, 'mixed'); // active at A, ceased at B
});

test('sharedNodeIds is the set of connector node ids (normalized)', () => {
  const s = extractVisibleScope(graph);
  assert.deepStrictEqual([...s.sharedNodeIds], ['o:juana']);
});

test('ownership extracts owner -> owned with lost flag', () => {
  const g = {
    nodes: [
      { id: 'c:parent', type: 'company', name: 'PARENT SA' },
      { id: 'c:sub', type: 'company', name: 'SUB SL' },
    ],
    links: [
      { source: 'c:parent', target: 'c:sub', type: 'ownership', category: 'socio_unico' },
    ],
  };
  const s = extractVisibleScope(g);
  assert.deepStrictEqual(s.ownership, [{ owner: 'PARENT SA', owned: 'SUB SL', lost: false }]);
});

test('isActiveOfficerCategory recognises appointments', () => {
  assert.strictEqual(isActiveOfficerCategory('nombramientos'), true);
  assert.strictEqual(isActiveOfficerCategory('ceses_dimisiones'), false);
});
