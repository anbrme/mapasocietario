import { describe, it, expect } from 'vitest';
import { mergeCargoIntoCompanyNode, undoCargoUnify } from './graphUnify';

// Build a fixture that represents the graph AFTER the existing officer-expansion
// path (expandOfficerV3 -> addOfficerToGraph) has run: the loaded COMPANY node,
// a separate OFFICER node keyed on the same entity name, the cargo target company
// nodes, and one `officer-company` link per (target, role) sourced at the officer
// node. mergeCargoIntoCompanyNode() must fold that officer node's cargo edges onto
// the company node (unify -> one node).
const baseGraph = () => ({
  nodes: [
    { id: 'company:acme', name: 'ACME SA', type: 'spanish-company-group' },
    { id: 'officer-acme-sa', name: 'ACME SA', type: 'officer', subtype: 'company' },
    { id: 'company:target-a', name: 'TARGET A SL', type: 'spanish-company-group' },
    { id: 'company:target-b', name: 'TARGET B SL', type: 'spanish-company-group' },
  ],
  links: [
    // cargo edges built by addOfficerToGraph (source = officer node)
    {
      id: 'officer-acme-sa-company:target-a-presidente',
      source: 'officer-acme-sa',
      target: 'company:target-a',
      type: 'officer-company',
      relationship: 'Presidente',
      category: 'nombramientos',
    },
    {
      id: 'officer-acme-sa-company:target-b-vocal',
      source: 'officer-acme-sa',
      target: 'company:target-b',
      type: 'officer-company',
      relationship: 'Vocal',
      category: 'ceses_dimisiones',
      fromPreviousName: 'TARGET B ANTIGUA SL',
    },
  ],
});

