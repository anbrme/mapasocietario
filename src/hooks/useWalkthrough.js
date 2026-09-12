// Owns the drafted walkthrough: loading findings, the merged step list, play
// position and the focus sets the canvas reads. The graph component only wires
// props in and reads state out.
import { useCallback, useMemo, useReducer } from 'react';
import {
  draftWalkthrough, subjectCompanyIds, applyWalkthroughEdits, hideStep, setStepNote, moveStep,
  loadFindingsForSubjects,
} from '../utils/walkthrough';
import { initialWalkthroughState, walkthroughReducer, focusSets } from './walkthroughState';

const nid = id => (id == null ? '' : String(id));

export function useWalkthrough({ graphData, scope, primarySubjectId, lang, fetchFindings, edits, setEdits, onTrack }) {
  const [state, dispatch] = useReducer(walkthroughReducer, initialWalkthroughState);

  const nodesById = useMemo(
    () => new Map((graphData?.nodes || []).map(n => [nid(n.id), n])), [graphData]);

  const draft = useMemo(() => draftWalkthrough({
    graphData, scope, findingsByKey: state.findingsByKey, primarySubjectId, lang,
  }), [graphData, scope, state.findingsByKey, primarySubjectId, lang]);

  const steps = useMemo(() => applyWalkthroughEdits(draft, edits), [draft, edits]);
  const current = state.status === 'playing' ? steps[state.index] || null : null;
  const focus = useMemo(() => focusSets(current), [current]);

  const subjectIds = useMemo(() => subjectCompanyIds(scope, primarySubjectId), [scope, primarySubjectId]);
  const coverage = useMemo(() => {
    const p = state.findingsByKey.get(subjectIds[0]);
    return p?.coverage ? { since: p.coverage.since, indexedThrough: p.coverage.indexed_through } : null;
  }, [state.findingsByKey, subjectIds]);

  const prepare = useCallback(async () => {
    dispatch({ type: 'prepare' });
    const findingsByKey = await loadFindingsForSubjects({ subjectIds, nodesById, fetchFindings, lang });
    dispatch({ type: 'ready', findingsByKey });
    return findingsByKey;
  }, [subjectIds, nodesById, fetchFindings, lang]);

  const start = useCallback(async () => {
    await prepare();
    dispatch({ type: 'start' });
    onTrack?.('walkthrough_start');
  }, [prepare, onTrack]);

  const goTo = useCallback(i => {
    dispatch({ type: 'goto', index: i, total: steps.length });
    const s = steps[Math.min(steps.length - 1, Math.max(0, i))];
    onTrack?.('walkthrough_step', { section: s?.section || '' });
    if (i >= steps.length - 1) onTrack?.('walkthrough_complete');
  }, [steps, onTrack]);
  const next = useCallback(() => goTo(state.index + 1), [goTo, state.index]);
  const prev = useCallback(() => goTo(state.index - 1), [goTo, state.index]);
  const exit = useCallback(() => dispatch({ type: 'exit' }), []);

  const hide = useCallback(key => { setEdits(e => hideStep(e, key)); onTrack?.('walkthrough_step_hidden'); }, [setEdits, onTrack]);
  const setNote = useCallback((key, text) => { setEdits(e => setStepNote(e, key, text)); onTrack?.('walkthrough_note_saved'); }, [setEdits, onTrack]);
  const move = useCallback((key, delta) => setEdits(e => moveStep(e, steps.map(s => s.key), key, delta)), [setEdits, steps]);
  const reset = useCallback(() => { setEdits(() => ({ hidden: [], order: [], notes: {} })); onTrack?.('walkthrough_reset'); }, [setEdits, onTrack]);

  return {
    status: state.status, steps, draft, index: state.index, current, findingsByKey: state.findingsByKey,
    prepare, start, next, prev, goTo, exit, hide, setNote, move, reset, coverage, ...focus,
  };
}
