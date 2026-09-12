// Pure play-position reducer for the drafted walkthrough. Owns only status,
// index, the current step's KEY, and the fetched findings map — never the
// step list itself, which is derived (draft + edits) by the hook.
// findingsByKey is replaced wholesale on every 'ready' action, never mutated
// in place. Position is anchored on currentKey rather than index alone so
// that hiding or reordering a step ahead of the current one (which shifts
// every later index) does not silently swap `current` to a different step.
export const initialWalkthroughState = Object.freeze({
  status: 'idle', index: -1, currentKey: null, findingsByKey: new Map(),
});

export function walkthroughReducer(state, action) {
  switch (action.type) {
    case 'prepare': return { ...state, status: 'preparing' };
    case 'ready': return { ...state, status: 'idle', findingsByKey: action.findingsByKey || new Map() };
    case 'start': return { ...state, status: 'playing', index: 0, currentKey: action.firstKey ?? null };
    case 'goto': {
      const max = Math.max(0, (action.total || 0) - 1);
      return { ...state, index: Math.min(max, Math.max(0, action.index)), currentKey: action.key ?? null };
    }
    case 'sync': {
      if (state.status !== 'playing') return state;
      const keys = action.keys || [];
      if (keys.length === 0) return { ...state, status: 'idle', index: -1, currentKey: null };
      const foundIndex = keys.indexOf(state.currentKey);
      if (foundIndex !== -1) return { ...state, index: foundIndex };
      const index = Math.min(state.index, keys.length - 1);
      return { ...state, index, currentKey: keys[index] };
    }
    case 'exit': return { ...state, status: 'idle', index: -1, currentKey: null };
    default: return state;
  }
}

export const focusSets = step => ({
  tourNodeIds: new Set(step?.nodeIds || []),
  tourLinkKeys: new Set(step?.linkKeys || []),
});

// Pure transition arithmetic for goTo: clamps the requested index into
// range, and tells the caller whether the position actually moved (so
// boundary clicks that are already clamped don't re-fire analytics) and
// whether this move is the one that lands on the final step.
export const stepTransition = (prevIndex, requestedIndex, total) => {
  const max = Math.max(0, total - 1);
  const next = Math.min(max, Math.max(0, requestedIndex));
  return { next, moved: next !== prevIndex, completed: next !== prevIndex && next === max && total > 0 };
};