describe('mergeCargoIntoCompanyNode', () => {
  it('marks the company node unified and removes the separate officer node (one node)', () => {
    const out = mergeCargoIntoCompanyNode(baseGraph(), 'company:acme', 'officer-acme-sa');

    const company = out.nodes.find((n) => n.id === 'company:acme');
    expect(company.unified).toBe(true);
    expect(company.unifiedCargoCount).toBe(2);

    // The standalone officer node is gone — the entity is now ONE node.
    expect(out.nodes.find((n) => n.id === 'officer-acme-sa')).toBeUndefined();

    // Only one node per identity remains.
    expect(out.nodes.filter((n) => n.name === 'ACME SA')).toHaveLength(1);
  });

  it('re-attaches every cargo link to the company node, preserving styling flags', () => {
    const out = mergeCargoIntoCompanyNode(baseGraph(), 'company:acme', 'officer-acme-sa');

    const cargoLinks = out.links.filter((l) => l.type === 'officer-company');
    expect(cargoLinks).toHaveLength(2);
    // No link is still sourced at the removed officer node.
    expect(cargoLinks.every((l) => l.source === 'company:acme')).toBe(true);
    // Targets preserved.
    expect(cargoLinks.map((l) => l.target).sort()).toEqual(['company:target-a', 'company:target-b']);

    const active = cargoLinks.find((l) => l.target === 'company:target-a');
    expect(active.category).toBe('nombramientos'); // active -> green
    expect(active.relationship).toBe('Presidente');
    expect(active.unified).toBe(true);

    const ceased = cargoLinks.find((l) => l.target === 'company:target-b');
    expect(ceased.category).toBe('ceses_dimisiones'); // ceased -> red
    expect(ceased.fromPreviousName).toBe('TARGET B ANTIGUA SL'); // previous-name -> dashed
  });

  it('is idempotent — applying twice does not duplicate nodes or links', () => {
    const once = mergeCargoIntoCompanyNode(baseGraph(), 'company:acme', 'officer-acme-sa');
    const twice = mergeCargoIntoCompanyNode(once, 'company:acme', 'officer-acme-sa');

    expect(twice.nodes).toHaveLength(once.nodes.length);
    expect(twice.links).toHaveLength(once.links.length);
    const company = twice.nodes.find((n) => n.id === 'company:acme');
    expect(company.unified).toBe(true);
    expect(company.unifiedCargoCount).toBe(2); // not doubled
  });

  it('dedups against a cargo edge that already exists on the company node', () => {
    const g = baseGraph();
    // A pre-existing company-sourced edge to target-a with the same role.
    g.links.push({
      id: 'company:acme-company:target-a-presidente',
      source: 'company:acme',
      target: 'company:target-a',
      type: 'officer-company',
      relationship: 'Presidente',
      category: 'nombramientos',
      unified: true,
    });

    const out = mergeCargoIntoCompanyNode(g, 'company:acme', 'officer-acme-sa');
    const toTargetA = out.links.filter(
      (l) => l.type === 'officer-company' && l.target === 'company:target-a'
    );
    expect(toTargetA).toHaveLength(1); // not duplicated
  });

  it('handles d3-mutated links whose source/target are node objects', () => {
    const g = baseGraph();
    // Simulate react-force-graph replacing string ids with node object refs.
    const officerNode = g.nodes.find((n) => n.id === 'officer-acme-sa');
    const targetA = g.nodes.find((n) => n.id === 'company:target-a');
    g.links[0].source = officerNode;
    g.links[0].target = targetA;

    const out = mergeCargoIntoCompanyNode(g, 'company:acme', 'officer-acme-sa');
    const link = out.links.find((l) => l.target === 'company:target-a');
    expect(link.source).toBe('company:acme');
    expect(out.nodes.find((n) => n.id === 'officer-acme-sa')).toBeUndefined();
  });

  it('never creates a self-loop if a cargo target is the company itself', () => {
    const g = baseGraph();
    g.links.push({
      id: 'officer-acme-sa-company:acme-selfrole',
      source: 'officer-acme-sa',
      target: 'company:acme',
      type: 'officer-company',
      relationship: 'Self',
      category: 'nombramientos',
    });
    const out = mergeCargoIntoCompanyNode(g, 'company:acme', 'officer-acme-sa');
    expect(out.links.some((l) => l.source === 'company:acme' && l.target === 'company:acme')).toBe(false);
  });

  it('returns the graph unchanged when the company node does not exist', () => {
    const g = baseGraph();
    const out = mergeCargoIntoCompanyNode(g, 'company:missing', 'officer-acme-sa');
    expect(out.nodes.find((n) => n.id === 'officer-acme-sa')).toBeDefined();
    expect(out.nodes.some((n) => n.unified)).toBe(false);
  });

  it('tags each relocated cargo link with __cargoUnify = companyNodeId', () => {
    const out = mergeCargoIntoCompanyNode(baseGraph(), 'company:acme', 'officer-acme-sa');
    const cargoLinks = out.links.filter((l) => l.type === 'officer-company');
    expect(cargoLinks).toHaveLength(2);
    expect(cargoLinks.every((l) => l.__cargoUnify === 'company:acme')).toBe(true);
  });

  it('tags cargo-company nodes that exist ONLY for the unify, not independently-connected ones', () => {
    const g = baseGraph();
    // target-b already has an independent link (e.g. it owns another company),
    // so it existed in the graph on its own merits — it must NOT be tagged.
    g.nodes.push({ id: 'company:other', name: 'OTHER SL', type: 'spanish-company-group' });
    g.links.push({
      id: 'company:target-b-company:other-own',
      source: 'company:target-b',
      target: 'company:other',
      type: 'ownership',
      relationship: 'Socio único',
      category: 'socio_unico',
    });

    const out = mergeCargoIntoCompanyNode(g, 'company:acme', 'officer-acme-sa');

    const tA = out.nodes.find((n) => n.id === 'company:target-a');
    const tB = out.nodes.find((n) => n.id === 'company:target-b');
    // target-a is only reachable through the cargo edge → tagged.
    expect(tA.__cargoUnifyFor).toBe('company:acme');
    // target-b existed independently → NOT tagged.
    expect(tB.__cargoUnifyFor).toBeUndefined();
    // The company node itself is never tagged as a cargo-unify node.
    const acme = out.nodes.find((n) => n.id === 'company:acme');
    expect(acme.__cargoUnifyFor).toBeUndefined();
  });
});

