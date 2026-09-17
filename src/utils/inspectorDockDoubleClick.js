// A double-click on a node when the inspector is closed does not arrive as
// two clicks on the same node. The first click docks the inspector, the
// canvas narrows to make room and the graph re-frames, so by the second click
// the node has moved: the pointer finds empty canvas, or a neighbour that slid
// underneath it. The reader meant "expand the node I clicked"; these helpers
// let the second click say so.
//
// The signal that the canvas shifted is the inspector reserve changing between
// the two clicks. With the inspector already docked nothing moves, and a fast
// click on the background stays what it always was: a deselect.

export const rememberFirstClick = ({ nodeId, time, reservedInspectorWidth }) => ({
  nodeId,
  time,
  reservedInspectorWidth,
});

// The id of the node the reader double-clicked, or null when this second
// click is an ordinary click.
export const shiftedDoubleClickTarget = (last, { now, threshold, reservedInspectorWidth }) => {
  if (!last || !last.nodeId) return null;
  if (!(now - last.time < threshold)) return null;
  if (last.reservedInspectorWidth === reservedInspectorWidth) return null;
  return last.nodeId;
};
