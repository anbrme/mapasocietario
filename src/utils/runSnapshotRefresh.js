// Orchestration of an imported-snapshot refresh, kept out of the React hook so
// its rules are testable: fetch every registry company with bounded
// concurrency, then apply all results to the graph in one pass.
import { runPool } from './concurrencyPool';
import { applyLiveRefresh, selectRefreshTargets, summarizeRefresh } from './snapshotRefresh';

// Companies fetched at once. Each costs up to three calls (key resolution,
// profile, events) and the API bans bursts, so this stays small.
export const SNAPSHOT_REFRESH_CONCURRENCY = 3;

/**
 * Two ways to stop, with opposite outcomes:
 *  - `signal` aborted (the user pressed Cancel): stop starting new companies,
 *    but APPLY what was already fetched — it belongs to this same graph.
 *  - `isAbandoned()` true (another graph replaced this one — a new search, a
 *    clear, another import): DISCARD everything. Applying would write one
 *    graph's registry data into another and flip it out of snapshot mode.
 *
 * @param {object} args
 * @param {() => {nodes, links}} args.getGraph   The graph as it is right now.
 * @param {(node) => Promise<{company, events, total}>} args.fetchLive
 * @param {AbortSignal} args.signal
 * @param {() => boolean} [args.isAbandoned]
 * @param {Set<string>} [args.onlyIds]   Refresh just these node ids (retry).
 * @param {number} [args.concurrency]
 * @param {(done, total, currentName) => void} [args.onStart]
 * @param {(done, total, currentName) => void} [args.onProgress]
 * @param {(node, reason) => void} [args.onFailure]
 * @returns {Promise<{graph, summary}|null>} null when abandoned.
 */
export async function runSnapshotRefresh({
  getGraph,
  fetchLive,
  signal,
  isAbandoned = () => false,
  onlyIds = null,
  concurrency = SNAPSHOT_REFRESH_CONCURRENCY,
  onStart,
  onProgress,
  onFailure,
}) {
  const targets = selectRefreshTargets(getGraph().nodes)
    .filter(n => !onlyIds || onlyIds.has(n.id));
  onStart?.(0, targets.length, targets[0]?.name || null);

  const { results } = await runPool(targets, fetchLive, {
    concurrency,
    signal,
    onProgress: (done, total) => {
      onProgress?.(done, total, targets[Math.min(done, total - 1)]?.name || null);
    },
  });
  if (isAbandoned()) return null;

  const liveById = new Map();
  const failed = [];
  results.forEach((result, i) => {
    if (!result) return; // never started: cancelled
    if (result.status === 'fulfilled') {
      liveById.set(targets[i].id, result.value);
    } else {
      onFailure?.(targets[i], result.reason);
      failed.push({ id: targets[i].id, name: targets[i].name });
    }
  });

  const before = getGraph();
  const graph = applyLiveRefresh(before, liveById, new Date().toISOString());
  const summary = {
    ...summarizeRefresh({ before, after: graph, refreshed: liveById.size, failed }),
    cancelled: !!signal?.aborted,
    skipped: targets.length - liveById.size - failed.length,
  };
  return { graph, summary };
}
