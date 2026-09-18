import { useCallback, useRef, useState } from 'react';
import { runSnapshotRefresh } from '../utils/runSnapshotRefresh';

// Same page size as the inspector panel's events fetch, so the request cache
// serves the panel when the user clicks a node after refreshing.
const EVENTS_PAGE_SIZE = 100;

const IDLE = { status: 'idle', done: 0, total: 0, current: null, summary: null };

/**
 * One-click refresh of an imported snapshot against the live registry. State
 * and lifecycle only; the rules live in utils/runSnapshotRefresh.
 *
 * `cancel` stops the refresh and keeps what was fetched (same graph).
 * `abandon` must be called by anything that REPLACES the graph — a new search,
 * a clear, another import — so an in-flight refresh never writes one graph's
 * data into another.
 *
 * @param {object} deps
 * @param {() => {nodes: object[], links: object[]}} deps.getGraph  Latest graph.
 * @param {(graph) => void} deps.setGraph
 * @param {object} deps.service    spanishCompaniesService.
 * @param {(summary) => void} [deps.onComplete]
 */
export function useSnapshotRefresh({ getGraph, setGraph, service, onComplete }) {
  const [state, setState] = useState(IDLE);
  const runRef = useRef(null); // { controller, isAbandoned }

  const fetchLive = useCallback(async node => {
    const groupKey = await service.resolveCompanyGroupKey(node.name, node.groupKey || null);
    const [profile, events] = await Promise.allSettled([
      service.getCompanyProfileV3(node.name, { groupKey }),
      service.getCompanyEventsV3(node.name, { size: EVENTS_PAGE_SIZE, groupKey }),
    ]);
    if (profile.status === 'rejected' && events.status === 'rejected') {
      throw profile.reason;
    }
    const company = profile.status === 'fulfilled' ? profile.value?.company || null : null;
    const eventsData = events.status === 'fulfilled' ? events.value : null;
    return {
      company,
      events: eventsData?.events || [],
      total: Number.isFinite(eventsData?.total) ? eventsData.total : undefined,
    };
  }, [service]);

  /**
   * @param {Set<string>} [onlyIds] Refresh just these node ids (retry failures).
   */
  const start = useCallback(async (onlyIds = null) => {
    if (runRef.current) return;
    const run = { controller: new AbortController(), isAbandoned: false };
    runRef.current = run;

    try {
      const outcome = await runSnapshotRefresh({
        getGraph,
        fetchLive,
        signal: run.controller.signal,
        isAbandoned: () => run.isAbandoned,
        onlyIds,
        onStart: (done, total, current) =>
          setState({ status: 'running', done, total, current, summary: null }),
        onProgress: (done, total, current) => {
          if (!run.isAbandoned) setState(prev => ({ ...prev, done, current }));
        },
        onFailure: (node, reason) =>
          console.warn(`[SnapshotRefresh] ${node.name}:`, reason?.message || reason),
      });
      if (!outcome) return; // abandoned: state was already reset by abandon()

      setGraph(outcome.graph);
      setState(prev => ({ ...prev, status: 'done', current: null, summary: outcome.summary }));
      onComplete?.(outcome.summary);
    } catch (err) {
      console.error('[SnapshotRefresh] refresh failed:', err);
      if (!run.isAbandoned) setState(prev => ({ ...prev, status: 'error', current: null, summary: null }));
    } finally {
      if (runRef.current === run) runRef.current = null;
    }
  }, [fetchLive, getGraph, setGraph, onComplete]);

  const cancel = useCallback(() => runRef.current?.controller.abort(), []);

  const abandon = useCallback(() => {
    const run = runRef.current;
    if (run) {
      run.isAbandoned = true;
      run.controller.abort();
      runRef.current = null;
    }
    setState(IDLE);
  }, []);

  const dismiss = useCallback(() => setState(IDLE), []);

  return { state, start, cancel, abandon, dismiss };
}
