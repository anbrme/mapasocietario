import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { collapseExpansion, diffExpansion, graphKeys } from '../utils/expansionCollapse';
import { officerQueryNames, fetchOfficerRecordsForNames } from '../utils/officerVariantLookup';

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

// A node the user merged carries every spelling in `nameVariants`. BORME has
// no person id, so a seat filed under the absorbed spelling is only reachable
// by asking for that spelling too. Before this, expandOfficerNode queried the
// survivor's name alone and the canvas drew less than its own preview panel.
//
// Observation point is buildCompanyAliasMap: it receives the set of company
// names derived from the COMBINED records, so it proves the absorbed
// spelling's companies reached the graph-building step. The node/link
// rendering itself is covered by the ownership suite below, whose setGraphData
// stub likewise does not run the updater.
describe('expanding a merged officer node', () => {
  const runExpansion = async (node, seatsByName) => {
    const asked = [];
    let companiesForAliasMap = null;
    const deps = {
      useCallback: callback => callback,
      setIsLoading: vi.fn(),
      setError: vi.fn(),
      setExpandProgress: vi.fn(),
      setGraphData: vi.fn(),
      normalizeCompanyName: name => name,
      companyNameToId: name => name,
      showShareholders: false,
      addShareholdersForCompany: vi.fn(),
      addOwnedCompaniesForEntity: vi.fn(),
      enrichLinksWithEventDates: vi.fn(),
      extractOfficersFromText: vi.fn(),
      isCompanyOfficer: vi.fn(),
      viewportCenter: { x: 0, y: 0 },
      officersPerCompany: 10,
      officerQueryNames,
      fetchOfficerRecordsForNames,
      setCorrectionsSnackbar: vi.fn(),
      text: { addCompanyError: msg => msg, expandedVariantsToast: (n, name) => `${name}:${n}` },
      buildCompanyAliasMap: async names => { companiesForAliasMap = names; return new Map(); },
      BORME_SECTION_NAMES: new Set(),
      spanishCompaniesService: {
        expandOfficerV3: async queryName => {
          asked.push(queryName);
          return { success: true, officers: seatsByName[queryName] || [] };
        },
      },
    };
    const expand = loadCallback('expandOfficerNode', "  // Load a company's OWN registry record", deps);
    const found = await expand(node);
    return { asked, found, deps, companiesForAliasMap };
  };

  const seat = (company, date) => ({ company_name: company, specific_role: 'ADM', date });

  it('queries every merged spelling, not just the surviving one', async () => {
    const { asked, found } = await runExpansion(
      {
        id: 'O', name: 'LOPEZ MIRANDA JUAN',
        nameVariants: ['LOPEZ MIRANDA JUAN', 'LOPEZ-MIRANDA JUAN'],
      },
      {
        'LOPEZ MIRANDA JUAN': [seat('ACME SL', '2020-01-01')],
        'LOPEZ-MIRANDA JUAN': [seat('OTRA SL', '2021-02-02')],
      },
    );
    expect(asked).toEqual(['LOPEZ MIRANDA JUAN', 'LOPEZ-MIRANDA JUAN']);
    expect(found).toBe(true);
  });

  it('carries the company only the absorbed spelling knows about into the build', async () => {
    const { companiesForAliasMap } = await runExpansion(
      { id: 'O', name: 'A', nameVariants: ['A', 'B'] },
      { A: [seat('ONLY UNDER A SL', '2020-01-01')], B: [seat('ONLY UNDER B SL', '2021-01-01')] },
    );
    expect([...companiesForAliasMap]).toEqual(
      expect.arrayContaining(['ONLY UNDER A SL', 'ONLY UNDER B SL']),
    );
  });

  it('expands a node whose seats exist ONLY under the absorbed spelling', async () => {
    // The survivor returns nothing at all: the old code reported "nothing
    // found" for a person whose whole record sits under the other spelling.
    const { found, companiesForAliasMap } = await runExpansion(
      { id: 'O', name: 'SURVIVOR', nameVariants: ['SURVIVOR', 'ABSORBED'] },
      { SURVIVOR: [], ABSORBED: [seat('HIDDEN SL', '2020-01-01')] },
    );
    expect(found).toBe(true);
    expect([...companiesForAliasMap]).toContain('HIDDEN SL');
  });

  it('discloses that the expansion spanned more than one spelling', async () => {
    const { deps } = await runExpansion(
      { id: 'O', name: 'A', nameVariants: ['A', 'B'] },
      { A: [seat('X SL', '2020-01-01')], B: [seat('Y SL', '2021-01-01')] },
    );
    expect(deps.setCorrectionsSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'A:2' }),
    );
  });

  it('claims nothing when only one spelling actually returned a seat', async () => {
    const { deps } = await runExpansion(
      { id: 'O', name: 'A', nameVariants: ['A', 'B'] },
      { A: [seat('X SL', '2020-01-01')], B: [] },
    );
    expect(deps.setCorrectionsSnackbar).not.toHaveBeenCalled();
  });

  it('still expands an unmerged node with a single request', async () => {
    const { asked, deps } = await runExpansion(
      { id: 'O', name: 'SOLO NAME' },
      { 'SOLO NAME': [seat('X SL', '2020-01-01')] },
    );
    expect(asked).toEqual(['SOLO NAME']);
    expect(deps.setCorrectionsSnackbar).not.toHaveBeenCalled();
  });

  it('reports nothing found when no spelling has a seat', async () => {
    const { found } = await runExpansion(
      { id: 'O', name: 'A', nameVariants: ['A', 'B'] }, { A: [], B: [] },
    );
    expect(found).toBe(false);
  });
});

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
      // The real helpers, so this exercises the actual variant fan-out.
      officerQueryNames,
      fetchOfficerRecordsForNames,
      setCorrectionsSnackbar: vi.fn(),
      extractOfficersFromText: vi.fn(),
      isCompanyOfficer: vi.fn(),
      viewportCenter: { x: 0, y: 0 },
      officersPerCompany: 10,
      text: { addCompanyError: msg => msg, expandedVariantsToast: (n, name) => `${name}:${n}` },
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