describe('undoCargoUnify', () => {
  const unified = () => mergeCargoIntoCompanyNode(baseGraph(), 'company:acme', 'officer-acme-sa');

  it('removes exactly the tagged cargo links and the exclusively-cargo target nodes', () => {
    const out = undoCargoUnify(unified(), 'company:acme');

    // All __cargoUnify links gone.
    expect(out.links.some((l) => l.__cargoUnify === 'company:acme')).toBe(false);
    expect(out.links.filter((l) => l.type === 'officer-company')).toHaveLength(0);
    // Exclusively-cargo target nodes removed (they had no other links).
    expect(out.nodes.find((n) => n.id === 'company:target-a')).toBeUndefined();
    expect(out.nodes.find((n) => n.id === 'company:target-b')).toBeUndefined();
    // The company node survives.
    expect(out.nodes.find((n) => n.id === 'company:acme')).toBeDefined();
  });

  it('keeps a cargo company that is still connected elsewhere (never orphan-deletes)', () => {
    const g = baseGraph();
    g.nodes.push({ id: 'company:other', name: 'OTHER SL', type: 'spanish-company-group' });
    g.links.push({
      id: 'company:target-b-company:other-own',
      source: 'company:target-b',
      target: 'company:other',
      type: 'ownership',
      relationship: 'Socio único',
      category: 'socio_unico',
    });
    const merged = mergeCargoIntoCompanyNode(g, 'company:acme', 'officer-acme-sa');
    const out = undoCargoUnify(merged, 'company:acme');

    // target-a was exclusively cargo → removed.
    expect(out.nodes.find((n) => n.id === 'company:target-a')).toBeUndefined();
    // target-b still connected to company:other → retained.
    expect(out.nodes.find((n) => n.id === 'company:target-b')).toBeDefined();
    // Its independent link survives.
    expect(
      out.links.some((l) => l.id === 'company:target-b-company:other-own')
    ).toBe(true);
  });

  it('resets the company node: unified=false, drops unifiedCargoCount, restores cargoCount badge', () => {
    const merged = unified();
    const before = merged.nodes.find((n) => n.id === 'company:acme');
    expect(before.unified).toBe(true);
    expect(before.unifiedCargoCount).toBe(2);
    expect(before.cargoCount).toBe(0);

    const out = undoCargoUnify(merged, 'company:acme');
    const acme = out.nodes.find((n) => n.id === 'company:acme');
    expect(acme.unified).toBe(false);
    expect('unifiedCargoCount' in acme).toBe(false);
    // Amber "+N cargos" badge returns.
    expect(acme.cargoCount).toBe(2);
  });

  it('is idempotent — undoing twice yields the same nodes/links and stable cargoCount', () => {
    const once = undoCargoUnify(unified(), 'company:acme');
    const twice = undoCargoUnify(once, 'company:acme');
    expect(twice.nodes).toHaveLength(once.nodes.length);
    expect(twice.links).toHaveLength(once.links.length);
    const acme = twice.nodes.find((n) => n.id === 'company:acme');
    expect(acme.unified).toBe(false);
    expect(acme.cargoCount).toBe(2); // not clobbered to 0 on the second pass
    expect('unifiedCargoCount' in acme).toBe(false);
  });

  it('handles d3-mutated links whose source/target are node objects', () => {
    const merged = unified();
    // Simulate react-force-graph replacing string ids with node object refs.
    merged.links.forEach((l) => {
      if (l.__cargoUnify) {
        l.source = merged.nodes.find((n) => n.id === 'company:acme');
        l.target = merged.nodes.find((n) => n.id === l.target);
      }
    });
    const out = undoCargoUnify(merged, 'company:acme');
    expect(out.links.some((l) => l.__cargoUnify === 'company:acme')).toBe(false);
    expect(out.nodes.find((n) => n.id === 'company:target-a')).toBeUndefined();
  });

  it('is a no-op for a company that was never unified', () => {
    const g = baseGraph();
    const out = undoCargoUnify(g, 'company:acme');
    expect(out.links).toHaveLength(g.links.length);
    expect(out.nodes.find((n) => n.id === 'company:acme').unified).toBeFalsy();
  });
});

