// When to re-frame the canvas around the graph automatically.
//
// The fit used to fire only when the node COUNT changed, which missed the two
// cases that leave a small graph off-screen. A canvas that mounts after the
// data (a background tab delivers no resize-observer callbacks until it is
// shown) had no fit at all, and force-graph's own first-data zoom then framed
// the empty origin while a two-node graph sat 700 px above it. And a new graph
// with the same count as the previous one never fitted, because the counter
// was never reset on clear.
//
// `previous` is what the last decision recorded: { count, ready }. A fit is
// due when the canvas is ready and either the count changed or the canvas was
// not ready last time. An imported snapshot carries its own camera and is
// never re-framed.

/**
 * @param {{ count: number, containerReady: boolean, snapshotMode: boolean,
 *           previous: { count: number, ready: boolean } }} state
 * @returns {{ fit: boolean, next: { count: number, ready: boolean } }}
 */
export const autoFitDecision = ({ count, containerReady, snapshotMode, previous }) => {
  const last = previous || { count: 0, ready: false };
  const next = { count, ready: Boolean(containerReady) };
  const changed = count !== last.count || (containerReady && !last.ready);
  const fit = !snapshotMode && Boolean(containerReady) && count > 0 && changed;
  return { fit, next };
};
