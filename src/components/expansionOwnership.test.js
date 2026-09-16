import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { collapseExpansion, diffExpansion, graphKeys } from '../utils/expansionCollapse';

// Exercise the component's real async loaders without mounting the canvas.
// Only the synchronous board/seat insertion is stubbed: this regression is
// about when their ownership requests finish relative to recording the diff.
const source = readFileSync(new URL('./SpanishCompanyNetworkGraph.jsx', import.meta.url), 'utf8');
const loadCallback = (name, endMarker, dependencies) => {
  const start = source.indexOf(`  const ${name} = useCallback(`);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Missing callback: ${name}`);
  return new Function(...Object.keys(dependencies), `${source.slice(start, end)}\nreturn ${name};`)(
    ...Object.values(dependencies)
  );
};
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

describe('expansion ownership completion', () => {
  it.each(['company', 'officer'])('records delayed ownership companies before %s expansion can collapse', async kind => {
    const root = { id: 'ROOT', name: 'ROOT', expanded: true };
    let graph = { nodes: [root], links: [] };
    const before = graphKeys(graph);
    const incoming = deferred();
    const outgoing = deferred();
    const append = ids => {
      graph = {
        nodes: [...graph.nodes, ...ids.map(id => ({ id }))],
        links: [...graph.links, ...ids.map(id => ({ source: root.id, target: id, type: 'ownership' }))],
      };
    };
    const deps = {
      useCallback: callback => callback,
      setIsLoading: vi.fn(),
      setError: vi.fn(),
      setExpandProgress: vi.fn(),
      setGraphData: () => append(['BOARD1', 'BOARD2']),
      normalizeCompanyName: name => name,
      companyNameToId: name => name,
      showShareholders: true,
      addShareholdersForCompany: vi.fn(() => incoming.promise.then(() => {
        // A second ownership link arriving later must also belong to this
        // expansion, or collapse would treat BOARD1 as claimed elsewhere.
        graph.links.push({ source: root.id, target: 'BOARD1', type: 'ownership', category: 'socio_anterior' });
      })),
      addOwnedCompaniesForEntity: vi.fn(() => outgoing.promise.then(() => {
        append(Array.from({ length: 50 }, (_, i) => `OWNED${i}`));
      })),
      enrichLinksWithEventDates: vi.fn(),
      extractOfficersFromText: vi.fn(),
      isCompanyOfficer: vi.fn(),
      viewportCenter: { x: 0, y: 0 },
      officersPerCompany: 10,
      text: { addCompanyError: msg => msg },
      spanishCompaniesService: {
        expandOfficerV3: async () => ({ success: true, officers: [{ company_name: 'ROOT' }] }),
      },
      buildCompanyAliasMap: async () => new Map(),
      BORME_SECTION_NAMES: new Set(),
    };
    const loader = kind === 'company'
      ? loadCallback('addCompanyWithOfficersToGraph', '  // Add officer to graph with associated companies', deps)
      : loadCallback('expandOfficerNode', "  // Load a company's OWN registry record", deps);
    let record;
    const loading = (kind === 'company' ? loader([{ name: 'ROOT' }], root) : loader(root))
      .then(() => { record = diffExpansion(root.id, before, graph); });

    await vi.waitFor(() => {
      expect(deps.addShareholdersForCompany).toHaveBeenCalledOnce();
      expect(deps.addOwnedCompaniesForEntity).toHaveBeenCalledOnce();
    });
    outgoing.resolve();
    await outgoing.promise;
    await Promise.resolve();
    const finishedBeforeBothDirections = !!record;
    incoming.resolve();
    await loading;

    expect(deps.enrichLinksWithEventDates).toHaveBeenCalledWith(['ROOT']);
    expect(finishedBeforeBothDirections).toBe(false);
    expect(record.addedNodeIds).toHaveLength(52);
    const collapsed = collapseExpansion(graph, record);
    expect(collapsed.removedNodeIds).toHaveLength(52);
    expect(collapsed.graphData).toEqual({ nodes: [root], links: [] });
  });
});