describe('mergeCargoIntoCompanyNode — a dissolved holder', () => {
  it('stamps holderDissolved on the relocated cargo edges when the company node is dissolved', () => {
    const graph = baseGraph();
    graph.nodes = graph.nodes.map((n) => (n.id === 'company:acme' ? { ...n, isDissolved: true } : n));
    const result = mergeCargoIntoCompanyNode(graph, 'company:acme', 'officer-acme-sa');
    const relocated = result.links.filter((l) => l.__cargoUnify === 'company:acme');
    expect(relocated.length).toBeGreaterThan(0);
    expect(relocated.every((l) => l.holderDissolved === true)).toBe(true);
  });

  it('leaves the edges of a live holder unstamped', () => {
    const result = mergeCargoIntoCompanyNode(baseGraph(), 'company:acme', 'officer-acme-sa');
    expect(result.links.some((l) => 'holderDissolved' in l)).toBe(false);
  });
});

// A LONG-LIVED officer node — the corporate-officer node the graph drew because
// this company holds a seat somewhere — can carry edges that are NOT cargo: an
// ownership edge to a company it is sole shareholder of, or an inbound ownership
// edge from its own owner. Folding that node into the company node must MOVE
// those edges to the company node, never drop them with the node.
describe('mergeCargoIntoCompanyNode — non-cargo edges on the officer node', () => {
  const graphWithOwnership = () => {
    const g = baseGraph();
    g.nodes.push({ id: 'company:owned', name: 'OWNED SL', type: 'spanish-company-group' });
    g.nodes.push({ id: 'company:parent', name: 'PARENT SL', type: 'spanish-company-group' });
    g.links.push({
      id: 'ownership-officer-acme-sa-company:owned',
      source: 'officer-acme-sa',
      target: 'company:owned',
      type: 'ownership',
      relationship: 'Socio único',
      category: 'socio_unico',
    });
    g.links.push({
      id: 'ownership-company:parent-officer-acme-sa',
      source: 'company:parent',
      target: 'officer-acme-sa',
      type: 'ownership',
      relationship: 'Socio único',
      category: 'socio_unico',
    });
    return g;
  };

  it('re-sources an outbound ownership edge at the company node', () => {
    const out = mergeCargoIntoCompanyNode(graphWithOwnership(), 'company:acme', 'officer-acme-sa');
    const owned = out.links.filter((l) => l.type === 'ownership' && l.target === 'company:owned');
    expect(owned).toHaveLength(1);
    expect(owned[0].source).toBe('company:acme');
    expect(owned[0].relationship).toBe('Socio único');
  });

  it('re-targets an inbound ownership edge at the company node', () => {
    const out = mergeCargoIntoCompanyNode(graphWithOwnership(), 'company:acme', 'officer-acme-sa');
    const parent = out.links.filter((l) => l.type === 'ownership' && l.source === 'company:parent');
    expect(parent).toHaveLength(1);
    expect(parent[0].target).toBe('company:acme');
  });

  it('leaves no link referencing the removed officer node', () => {
    const out = mergeCargoIntoCompanyNode(graphWithOwnership(), 'company:acme', 'officer-acme-sa');
    expect(
      out.links.some((l) => l.source === 'officer-acme-sa' || l.target === 'officer-acme-sa')
    ).toBe(false);
  });

  it('does not tag relocated non-cargo edges, so undo keeps the ownership', () => {
    const merged = mergeCargoIntoCompanyNode(graphWithOwnership(), 'company:acme', 'officer-acme-sa');
    const undone = undoCargoUnify(merged, 'company:acme');
    expect(undone.links.filter((l) => l.type === 'ownership')).toHaveLength(2);
  });

  it('drops a non-cargo edge that would become a self-loop on the company node', () => {
    const g = graphWithOwnership();
    g.links.push({
      id: 'ownership-officer-acme-sa-company:acme',
      source: 'officer-acme-sa',
      target: 'company:acme',
      type: 'ownership',
      relationship: 'Socio único',
      category: 'socio_unico',
    });
    const out = mergeCargoIntoCompanyNode(g, 'company:acme', 'officer-acme-sa');
    expect(out.links.some((l) => l.source === 'company:acme' && l.target === 'company:acme')).toBe(false);
  });

  it('does not duplicate a non-cargo edge the company node already carries', () => {
    const g = graphWithOwnership();
    g.links.push({
      id: 'ownership-company:acme-company:owned',
      source: 'company:acme',
      target: 'company:owned',
      type: 'ownership',
      relationship: 'Socio único',
      category: 'socio_unico',
    });
    const out = mergeCargoIntoCompanyNode(g, 'company:acme', 'officer-acme-sa');
    expect(
      out.links.filter((l) => l.type === 'ownership' && l.target === 'company:owned')
    ).toHaveLength(1);
  });

  it('handles d3-mutated non-cargo links whose endpoints are node objects', () => {
    const g = graphWithOwnership();
    g.links = g.links.map((l) =>
      l.type === 'ownership'
        ? { ...l, source: g.nodes.find((n) => n.id === (l.source.id || l.source)), target: g.nodes.find((n) => n.id === (l.target.id || l.target)) }
        : l
    );
    const out = mergeCargoIntoCompanyNode(g, 'company:acme', 'officer-acme-sa');
    const owned = out.links.filter((l) => l.type === 'ownership' && (l.target.id || l.target) === 'company:owned');
    expect(owned).toHaveLength(1);
    expect(owned[0].source).toBe('company:acme');
  });

  it('is idempotent for non-cargo edges', () => {
    const once = mergeCargoIntoCompanyNode(graphWithOwnership(), 'company:acme', 'officer-acme-sa');
    const twice = mergeCargoIntoCompanyNode(once, 'company:acme', 'officer-acme-sa');
    expect(twice.links).toHaveLength(once.links.length);
    expect(twice.nodes).toHaveLength(once.nodes.length);
  });
});

