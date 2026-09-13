// Owns the drafted walkthrough: loading findings, the merged step list, play
// position and the focus sets the canvas reads. The graph component only wires
// props in and reads state out.
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  draftWalkthrough, subjectCompanyIds, applyWalkthroughEdits, hideStep, setStepNote, moveStep,
  loadFindingsForSubjects,
} from '../utils/walkthrough';
import { initialWalkthroughState, walkthroughReducer, focusSets, stepTransition } from './walkthroughState';

const nid = id => (id == null ? '' : String(id));

export function useWalkthrough({
  graphData, scope, primarySubjectId, lang, fetchFindings, edits, setEdits, onTrack, saveNodeNote,
}) {
  const [state, dispatch] = useReducer(walkthroughReducer, initialWalkthroughState);

  const nodesById = useMemo(
    () => new Map((graphData?.nodes || []).map(n => [nid(n.id), n])), [graphData]);

  const draft = useMemo(() => draftWalkthrough({
    graphData, scope, findingsByKey: state.findingsByKey, primarySubjectId, lang,
  }), [graphData, scope, state.findingsByKey, primarySubjectId, lang]);

  const steps = useMemo(() => applyWalkthroughEdits(draft, edits), [draft, edits]);
  const current = state.status === 'playing' ? steps[state.index] || null : null;
  const focus = useMemo(() => focusSets(current), [current]);

  // Hiding, moving, or re-editing a step ahead of the current one shifts
  // every later index; re-anchor on the current step's KEY (or clamp/exit
  // when that step disappeared) instead of trusting the stale index.
  useEffect(() => {
    if (state.status === 'playing') dispatch({ type: 'sync', keys: steps.map(s => s.key) });
  }, [steps, state.status]);

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
    const findingsByKey = await prepare();
    // Recompute with the same pure functions the memo uses: `steps` still
    // reflects the PRE-fetch draft at this point (state hasn't re-rendered
    // yet), so a walkthrough with zero visible steps must be checked against
    // a freshly-derived list, not the stale one, before entering 'playing'.
    const fresh = applyWalkthroughEdits(draftWalkthrough({
      graphData, scope, findingsByKey, primarySubjectId, lang,
    }), edits);
    if (fresh.length === 0) return;
    dispatch({ type: 'start', firstKey: fresh[0].key });
    onTrack?.('walkthrough_start');
    onTrack?.('walkthrough_step', { section: fresh[0].section || '' });
  }, [prepare, graphData, scope, primarySubjectId, lang, edits, onTrack]);

  const goTo = useCallback(i => {
    const t = stepTransition(state.index, i, steps.length);
    if (!t.moved) return;
    dispatch({ type: 'goto', index: t.next, total: steps.length, key: steps[t.next]?.key || null });
    onTrack?.('walkthrough_step', { section: steps[t.next]?.section || '' });
    if (t.completed) onTrack?.('walkthrough_complete');
  }, [steps, state.index, onTrack]);
  const next = useCallback(() => goTo(state.index + 1), [goTo, state.index]);
  const prev = useCallback(() => goTo(state.index - 1), [goTo, state.index]);
  const exit = useCallback(() => dispatch({ type: 'exit' }), []);

  const hide = useCallback(key => { setEdits(e => hideStep(e, key)); onTrack?.('walkthrough_step_hidden'); }, [setEdits, onTrack]);
  // A step's note has exactly one owner. An author-source step's text IS a
  // node note already (the walkthrough narrates it directly); a step whose
  // primary node carries a node-origin note is the same. Either way, writing
  // through `edits.notes` here would create a second, disconnected copy —
  // save to the node note instead and skip the overlay entirely.
  const setNote = useCallback((key, text) => {
    const step = steps.find(s => s.key === key);
    if (step?.source === 'author') {
      saveNodeNote?.(step.nodeIds[0], text, step.flag);
      onTrack?.('walkthrough_note_saved');
      return;
    }
    if (step?.authorNote?.origin === 'node') {
      saveNodeNote?.(step.nodeIds[0], text, step.authorNote.flag);
      onTrack?.('walkthrough_note_saved');
      return;
    }
    setEdits(e => setStepNote(e, key, text));
    onTrack?.('walkthrough_note_saved');
  }, [steps, saveNodeNote, setEdits, onTrack]);
  const move = useCallback((key, delta) => setEdits(e => moveStep(e, steps.map(s => s.key), key, delta)), [setEdits, steps]);
  const reset = useCallback(() => { setEdits(() => ({ hidden: [], order: [], notes: {} })); onTrack?.('walkthrough_reset'); }, [setEdits, onTrack]);

  return {
    status: state.status, steps, draft, index: state.index, current, findingsByKey: state.findingsByKey,
    prepare, start, next, prev, goTo, exit, hide, setNote, move, reset, coverage, ...focus,
  };
}
