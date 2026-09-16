// Owns the drafted walkthrough: loading step data, the merged step list, play
// position and the focus sets the canvas reads. The graph component only wires
// props in and reads state out.
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  draftWalkthrough, openingCard, subjectCompanyIds, applyWalkthroughEdits, hideStep, setStepNote, setStepMoment,
  moveStep, swapInSelection, removeFromSelection, loadStepData, mergeCoverage,
  suggestConnections, addConnection, removeConnection,
  setStepAnnotation, removeStepAnnotation, newAnnotationId,
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
  // visible (filtered out, dissolved, etc.) or repeat one — only ids the
  // current graph still knows about, deduped, count toward mode, count and
  // the drafted steps (the engine dedupes independently, but the hook must
  // agree with it or `selectedCount`/`opening` disagree with the step list).
  const visibleSelection = useMemo(
    () => [...new Set((Array.isArray(selection) ? selection : []).map(String))]
      .filter(id => nodesById.has(id)),
    [selection, nodesById]);

  const mode = visibleSelection.length ? 'selection' : 'draft';
  const selectedCount = visibleSelection.length;

  const draft = useMemo(() => draftWalkthrough({
    graphData, scope, stepData: state.stepData, selection: visibleSelection, primarySubjectId, lang,
    connections: edits?.connections,
  }), [graphData, scope, state.stepData, visibleSelection, primarySubjectId, lang, edits?.connections]);

  // Connections the author has not accepted yet: selected entities that only
  // reach each other through unselected nodes. Selection mode only.
  const suggestions = useMemo(() => {
    if (mode !== 'selection') return [];
    const accepted = new Set(edits?.connections || []);
    return suggestConnections({ graphData, selection: visibleSelection }).filter(s => !accepted.has(s.key));
  }, [mode, graphData, visibleSelection, edits?.connections]);

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

  // Each company's findings payload reports its OWN coverage, and a dissolved
  // company's runs out at its last filing. The document's coverage is the
  // union: the earliest start, the latest end.
  const coverage = useMemo(
    () => mergeCoverage(loadIds.map(id => state.stepData.get(id)?.findings?.coverage)),
    [state.stepData, loadIds]);

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
      graphData, scope, stepData, selection: visibleSelection, primarySubjectId, lang, connections: edits?.connections,
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

  // In selection mode a step IS a selected node, so removing the step means
  // deselecting the node — the badge, the AI panel and the list then agree.
  // A hidden-overlay entry would leave the node selected and the count wrong.
  // In draft mode the overlay is the right place: the draft is recomputed
  // from the graph and the entry keeps the step away.
  const hide = useCallback(key => {
    const step = steps.find(s => s.key === key);
    if (step?.kind === 'connection') {
      setEdits(e => removeConnection(e, key));
    } else if (mode === 'selection') {
      if (!step) return;
      setSelection?.(removeFromSelection(selection, step.nodeId));
    } else {
      setEdits(e => hideStep(e, key));
    }
    onTrack?.('walkthrough_step_hidden');
  }, [mode, steps, selection, setSelection, setEdits, onTrack]);
  const setMoment = useCallback((key, iso) => {
    setEdits(e => setStepMoment(e, key, iso));
    onTrack?.('walkthrough_moment_set');
  }, [setEdits, onTrack]);

  // Dated notes: a chapter's own `moment` is one day, and an argument about a
  // person's position rarely is. Each note carries its own date, so the author
  // can say what happened on each of them instead of picking one and hoping.
  const addAnnotation = useCallback(key => {
    setEdits(e => setStepAnnotation(e, key, { id: newAnnotationId(), date: '', text: '' }));
    onTrack?.('walkthrough_annotation_added');
  }, [setEdits, onTrack]);
  const setAnnotation = useCallback((key, annotation) => {
    setEdits(e => setStepAnnotation(e, key, annotation));
    onTrack?.('walkthrough_annotation_saved');
  }, [setEdits, onTrack]);
  const removeAnnotation = useCallback((key, id) => {
    setEdits(e => removeStepAnnotation(e, key, id));
    onTrack?.('walkthrough_annotation_removed');
  }, [setEdits, onTrack]);
  // A step's note has exactly one owner. In selection mode every step is the
  // author's own pick, so its note always writes straight to the node note.
  // In draft mode, a step whose primary node already carries a node-origin
  // note is the same case; anything else writes to the overlay instead,
  // which would otherwise create a second, disconnected copy of the text.
  const setNote = useCallback((key, text) => {
    const step = steps.find(s => s.key === key);
    if (!step) return;
    // A connection step has no node: its note can only live in the overlay.
    if (step.kind !== 'connection' && (mode === 'selection' || step.authorNote?.origin === 'node')) {
      saveNodeNote?.(step.nodeId, text, step.narrative?.flag || 'none');
      // The node note is now the single source of truth for this step's
      // text; drop any stale overlay note left over from before it had one
      // (e.g. from a previous draft-mode edit on the same node) so the two
      // copies can't disagree.
      if (mode === 'selection') setEdits(e => setStepNote(e, key, ''));
      onTrack?.('walkthrough_note_saved');
      return;
    }
    setEdits(e => setStepNote(e, key, text));
    onTrack?.('walkthrough_note_saved');
  }, [steps, mode, saveNodeNote, setEdits, onTrack]);

  // Positions are computed from `steps` (draft + edits applied), not from
  // `visibleSelection` directly — a hidden step, a selection over the
  // SELECTION_CAP, or a restored `edits.order` all mean the visible step
  // order isn't the same array as the raw selection, and picking the
  // neighbour from the wrong one swaps the wrong ids.
  const move = useCallback((key, delta) => {
    const idx = steps.findIndex(s => s.key === key);
    const nb = steps[idx + delta];
    if (idx < 0 || !nb) return;
    // Two node steps swap in the selection itself; a connection step has no
    // node to swap, so any move involving one goes through the overlay order.
    if (mode === 'selection' && steps[idx].nodeId && nb.nodeId) {
      setSelection?.(swapInSelection(selection, steps[idx].nodeId, nb.nodeId));
      return;
    }
    setEdits(e => moveStep(e, steps.map(s => s.key), key, delta));
  }, [mode, steps, selection, setSelection, setEdits]);

  const acceptConnection = useCallback(key => {
    setEdits(e => addConnection(e, key));
    onTrack?.('walkthrough_connection_added');
  }, [setEdits, onTrack]);

  const reset = useCallback(() => { setEdits(() => ({ hidden: [], order: [], notes: {}, moments: {}, connections: [], annotations: {} })); onTrack?.('walkthrough_reset'); }, [setEdits, onTrack]);

  return {
    status: state.status, steps, draft, index: state.index, current, stepData: state.stepData,
    mode, opening, selectedCount, suggestions,
    prepare, start, next, prev, goTo, exit, hide, setNote, setMoment, move, reset, acceptConnection, coverage,
    addAnnotation, setAnnotation, removeAnnotation, ...focus,
  };
}
