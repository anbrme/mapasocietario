export const NODE_NOTE_MAX_LENGTH = 2000;

export const NODE_NOTE_FLAGS = Object.freeze({
  none: '#94a3b8',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
});

const normalizeNodeId = id => (id == null ? '' : String(id));

export const hasNodeNote = node => (
  typeof node?.userNote?.text === 'string' && node.userNote.text.trim().length > 0
);

export const getNodeNoteMarkerGeometry = (node, nodeRadius = 9) => {
  const safeNodeRadius = Number.isFinite(nodeRadius) && nodeRadius > 0 ? nodeRadius : 9;
  const markerRadius = Math.min(Math.max(safeNodeRadius * 0.5, 4), 7);
  const markerOffset = node?.type === 'officer'
    ? safeNodeRadius * 0.72
    : safeNodeRadius * 1.28;
  const nodeX = Number.isFinite(node?.x) ? node.x : 0;
  const nodeY = Number.isFinite(node?.y) ? node.y : 0;

  return {
    x: nodeX - markerOffset,
    y: nodeY - markerOffset,
    radius: markerRadius,
  };
};

export const nodeMatchesFilterTerms = (node, filterTerms = []) => {
  const searchableText = [node?.name, node?.userNote?.text]
    .filter(value => typeof value === 'string')
    .join('\n')
    .toLowerCase();

  return filterTerms.some(term => {
    const normalizedTerm = String(term || '').trim().toLowerCase();
    return normalizedTerm.length > 0 && searchableText.includes(normalizedTerm);
  });
};

export const normalizeNodeNote = ({ text, flag = 'none' }, updatedAt = new Date().toISOString()) => {
  const cleanText = String(text || '').trim().slice(0, NODE_NOTE_MAX_LENGTH);
  if (!cleanText) return null;
  return {
    text: cleanText,
    flag: Object.prototype.hasOwnProperty.call(NODE_NOTE_FLAGS, flag) ? flag : 'none',
    updatedAt,
  };
};

export const setNodeNote = (graphData, nodeId, draft, updatedAt) => {
  const targetId = normalizeNodeId(nodeId);
  const note = normalizeNodeNote(draft, updatedAt);
  if (!targetId || !note) return graphData;
  return {
    ...graphData,
    nodes: (graphData?.nodes || []).map(node => (
      normalizeNodeId(node.id) === targetId ? { ...node, userNote: note } : node
    )),
  };
};

export const removeNodeNote = (graphData, nodeId) => {
  const targetId = normalizeNodeId(nodeId);
  if (!targetId) return graphData;
  return {
    ...graphData,
    nodes: (graphData?.nodes || []).map(node => {
      if (normalizeNodeId(node.id) !== targetId || !node.userNote) return node;
      const { userNote, ...withoutNote } = node;
      return withoutNote;
    }),
  };
};

export const mergeNodeNotes = (targetNote, sourceNote, updatedAt = new Date().toISOString()) => {
  const target = normalizeNodeNote(targetNote || {}, targetNote?.updatedAt || updatedAt);
  const source = normalizeNodeNote(sourceNote || {}, sourceNote?.updatedAt || updatedAt);
  if (!target) return source;
  if (!source) return target;
  if (target.text === source.text) return target;
  return normalizeNodeNote({
    text: `${target.text}\n\n—\n\n${source.text}`,
    flag: target.flag !== 'none' ? target.flag : source.flag,
  }, updatedAt);
};
