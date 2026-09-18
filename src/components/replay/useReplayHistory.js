import { useCallback, useEffect, useState } from 'react';
import { spanishCompaniesService } from '../../services/spanishCompaniesService';
import { fetchCompanyHistory, fetchOfficerHistory } from '../../services/replayHistory';
import { buildCompanyReplayModel, buildOfficerReplayModel } from '../../utils/replay/replayModel';

// Through the service's fetchWithRetry so a 429 from the shared rate limiter
// backs off instead of failing the replay.
const getJson = async (url, signal) => {
  const response = await spanishCompaniesService.fetchWithRetry(url, { method: 'GET', signal });
  if (!response.ok) throw new Error(`Replay history request failed (${response.status})`);
  return response.json();
};

const loadCompany = async (subject, options) => {
  const groupKey = subject.groupKey
    || await spanishCompaniesService.resolveCompanyGroupKey(subject.name, null);
  const { events, completeness } = await fetchCompanyHistory({ groupKey, name: subject.name }, options);
  return buildCompanyReplayModel(events, { id: groupKey || subject.name, name: subject.name }, { completeness });
};

const loadOfficer = async (subject, options) => {
  const { movements, completeness } = await fetchOfficerHistory(subject.name, options);
  return buildOfficerReplayModel(movements, { id: subject.name, name: subject.name }, { completeness });
};

/**
 * Loads a subject's full registry history once the dialog opens.
 * @param {boolean} open
 * @param {{ kind: 'company'|'officer', name: string, groupKey?: string } | null} subject
 */
export default function useReplayHistory(open, subject) {
  const [state, setState] = useState({ status: 'idle', progress: null, model: null });
  const [attempt, setAttempt] = useState(0);
  const kind = subject?.kind;
  const name = subject?.name;
  const groupKey = subject?.groupKey;

  useEffect(() => {
    if (!open || !name) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading', progress: null, model: null });

    const options = {
      getJson,
      signal: controller.signal,
      onProgress: progress => setState(prev => ({ ...prev, progress })),
    };
    const load = kind === 'officer' ? loadOfficer : loadCompany;
    load({ kind, name, groupKey }, options)
      .then(model => setState({ status: 'ready', progress: null, model }))
      .catch(err => {
        if (err?.name === 'AbortError') return;
        console.warn('[Replay] history load failed:', err?.message || err);
        setState({ status: 'error', progress: null, model: null });
      });

    return () => controller.abort();
  }, [open, kind, name, groupKey, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { ...state, retry };
}
