import { useCallback, useRef, useState } from 'react';
import { runPool } from '../utils/concurrencyPool';
import {
  applyLiveRefresh,
  selectRefreshTargets,
  summarizeRefresh,
} from '../utils/snapshotRefresh';

// Companies fetched at once. Each costs up to three calls (key resolution,
// profile, events) and the API bans bursts, so this stays small.
export const SNAPSHOT_REFRESH_CONCURRENCY = 3;

// Same page size as the inspector panel's events fetch, so the request cache
// serves the panel when the user clicks a node after refreshing.
const EVENTS_PAGE_SIZE = 100;

const IDLE = { status: 'idle', done: 0, total: 0, current: null, summary: null };

/**
 * One-click refresh of an imported snapshot against the live registry.
 *
 * Fetches every registry company in the graph with bounded concurrency,
 * then applies all results in ONE graph update (see applyLiveRefresh), so the
 * canvas re-renders once instead of once per company. A cancel keeps what was
 * already fetched.
 *
 * @param {object} deps
 * @param {() => {nodes: object[], links: object[]}} deps.getGraph  Latest graph.
 * @param {(graph) => void} deps.setGraph
 * @param {object} deps.service    spanishCompaniesService.
 * @param {(summary) => void} [deps.onComplete]
 */
export function useSnapshotRefresh({ getGraph, setGraph, service, onComplete }) {
  const [state, setState] = useState(IDLE);
  const controllerRef = useRef(null);

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
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const targets = selectRefreshTargets(getGraph().nodes)
        .filter(n => !onlyIds || onlyIds.has(n.id));
      setState({ status: 'running', done: 0, total: targets.length, current: targets[0]?.name || null, summary: null });

      const { results } = await runPool(targets, fetchLive, {
        concurrency: SNAPSHOT_REFRESH_CONCURRENCY,
        signal: controller.signal,
        onProgress: (done, total) => {
          const current = targets[Math.min(done, total - 1)]?.name || null;
          setState(prev => ({ ...prev, done, current }));
        },
      });

      const liveById = new Map();
      const failed = [];
      results.forEach((result, i) => {
        if (!result) return; // never started: cancelled
        if (result.status === 'fulfilled') {
          liveById.set(targets[i].id, result.value);
        } else {
          console.warn(`[SnapshotRefresh] ${targets[i].name}:`, result.reason?.message || result.reason);
          failed.push({ id: targets[i].id, name: targets[i].name });
        }
      });

      // Read the graph again at apply time rather than reusing the pre-fetch copy.
      const before = getGraph();
      const after = applyLiveRefresh(before, liveById, new Date().toISOString());
      setGraph(after);

      const summary = {
        ...summarizeRefresh({ before, after, refreshed: liveById.size, failed }),
        cancelled: controller.signal.aborted,
        skipped: targets.length - liveById.size - failed.length,
      };
      setState(prev => ({ ...prev, status: 'done', current: null, summary }));
      onComplete?.(summary);
    } catch (err) {
      console.error('[SnapshotRefresh] refresh failed:', err);
      setState(prev => ({ ...prev, status: 'error', current: null, summary: null }));
    } finally {
      controllerRef.current = null;
    }
  }, [fetchLive, getGraph, setGraph, onComplete]);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);
  const dismiss = useCallback(() => setState(IDLE), []);

  return { state, start, cancel, dismiss };
}