// Which cargo targets did THIS unify introduce? The link-shape heuristic gets it
// wrong when the unify runs from the officer side: there the cargo companies were
// already on the canvas (they ARE the officer search result) and their only edges
// ran through the officer node, so nothing marks them as independent. The caller
// knows the truth — it can hand over the node ids that existed beforehand.
describe('mergeCargoIntoCompanyNode — preexistingNodeIds', () => {
  it('never tags a cargo target that was already on the canvas', () => {
    const out = mergeCargoIntoCompanyNode(baseGraph(), 'company:acme', 'officer-acme-sa', {
      preexistingNodeIds: new Set(['company:acme', 'officer-acme-sa', 'company:target-a']),
    });
    expect(out.nodes.find((n) => n.id === 'company:target-a').__cargoUnifyFor).toBeUndefined();
    // target-b was NOT on the canvas before — this unify brought it in.
    expect(out.nodes.find((n) => n.id === 'company:target-b').__cargoUnifyFor).toBe('company:acme');
  });

  it('undo keeps the pre-existing cargo companies and drops only the ones it introduced', () => {
    const merged = mergeCargoIntoCompanyNode(baseGraph(), 'company:acme', 'officer-acme-sa', {
      preexistingNodeIds: new Set(['company:acme', 'officer-acme-sa', 'company:target-a']),
    });
    const undone = undoCargoUnify(merged, 'company:acme');
    expect(undone.nodes.map((n) => n.id)).toContain('company:target-a');
    expect(undone.nodes.map((n) => n.id)).not.toContain('company:target-b');
  });

  it('falls back to the link-shape heuristic when no set is given', () => {
    const out = mergeCargoIntoCompanyNode(baseGraph(), 'company:acme', 'officer-acme-sa');
    expect(out.nodes.find((n) => n.id === 'company:target-a').__cargoUnifyFor).toBe('company:acme');
  });
});
