// Where the camera has to point so a node keeps the place on screen it held
// before a docked side panel narrowed the canvas.
//
// Why this exists: opening the inspector on a single click used to move the
// whole map. force-graph re-centres its own transform whenever the canvas
// resizes (`adjustCanvasSize` translates by half the width it just lost), and
// the app then re-fitted the graph on top of that. Both happen between the two
// clicks of a double-click, so the node the user aimed at had walked off by the
// time the second click landed and the expansion never fired — the node had to
// be hunted down and double-clicked again.
//
// Pure: no DOM, no force-graph. The caller reads the zoom and the node's screen
// position from the canvas and applies the returned centre.

export const DOCK_ANCHOR_PADDING = 72;

const clampAxis = (position, size, padding) => {
  if (!(size > 0)) return position;
  // A canvas too small to hold the padding on both sides has one sane answer.
  if (size <= padding * 2) return size / 2;
  return Math.min(Math.max(position, padding), size - padding);
};

/**
 * @param {{
 *   node: { x: number, y: number },
 *   zoom: number,
 *   canvas: { width: number, height: number },
 *   screen?: { x: number, y: number } | null,
 *   padding?: number,
 * }} args `screen` is where the node sat BEFORE the resize, in canvas pixels;
 *   omit it to simply centre the node.
 * @returns {{ x: number, y: number } | null} the graph-space camera centre, or
 *   null when the node cannot be placed (no zoom yet, node never simulated,
 *   canvas not measured).
 */
export const anchoredCentre = ({
  node, zoom, canvas, screen, padding = DOCK_ANCHOR_PADDING,
}) => {
  const k = Number(zoom);
  const nodeX = Number(node?.x);
  const nodeY = Number(node?.y);
  const width = Number(canvas?.width);
  const height = Number(canvas?.height);
  if (!Number.isFinite(k) || k <= 0) return null;
  if (!Number.isFinite(nodeX) || !Number.isFinite(nodeY)) return null;
  if (!(width > 0) || !(height > 0)) return null;

  // Keep the node exactly where it was, unless the panel now covers that spot
  // — then bring it just inside the edge of what is left of the canvas.
  const screenX = Number.isFinite(Number(screen?.x)) ? Number(screen.x) : width / 2;
  const screenY = Number.isFinite(Number(screen?.y)) ? Number(screen.y) : height / 2;

  return {
    x: nodeX - (clampAxis(screenX, width, padding) - width / 2) / k,
    y: nodeY - (clampAxis(screenY, height, padding) - height / 2) / k,
  };
};
