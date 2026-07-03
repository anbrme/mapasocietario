/**
 * Pure graph transform for the company⇄cargo UNIFY feature.
 *
 * A corporate entity shows up twice in the graph: once as a COMPANY node (its own
 * board/subsidiaries) and, when it also holds seats elsewhere, as a separate
 * OFFICER node built by the existing reverse-lookup path
 * (`expandOfficerV3` → `addOfficerToGraph`). That path creates an `officer` node
 * (id = `officerIdFor(name)`) plus one `officer-company` link per (cargo company,
 * role), sourced at that officer node.
 *
 * `mergeCargoIntoCompanyNode` folds that officer node's cargo edges onto the
 * COMPANY node so the entity becomes ONE node marked `unified: true` — reusing the
 * exact links (and therefore the exact role-label + active/ceased styling) the
 * graph already produced, just re-sourced from the company node.
 *
 * Design note (reuse contract): callers first run the existing
 * `addOfficerToGraph(officers, name)` so the officer node + cargo nodes + links are
 * already present in `graphData`; this helper then RELOCATES those links and drops
 * the now-redundant officer node. The cargo target company nodes are left in place.
 *
 * Pure & idempotent: applying it twice yields the same `{nodes, links}` (after the
 * first pass the officer node is gone, so the second pass is a no-op).
 */

const idOf = (endpoint) =>
  endpoint && typeof endpoint === 'object' ? endpoint.id : endpoint;

const roleKey = (link) => (link && link.relationship ? String(link.relationship) : '').toLowerCase();

/**
 * @param {{nodes: Array, links: Array}} graphData - current graph (post officer-expansion).
 * @param {string} companyNodeId - id of the loaded COMPANY node to unify onto.
 * @param {string} officerNodeId - id of the separate OFFICER node built by addOfficerToGraph.
 * @returns {{nodes: Array, links: Array}} new graph with cargo edges re-attached to the company node.
 */
export function mergeCargoIntoCompanyNode(graphData, companyNodeId, officerNodeId) {
  const nodes = Array.isArray(graphData && graphData.nodes) ? graphData.nodes : [];
  const links = Array.isArray(graphData && graphData.links) ? graphData.links : [];

  const companyNode = nodes.find((n) => n.id === companyNodeId);
  // No company node to unify onto — return a shallow copy unchanged (defensive).
  if (!companyNode) {
    return { nodes: [...nodes], links: [...links] };
  }

  // The officer node's cargo edges (skip any accidental self-loop back to company).
  const officerCargoLinks = links.filter(
    (l) =>
      l.type === 'officer-company' &&
      idOf(l.source) === officerNodeId &&
      idOf(l.target) !== companyNodeId
  );

  // Everything that does NOT touch the officer node is kept verbatim. This drops
  // the officer node's own edges (cargo edges are re-created below; any officer
  // ownership edges are intentionally discarded with the node).
  const keptLinks = links.filter(
    (l) => idOf(l.source) !== officerNodeId && idOf(l.target) !== officerNodeId
  );

  // Seed dedup with cargo edges already sourced at the company node so a repeat
  // unify (or a prior manual link) is not duplicated.
  const seen = new Set();
  keptLinks.forEach((l) => {
    if (l.type === 'officer-company' && idOf(l.source) === companyNodeId) {
      seen.add(`${idOf(l.target)}::${roleKey(l)}`);
    }
  });

  const relocated = [];
  officerCargoLinks.forEach((l) => {
    const targetId = idOf(l.target);
    const rel = roleKey(l);
    const key = `${targetId}::${rel}`;
    if (seen.has(key)) return;
    seen.add(key);
    const suffix = rel.replace(/[^a-z0-9]/g, '') || 'unknownpos';
    relocated.push({
      ...l,
      id: `${companyNodeId}-${targetId}-${suffix}`,
      source: companyNodeId,
      target: targetId,
      unified: true,
      // Tag so undoCargoUnify can find exactly what this pass added/relocated.
      __cargoUnify: companyNodeId,
    });
  });

  // A cargo target company "existed independently" if it appears in a link that
  // does NOT touch the officer node (keptLinks). Those we must NOT tag — undo must
  // never delete them. Cargo targets that are reachable ONLY through the officer's
  // cargo edges were introduced solely for this unify → tag them.
  const cargoTargetIds = new Set(officerCargoLinks.map((l) => idOf(l.target)));
  const independentlyConnected = new Set();
  keptLinks.forEach((l) => {
    const s = idOf(l.source);
    const t = idOf(l.target);
    if (cargoTargetIds.has(s)) independentlyConnected.add(s);
    if (cargoTargetIds.has(t)) independentlyConnected.add(t);
  });

  const newNodes = nodes
    .filter((n) => n.id !== officerNodeId)
    .map((n) => {
      if (n.id === companyNodeId) {
        return {
          ...n,
          unified: true,
          unifiedCargoCount: (n.unifiedCargoCount || 0) + relocated.length,
          // Clear the pending affordance count — it's now realised as edges.
          cargoCount: 0,
        };
      }
      if (
        n.id !== companyNodeId &&
        cargoTargetIds.has(n.id) &&
        !independentlyConnected.has(n.id)
      ) {
        return { ...n, __cargoUnifyFor: companyNodeId };
      }
      return n;
    });

  return { nodes: newNodes, links: [...keptLinks, ...relocated] };
}

/**
 * Reverse `mergeCargoIntoCompanyNode` for one company: remove the relocated cargo
 * edges (tagged `__cargoUnify === companyNodeId`), drop the cargo-company nodes that
 * were introduced solely for this unify (tagged `__cargoUnifyFor === companyNodeId`)
 * BUT ONLY if they have no other remaining links, and restore the company node so the
 * amber "+N cargos" affordance returns.
 *
 * Pure & idempotent: after the first pass there are no `__cargoUnify` links and the
 * company node is no longer `unified`, so a second pass is a no-op (and cargoCount is
 * not clobbered).
 *
 * @param {{nodes: Array, links: Array}} graphData
 * @param {string} companyNodeId
 * @returns {{nodes: Array, links: Array}} new graph with the unify reversed.
 */
export function undoCargoUnify(graphData, companyNodeId) {
  const nodes = Array.isArray(graphData && graphData.nodes) ? graphData.nodes : [];
  const links = Array.isArray(graphData && graphData.links) ? graphData.links : [];

  // 1) Drop exactly the links this unify relocated onto the company node.
  const keptLinks = links.filter((l) => l.__cargoUnify !== companyNodeId);

  // 2) Which node ids still have at least one remaining link?
  const stillConnected = new Set();
  keptLinks.forEach((l) => {
    stillConnected.add(idOf(l.source));
    stillConnected.add(idOf(l.target));
  });

  // 3) Remove cargo-only nodes introduced by THIS unify, but never orphan-delete a
  //    node that is still connected somewhere else.
  const keptNodes = nodes.filter(
    (n) => !(n.__cargoUnifyFor === companyNodeId && !stillConnected.has(n.id))
  );

  // 4) Restore the company node — only while it is still marked unified, so repeat
  //    calls don't overwrite the restored cargoCount with 0.
  const newNodes = keptNodes.map((n) => {
    if (n.id !== companyNodeId || !n.unified) return n;
    const restored = {
      ...n,
      unified: false,
      // Bring back the amber "+N cargos" badge.
      cargoCount: n.unifiedCargoCount || 0,
    };
    delete restored.unifiedCargoCount;
    return restored;
  });

  return { nodes: newNodes, links: keptLinks };
}

export default mergeCargoIntoCompanyNode;
