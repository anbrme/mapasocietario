/**
 * Keeps force-graph links attached to nodes after an immutable node update.
 *
 * Once the simulation starts, force-graph (d3-force) rewrites `link.source` /
 * `link.target` from ids into live node OBJECT references, and it only re-resolves
 * an endpoint that is still a plain id:
 *
 *   if (typeof link.source !== "object") link.source = find(nodeById, link.source)
 *
 * So any transform that REPLACES a node object (`{ ...node, userNote }`) while
 * reusing the existing links leaves those links pointing at the previous object,
 * which is no longer part of the simulation. The node then drags away while its
 * edges stay frozen at the old position — the "detached edges" symptom.
 *
 * Rebinding the affected endpoints back to plain ids makes d3-force re-resolve
 * them against the new node objects, which is the same contract `mergeNodes`
 * already relies on in the graph component.
 */

const isNodeRef = endpoint => endpoint !== null && typeof endpoint === 'object';

const endpointId = endpoint => (isNodeRef(endpoint) ? endpoint.id : endpoint);

/**
 * @param {Array} links - current links (endpoints may be ids or node objects).
 * @param {Iterable<string|number>} changedNodeIds - ids whose node object was replaced.
 * @returns {Array} same array when nothing needed rebinding, otherwise a new array
 *   where the affected endpoints carry the node id instead of the stale object.
 */
export const rebindLinkEndpoints = (links, changedNodeIds) => {
  const safeLinks = Array.isArray(links) ? links : [];
  const changed = new Set();
  for (const id of changedNodeIds || []) {
    if (id != null) changed.add(String(id));
  }
  if (changed.size === 0 || safeLinks.length === 0) return safeLinks;

  let didRebind = false;
  const nextLinks = safeLinks.map(link => {
    const isSourceStale = isNodeRef(link?.source) && changed.has(String(link.source.id));
    const isTargetStale = isNodeRef(link?.target) && changed.has(String(link.target.id));
    if (!isSourceStale && !isTargetStale) return link;

    didRebind = true;
    return {
      ...link,
      // Reuse the id verbatim (not stringified) so d3 can look it up in its map.
      source: isSourceStale ? endpointId(link.source) : link.source,
      target: isTargetStale ? endpointId(link.target) : link.target,
    };
  });

  return didRebind ? nextLinks : safeLinks;
};

/**
 * Same fix for the common `nodes.map(...)` shape, where the replaced nodes are
 * whichever entries lost object identity. Keeps callers from having to track the
 * changed ids by hand.
 *
 * @param {Array} links - current links.
 * @param {Array} prevNodes - node array before the update.
 * @param {Array} nextNodes - node array returned by `prevNodes.map(...)`.
 * @returns {Array} links with the replaced nodes' endpoints rebound to ids.
 */
export const rebindLinksAfterNodeUpdate = (links, prevNodes, nextNodes) => {
  const before = Array.isArray(prevNodes) ? prevNodes : [];
  const after = Array.isArray(nextNodes) ? nextNodes : [];
  const replacedNodeIds = after
    .filter((node, index) => node !== before[index])
    .map(node => node?.id);

  return rebindLinkEndpoints(links, replacedNodeIds);
};
