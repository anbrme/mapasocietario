// Rectangle selection geometry. Shift-drag on empty canvas draws a rectangle
// in screen space; the hook converts its corners to graph space and every
// positioned node whose centre lies inside joins the selection. Pure.

// Below this many screen pixels of movement the gesture is a shift-click,
// which already toggles one node, not a lasso.
export const LASSO_MIN_DRAG_PX = 6;

/** Normalise two corners (any order) into a CSS-style box. */
export const rectFromPoints = (a, b) => ({
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

/**
 * Ids of the nodes whose (x, y) lies inside the rectangle spanned by two
 * graph-space corners, edges inclusive. Unpositioned nodes are skipped.
 * @param {Array<{id: unknown, x?: number, y?: number}> | null | undefined} nodes
 */
export const nodesInRect = (nodes, a, b) => {
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  return (nodes || [])
    .filter(n => Number.isFinite(n.x) && Number.isFinite(n.y)
      && n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
    .map(n => n.id);
};
