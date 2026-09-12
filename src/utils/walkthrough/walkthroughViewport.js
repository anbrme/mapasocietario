// Where the camera goes for a step: centre of the step's nodes, zoom that fits
// them with padding, clamped so a lone node is close and a wide spread is not
// microscopic. Returns null when no node has coordinates yet (simulation cold).
const finite = v => (Number.isFinite(v) ? v : null);

export function stepViewport(step, nodesById, {
  width, height, padding = 80, minZoom = 0.6, maxZoom = 3, singleZoom = 2.2,
} = {}) {
  const pts = (step?.nodeIds || [])
    .map(id => nodesById.get(id))
    .map(n => [finite(n?.x), finite(n?.y)])
    .filter(([x, y]) => x !== null && y !== null);
  if (pts.length === 0) return null;

  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const x = (minX + maxX) / 2;
  const y = (minY + maxY) / 2;
  if (pts.length === 1) return { x, y, k: singleZoom };

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const usableW = Math.max((width || 0) - 2 * padding, 1);
  const usableH = Math.max((height || 0) - 2 * padding, 1);
  const k = Math.min(usableW / spanX, usableH / spanY);
  return { x, y, k: Math.min(maxZoom, Math.max(minZoom, k)) };
}
