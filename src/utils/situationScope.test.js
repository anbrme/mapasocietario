import { describe, expect, it, vi } from 'vitest';
import { extractSituationScope } from './relationshipScope';
import { draftWalkthrough } from './walkthrough/draftWalkthrough';
import { loadStepData } from './walkthrough/walkthroughLoader';
import { buildInvestigationDoc } from './investigationDoc';
import { buildReportHtml } from './relationshipReportHtml';

const graph = {
  nodes: [
    { id: 'director', type: 'officer', name: 'DIRECTOR TEST', userNote: { text: 'My working note', flag: 'none' } },
    { id: 'a', type: 'company', name: 'ALFA SL' },
    { id: 'b', type: 'company', name: 'BETA SL' },
    { id: 'sub', type: 'company', name: 'SUBSIDIARY SL' },
  ],
  links: [
    { source: { id: 'director' }, target: 'a', type: 'officer-company', category: 'nombramientos' },
    { source: 'b', target: 'director', type: 'officer-company', category: 'nombramientos' },
    { source: 'a', target: 'sub', type: 'ownership' },
  ],
};
describe('situation reports from directors', () => {
  it('includes the companies reached from a pinned director and their shared connections', () => {
    const scope = extractSituationScope(graph, String, new Set(['director']));
    expect(scope.companies).toEqual(['ALFA SL', 'BETA SL']);
    expect(scope.connectors.map(n => n.nodeId)).toEqual(['director']);
    expect(scope.officerNodes.map(n => n.nodeId)).toEqual(['director']);
    const steps = draftWalkthrough({ graphData: graph, scope });
    expect(steps.map(s => s.nodeId)).toEqual(['director', 'a', 'b']);
    expect(steps[0].source).toBe('graph');
  });
  it('preserves company-led subject scoping and supports graphs without saved pins', () => {
    expect(extractSituationScope(graph, String, new Set(['a'])).companies).toEqual(['ALFA SL']);
    expect(extractSituationScope(graph).companies).toHaveLength(3);
  });
  it('creates and exports an officer-only document without company/person enrichment requests', async () => {
    const graphData = { nodes: [graph.nodes[0]], links: [] };
    const scope = extractSituationScope(graphData, String, new Set(['director']));
    const steps = draftWalkthrough({ graphData, scope, lang: 'en' });
    const fetcher = vi.fn();
    await loadStepData({ ids: steps.map(s => s.nodeId), nodesById: new Map(graphData.nodes.map(n => [n.id, n])),
      fetchProfile: fetcher, fetchEvents: fetcher, fetchFindings: fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe('person');
    const doc = buildInvestigationDoc({ graphData, scope, steps, networkNote: 'Director working document' });
    expect(doc.counts.officers).toBe(1);
    const html = buildReportHtml(doc, { es: false });
    expect(html).toContain('DIRECTOR TEST');
    expect(html).toContain('My working note');
    expect(html).toContain('Director working document');
  });
  it('does not retain filtered-out directors or companies', () => {
    const scope = extractSituationScope({ nodes: [graph.nodes[1]], links: [] }, String, new Set(['director']));
    expect(scope.officerNodes).toEqual([]);
    expect(scope.companies).toEqual(['ALFA SL']);
  });
});
