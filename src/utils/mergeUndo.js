// Reversible node merges. mergeNodes() in the graph component is destructive
// (the source node is deleted and its links rewired onto the target), so undo
// needs a snapshot taken BEFORE the merge. captureMergeSnapshot records the
// two nodes and every link touching either; restoreMergeSnapshot rebuilds that
// exact neighborhood on the post-merge graph, leaving unrelated additions made
// in the meantime untouched.

const normalizeId = id => (id == null ? '' : String(id));

// d3-force mutates link.source/target into node object references after render.
const endpointId = endpoint => (endpoint && typeof endpoint === 'object' ? endpoint.id : endpoint);

const touchesEither = (link, aId, bId) => {
  const s = normalizeId(endpointId(link.source));
  const t = normalizeId(endpointId(link.target));
  return s === aId || t === aId || s === bId || t === bId;
};

const plainLink = link => ({
  ...link,
  source: normalizeId(endpointId(link.source)),
  target: normalizeId(endpointId(link.target)),
});

export const captureMergeSnapshot = (graphData, sourceNodeId, targetNodeId) => {
  const sourceId = normalizeId(sourceNodeId);
  const targetId = normalizeId(targetNodeId);
  const nodes = graphData?.nodes || [];
  const sourceNode = nodes.find(node => normalizeId(node.id) === sourceId);
  const targetNode = nodes.find(node => normalizeId(node.id) === targetId);
  if (!sourceNode || !targetNode) return null;

  const links = (graphData?.links || [])
    .filter(link => touchesEither(link, sourceId, targetId))
    .map(plainLink);

  return {
    sourceId,
    targetId,
    sourceNode: { ...sourceNode },
    targetNode: { ...targetNode },
    links,
  };
};

export const restoreMergeSnapshot = (graphData, snapshot) => {
  if (!snapshot) return graphData;
  const { sourceId, targetId, sourceNode, targetNode, links } = snapshot;

  const otherNodes = (graphData?.nodes || []).filter(node => {
    const id = normalizeId(node.id);
    return id !== sourceId && id !== targetId;
  });
  const keptLinks = (graphData?.links || [])
    .filter(link => !touchesEither(link, sourceId, targetId))
    .map(plainLink);

  return {
    ...graphData,
    nodes: [...otherNodes, { ...targetNode }, { ...sourceNode }],
    links: [...keptLinks, ...links.map(link => ({ ...link }))],
  };
};
