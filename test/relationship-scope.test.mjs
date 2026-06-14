// mapasocietario/test/relationship-scope.test.mjs
import assert from 'node:assert';
import test from 'node:test';
import { extractVisibleScope } from '../src/utils/relationshipScope.js';

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
