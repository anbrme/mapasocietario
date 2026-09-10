import { describe, expect, it } from 'vitest';
import { extractVisibleScope } from './relationshipScope';

const graph = {
  nodes: [
    { id: 'c1', type: 'company', name: 'ALFA SL' },
    { id: 'c2', type: 'company', name: 'BETA SL' },
    { id: 'o1', type: 'officer', name: 'GARCIA LOPEZ ANA' },
  ],
  links: [
    { source: 'c1', target: 'o1', category: 'nombramiento', relationship: 'Administrador' },
    { source: 'c2', target: 'o1', category: 'nombramiento', relationship: 'Administrador' },
  ],
};
const subjects = new Set(['c1', 'c2']);

describe('extractVisibleScope', () => {
  it('emits a node id alongside each company name, in the same order', () => {
    const scope = extractVisibleScope(graph, x => x, subjects);

    expect(scope.companies).toEqual(['ALFA SL', 'BETA SL']);
    expect(scope.companyNodes).toEqual([
      { name: 'ALFA SL', nodeId: 'c1' },
      { name: 'BETA SL', nodeId: 'c2' },
    ]);
  });

  it('keeps distinct node ids for two companies that share a name', () => {
    const dupes = {
      nodes: [
        { id: 'c1', type: 'company', name: 'ALFA SL' },
        { id: 'c2', type: 'company', name: 'ALFA SL' },
      ],
      links: [],
    };
    const scope = extractVisibleScope(dupes, x => x, new Set(['c1', 'c2']));

    expect(scope.companyNodes.map(c => c.nodeId)).toEqual(['c1', 'c2']);
  });

  it('still surfaces connectors with their node id', () => {
    const scope = extractVisibleScope(graph, x => x, subjects);

    expect(scope.connectors).toHaveLength(1);
    expect(scope.connectors[0].nodeId).toBe('o1');
  });
});
