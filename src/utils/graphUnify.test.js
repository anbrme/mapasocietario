import { describe, it, expect } from 'vitest';
import { mergeCargoIntoCompanyNode } from './graphUnify';

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
});
