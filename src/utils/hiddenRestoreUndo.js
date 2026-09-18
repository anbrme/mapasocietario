import { rebindLinksAfterNodeUpdate } from './graphLinkBinding';

const key = id => String(id);
const capturePositions = graph => new Map(graph.nodes
  .filter(node => Number.isFinite(node.x) && Number.isFinite(node.y))
  .map(node => [key(node.id), { x: node.x, y: node.y }]));

// Only newly hidden nodes belong to this action. A stale selection can include
// an already hidden or deleted node; undo must not reveal either one.
export function captureSelectionHide(graph, hiddenNodeIds, selectedNodeIds) {
  const hidden = new Set([...hiddenNodeIds].map(key));
  const selected = new Set([...selectedNodeIds].map(key));
  const nodeIds = graph.nodes
    .filter(node => selected.has(key(node.id)) && !hidden.has(key(node.id)))
    .map(node => key(node.id));
  if (!nodeIds.length) return null;
  return { action: 'hide', nodeIds, dismissedLinks: [], positions: capturePositions(graph) };
}

// Store only visibility changes and coordinates, never a whole graph that
// would overwrite notes, edits or expansions made after revealing items.
export function captureHiddenRestore(graph, hiddenNodeIds, { nodeIds = [], linkIds = [] }) {
  const hidden = new Set([...hiddenNodeIds].map(key));
  const requestedNodes = new Set(nodeIds.map(key));
  const requestedLinks = new Set(linkIds.map(key));
  const restoredNodeIds = graph.nodes
    .filter(node => requestedNodes.has(key(node.id)) && hidden.has(key(node.id)))
    .map(node => key(node.id));
  const dismissedLinks = graph.links
    .filter(link => requestedLinks.has(key(link.id)) && link.dismissed)
    .map(link => ({ id: key(link.id), dismissed: { ...link.dismissed } }));
  if (!restoredNodeIds.length && !dismissedLinks.length) return null;
  return {
    action: 'restore',
    nodeIds: restoredNodeIds,
    dismissedLinks,
    positions: capturePositions(graph),
  };
}

function restorePositions(graph, positions) {
  const nodes = graph.nodes.map(node => {
    const position = positions.get(key(node.id));
    // Pin settled coordinates, like a manual drag. Changing visibility restarts
    // d3; restoring x/y alone lets that simulation scramble the saved layout.
    return position ? { ...node, ...position, fx: position.x, fy: position.y, vx: 0, vy: 0 } : node;
  });
  return { ...graph, nodes, links: rebindLinksAfterNodeUpdate(graph.links, graph.nodes, nodes) };
}

export function applyHiddenRestore(graph, hiddenNodeIds, snapshot) {
  const restored = new Set(snapshot.nodeIds);
  const links = new Set(snapshot.dismissedLinks.map(link => link.id));
  const positioned = restorePositions(graph, snapshot.positions);
  return {
    graph: {
      ...positioned,
      links: positioned.links.map(link => {
        if (!links.has(key(link.id))) return link;
        const { dismissed, ...visible } = link;
        return visible;
      }),
    },
    hiddenNodeIds: new Set([...hiddenNodeIds].map(key).filter(id => !restored.has(id))),
  };
}

export function undoHiddenRestore(graph, hiddenNodeIds, snapshot) {
  const existing = new Set(graph.nodes.map(node => key(node.id)));
  const dismissed = new Map(snapshot.dismissedLinks.map(link => [link.id, link.dismissed]));
  const positioned = restorePositions(graph, snapshot.positions);
  return {
    graph: {
      ...positioned,
      links: positioned.links.map(link => dismissed.has(key(link.id)) && !link.dismissed
        ? { ...link, dismissed: { ...dismissed.get(key(link.id)) } } : link),
    },
    hiddenNodeIds: new Set([
      ...[...hiddenNodeIds].map(key),
      ...snapshot.nodeIds.filter(id => existing.has(id)),
    ]),
  };
}

export function undoVisibilityChange(graph, hiddenNodeIds, selection, snapshot) {
  const restored = snapshot.action === 'hide'
    ? applyHiddenRestore(graph, hiddenNodeIds, snapshot)
    : undoHiddenRestore(graph, hiddenNodeIds, snapshot);
  const existingIds = new Set(graph.nodes.map(node => key(node.id)));
  const selectedIds = [...selection].map(key);
  if (snapshot.action === 'hide') selectedIds.push(...snapshot.nodeIds);
  return {
    ...restored,
    selection: new Set(selectedIds.filter(id => existingIds.has(id) && !restored.hiddenNodeIds.has(id))),
  };
}
