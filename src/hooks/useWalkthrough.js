// Owns the drafted walkthrough: loading step data, the merged step list, play
// position and the focus sets the canvas reads. The graph component only wires
// props in and reads state out.
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  draftWalkthrough, openingCard, subjectCompanyIds, applyWalkthroughEdits, hideStep, setStepNote, moveStep,
  loadStepData,
} from '../utils/walkthrough';
import { initialWalkthroughState, walkthroughReducer, focusSets, stepTransition } from './walkthroughState';

const nid = id => (id == null ? '' : String(id));

export function useWalkthrough({
  graphData, scope, primarySubjectId, lang, selection = [], setSelection,
  fetchProfile, fetchEvents, fetchFindings, edits, setEdits, onTrack, saveNodeNote,
}) {
  const [state, dispatch] = useReducer(walkthroughReducer, initialWalkthroughState);

  const nodesById = useMemo(
    () => new Map((graphData?.nodes || []).map(n => [nid(n.id), n])), [graphData]);

  // The graph's own selection may carry ids for nodes that are no longer
  // visible (filtered out, dissolved, etc.) — only ids the current graph
  // still knows about count toward mode, count and the drafted steps.
  const visibleSelection = useMemo(
    () => selection.filter(id => nodesById.has(id)), [selection, nodesById]);

  const mode = visibleSelection.length ? 'selection' : 'draft';
  const selectedCount = visibleSelection.length;

  const draft = useMemo(() => draftWalkthrough({
    graphData, scope, stepData: state.stepData, selection: visibleSelection, primarySubjectId, lang,
  }), [graphData, scope, state.stepData, visibleSelection, primarySubjectId, lang]);

  const steps = useMemo(() => applyWalkthroughEdits(draft, edits), [draft, edits]);
  const current = state.status === 'playing' ? steps[state.index] || null : null;
  const focus = useMemo(() => focusSets(current), [current]);

  const opening = useMemo(() => openingCard({
    steps, mode, selectedCount, lang,
  }), [steps, mode, selectedCount, lang]);

  // Hiding, moving, or re-editing a step ahead of the current one shifts
  // every later index; re-anchor on the current step's KEY (or clamp/exit
  // when that step disappeared) instead of trusting the stale index.
  useEffect(() => {
    if (state.status === 'playing') dispatch({ type: 'sync', keys: steps.map(s => s.key) });
  }, [steps, state.status]);

  const loadIds = useMemo(
    () => (mode === 'selection' ? visibleSelection : subjectCompanyIds(scope, primarySubjectId)),
    [mode, visibleSelection, scope, primarySubjectId]);

  const coverage = useMemo(() => {
    const firstId = loadIds[0];
    return state.stepData.get(firstId)?.findings?.coverage || null;
  }, [state.stepData, loadIds]);

  // The graph component may not wire fetchProfile/fetchEvents (v1 callers,
  // or a selection-less draft that never needs them) — guard here so the
  // loader always gets callable functions.
  const safeFetchProfile = useCallback(
    args => (fetchProfile ? fetchProfile(args) : Promise.resolve(null)), [fetchProfile]);
  const safeFetchEvents = useCallback(
    args => (fetchEvents ? fetchEvents(args) : Promise.resolve(null)), [fetchEvents]);

  const prepare = useCallback(async () => {
    dispatch({ type: 'prepare' });
    const stepData = await loadStepData({
      ids: loadIds, nodesById, fetchProfile: safeFetchProfile, fetchEvents: safeFetchEvents, fetchFindings, lang,
    });
    dispatch({ type: 'ready', stepData });
    return stepData;
  }, [loadIds, nodesById, safeFetchProfile, safeFetchEvents, fetchFindings, lang]);

  const start = useCallback(async () => {
    const stepData = await prepare();
    // Recompute with the same pure functions the memo uses: `steps` still
    // reflects the PRE-fetch draft at this point (state hasn't re-rendered
    // yet), so a walkthrough with zero visible steps must be checked against
    // a freshly-derived list, not the stale one, before entering 'playing'.
    const fresh = applyWalkthroughEdits(draftWalkthrough({
      graphData, scope, stepData, selection: visibleSelection, primarySubjectId, lang,
    }), edits);
    if (fresh.length === 0) return;
    dispatch({ type: 'start', firstKey: fresh[0].key });
    onTrack?.('walkthrough_start', { mode, steps: fresh.length });
    onTrack?.('walkthrough_step', { section: fresh[0].kind || '' });
  }, [prepare, graphData, scope, visibleSelection, primarySubjectId, lang, edits, mode, onTrack]);

  const goTo = useCallback(i => {
    const t = stepTransition(state.index, i, steps.length);
    if (!t.moved) return;
    dispatch({ type: 'goto', index: t.next, total: steps.length, key: steps[t.next]?.key || null });
    onTrack?.('walkthrough_step', { section: steps[t.next]?.kind || '' });
    if (t.completed) onTrack?.('walkthrough_complete');
  }, [steps, state.index, onTrack]);
  const next = useCallback(() => goTo(state.index + 1), [goTo, state.index]);
  const prev = useCallback(() => goTo(state.index - 1), [goTo, state.index]);
  const exit = useCallback(() => dispatch({ type: 'exit' }), []);

  const hide = useCallback(key => { setEdits(e => hideStep(e, key)); onTrack?.('walkthrough_step_hidden'); }, [setEdits, onTrack]);
  // A step's note has exactly one owner. In selection mode every step is the
  // author's own pick, so its note always writes straight to the node note.
  // In draft mode, a step whose primary node already carries a node-origin
  // note is the same case; anything else writes to the overlay instead,
  // which would otherwise create a second, disconnected copy of the text.
  const setNote = useCallback((key, text) => {
    const step = steps.find(s => s.key === key);
    if (!step) return;
    if (mode === 'selection' || step.authorNote?.origin === 'node') {
      saveNodeNote?.(step.nodeId, text, step.narrative?.flag || 'none');
      onTrack?.('walkthrough_note_saved');
      return;
    }
    setEdits(e => setStepNote(e, key, text));
    onTrack?.('walkthrough_note_saved');
  }, [steps, mode, saveNodeNote, setEdits, onTrack]);

  const move = useCallback((key, delta) => {
    if (mode === 'selection') {
      const step = steps.find(s => s.key === key);
      if (!step) return;
      const i = visibleSelection.indexOf(step.nodeId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= visibleSelection.length) return;
      const fullI = selection.indexOf(step.nodeId);
      const fullJ = selection.indexOf(visibleSelection[j]);
      if (fullI < 0 || fullJ < 0) return;
      const next = [...selection];
      [next[fullI], next[fullJ]] = [next[fullJ], next[fullI]];
      setSelection?.(next);
      return;
    }
    setEdits(e => moveStep(e, steps.map(s => s.key), key, delta));
  }, [mode, steps, visibleSelection, selection, setSelection, setEdits]);

  const reset = useCallback(() => { setEdits(() => ({ hidden: [], order: [], notes: {} })); onTrack?.('walkthrough_reset'); }, [setEdits, onTrack]);

  return {
    status: state.status, steps, draft, index: state.index, current, stepData: state.stepData,
    mode, opening, selectedCount,
    prepare, start, next, prev, goTo, exit, hide, setNote, move, reset, coverage, ...focus,
  };
}
