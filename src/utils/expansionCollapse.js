// Reversible node expansions. Expanding a node appends nodes and links to the
// graph and flags the node; nothing recorded what it brought in, so nothing
// could take it back. diffExpansion records exactly that, and
// collapseExpansion removes it again — sparing anything the user claimed
// (pinned, noted, selected, itself expanded) and anything a later expansion
// attached to. Pure: no mutation of inputs; surviving node objects keep their
// identity so the canvas keeps their positions.

const normalizeId = id => (id == null ? '' : String(id));

// d3-force rewrites link.source/target into node objects after the first render.
const endpointId = endpoint => (endpoint && typeof endpoint === 'object' ? endpoint.id : endpoint);

/** Identity of a link, stable across the d3 endpoint rewrite. */
export const linkKey = link => [
  normalizeId(endpointId(link.source)),
  normalizeId(endpointId(link.target)),
  link.type || '',
  link.category || link.relationship || '',
].join('|');

/** The node ids and link keys present in a graph, taken BEFORE an expansion. */
export const graphKeys = graphData => ({
  nodeIds: new Set((graphData?.nodes || []).map(n => normalizeId(n.id))),
  linkKeys: new Set((graphData?.links || []).map(linkKey)),
});

/**
 * What the expansion of `nodeId` added: the graph AFTER, minus the keys BEFORE.
 * @returns {{ nodeId: string, addedNodeIds: string[], addedLinkKeys: string[] }}
 */
export const diffExpansion = (nodeId, beforeKeys, afterGraph) => ({
  nodeId: normalizeId(nodeId),
  addedNodeIds: (afterGraph?.nodes || [])
    .map(n => normalizeId(n.id))
    .filter(id => !beforeKeys.nodeIds.has(id)),
  addedLinkKeys: [...new Set((afterGraph?.links || [])
    .map(linkKey)
    .filter(key => !beforeKeys.linkKeys.has(key)))],
});

/**
 * True when the expansion brought nothing onto the canvas: no node and no
 * link. On the canvas that outcome looks exactly like a failed fetch, so the
 * caller says so in words. A new link to a node already present still counts
 * as a finding.
 */
export const isEmptyExpansion = record =>
  !record || ((record.addedNodeIds || []).length === 0 && (record.addedLinkKeys || []).length === 0);

/**
 * Remove what `record` added. A node it added stays when it is protected or
 * when any of its current links is one this expansion did not add (something
 * else claimed it since). A link it added goes only when one of its endpoints
 * goes; a link between two survivors stays so no survivor is left floating.
 * @param {{nodes: object[], links: object[]}} graphData
 * @param {{ addedNodeIds: string[], addedLinkKeys: string[] }} record
 * @param {{ protectedIds?: Set<string> }} [options]
 * @returns {{ graphData: {nodes: object[], links: object[]}, removedNodeIds: string[] }}
 */
export const collapseExpansion = (graphData, record, { protectedIds = new Set() } = {}) => {
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];
  const added = new Set((record?.addedNodeIds || []).map(normalizeId));
  const addedLinks = new Set(record?.addedLinkKeys || []);

  const claimedElsewhere = new Set();
  links.forEach(link => {
    if (addedLinks.has(linkKey(link))) return;
    claimedElsewhere.add(normalizeId(endpointId(link.source)));
    claimedElsewhere.add(normalizeId(endpointId(link.target)));
  });

  const removed = new Set(nodes
    .map(n => normalizeId(n.id))
    .filter(id => added.has(id) && !protectedIds.has(id) && !claimedElsewhere.has(id)));

  return {
    graphData: {
      nodes: nodes.filter(n => !removed.has(normalizeId(n.id))),
      links: links.filter(link => {
        const s = normalizeId(endpointId(link.source));
        const t = normalizeId(endpointId(link.target));
        if (removed.has(s) || removed.has(t)) return false;
        return true;
      }),
    },
    removedNodeIds: [...removed],
  };
};
