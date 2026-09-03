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
 * The unify also runs in the OTHER direction — double-clicking a corporate officer
 * node loads that entity's own registry record and folds the officer node into it —
 * and there the officer node is long-lived, so it can carry edges that are not
 * cargo (an ownership edge in either direction). Those are re-pointed at the company
 * node too, untagged, since the entity is the same node now.
 *
 * Pure & idempotent: applying it twice yields the same `{nodes, links}` (after the
 * first pass the officer node is gone, so the second pass is a no-op).
 */
// The identity rule that decides WHICH cargo rows belong to a company node —
// isSameUnifiableEntity — lives in ./companyName next to entityNameKey: it is a
// pure name predicate, and the API service needs it without pulling in this
// graph-mutation module.

const idOf = (endpoint) =>
  endpoint && typeof endpoint === 'object' ? endpoint.id : endpoint;

const roleKey = (link) => (link && link.relationship ? String(link.relationship) : '').toLowerCase();

/**
 * @param {{nodes: Array, links: Array}} graphData - current graph (post officer-expansion).
 * @param {string} companyNodeId - id of the loaded COMPANY node to unify onto.
 * @param {string} officerNodeId - id of the separate OFFICER node built by addOfficerToGraph.
 * @param {{preexistingNodeIds?: Set<string>}} [options] - `preexistingNodeIds`: the node
 *   ids already on the canvas before this unify started adding to it. Cargo targets in
 *   that set are never tagged, so undo cannot delete a company the user already had.
 *   Omitted, the link-shape heuristic below decides.
 * @returns {{nodes: Array, links: Array}} new graph with cargo edges re-attached to the company node.
 */
export function mergeCargoIntoCompanyNode(graphData, companyNodeId, officerNodeId, options) {
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

  // Everything that does NOT touch the officer node is kept verbatim. The
  // officer node's own edges are re-created below: cargo edges as relocated
  // cargo, everything else (ownership in either direction) re-pointed at the
  // company node — same entity, so an edge that reached the officer node must
  // reach the company node, never vanish with the node.
  const keptLinks = links.filter(
    (l) => idOf(l.source) !== officerNodeId && idOf(l.target) !== officerNodeId
  );

  // Non-cargo edges on the officer node. A cargo edge that pointed back at the
  // company itself is NOT in here (it is a self-loop and stays dropped).
  const officerOtherLinks = links.filter(
    (l) =>
      (idOf(l.source) === officerNodeId || idOf(l.target) === officerNodeId) &&
      !(l.type === 'officer-company' && idOf(l.source) === officerNodeId)
  );

  // Seed dedup with cargo edges already sourced at the company node so a repeat
  // unify (or a prior manual link) is not duplicated.
  const seen = new Set();
  keptLinks.forEach((l) => {
    if (l.type === 'officer-company' && idOf(l.source) === companyNodeId) {
      seen.add(`${idOf(l.target)}::${roleKey(l)}`);
    }
  });

  // The company holds these seats; if it is dissolved, none of them is current.
  const holderDissolved = !!companyNode.isDissolved;

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
      ...(holderDissolved && { holderDissolved: true }),
      // Tag so undoCargoUnify can find exactly what this pass added/relocated.
      __cargoUnify: companyNodeId,
    });
  });

  // Re-point the non-cargo edges. They are deliberately left UNTAGGED: undo
  // restores the amber affordance but never brings the officer node back, so a
  // tagged ownership edge would be deleted with nothing left to carry it. The
  // ownership belongs to the entity, and the entity is now the company node.
  const relocatedOther = [];
  const edgeKey = (l, sourceId, targetId) =>
    `${l.type || ''}::${sourceId}::${targetId}::${roleKey(l)}`;
  const seenOther = new Set(
    keptLinks.map((l) => edgeKey(l, idOf(l.source), idOf(l.target)))
  );
  officerOtherLinks.forEach((l) => {
    const isOutbound = idOf(l.source) === officerNodeId;
    const otherEnd = isOutbound ? l.target : l.source;
    // Both ends resolve to the company node — the entity cannot own itself.
    if (idOf(otherEnd) === companyNodeId) return;
    const sourceId = isOutbound ? companyNodeId : idOf(l.source);
    const targetId = isOutbound ? idOf(l.target) : companyNodeId;
    const key = edgeKey(l, sourceId, targetId);
    if (seenOther.has(key)) return;
    seenOther.add(key);
    const suffix = (l.type || 'link').replace(/[^a-z0-9]/gi, '') || 'link';
    relocatedOther.push({
      ...l,
      id: `${suffix}-${sourceId}-${targetId}`,
      ...(isOutbound ? { source: companyNodeId } : { target: companyNodeId }),
    });
  });

  // Which cargo targets did THIS unify introduce? Only those may be tagged, since
  // undo deletes what it tagged. When the caller passes the ids that were on the
  // canvas beforehand, that answer is exact. The link-shape fallback — "reachable
  // only through the officer node" — is right when the officer node and its cargo
  // nodes were built by the unify itself, but wrong when the unify runs from the
  // officer side: there the cargo companies ARE the officer search result, and
  // their only edges run through the officer node, so nothing marks them.
  const preexistingNodeIds = options && options.preexistingNodeIds;
  const cargoTargetIds = new Set(officerCargoLinks.map((l) => idOf(l.target)));
  const independentlyConnected = new Set();
  if (preexistingNodeIds) {
    cargoTargetIds.forEach((id) => {
      if (preexistingNodeIds.has(id)) independentlyConnected.add(id);
    });
  } else {
    keptLinks.forEach((l) => {
      const s = idOf(l.source);
      const t = idOf(l.target);
      if (cargoTargetIds.has(s)) independentlyConnected.add(s);
      if (cargoTargetIds.has(t)) independentlyConnected.add(t);
    });
  }

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

  return { nodes: newNodes, links: [...keptLinks, ...relocated, ...relocatedOther] };
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
