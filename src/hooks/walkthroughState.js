// Pure play-position reducer for the drafted walkthrough. Owns only status
// and index and the fetched findings map — never the step list itself, which
// is derived (draft + edits) by the hook. findingsByKey is replaced wholesale
// on every 'ready' action, never mutated in place.
export const initialWalkthroughState = Object.freeze({
  status: 'idle', index: -1, findingsByKey: new Map(),
});

export function walkthroughReducer(state, action) {
  switch (action.type) {
    case 'prepare': return { ...state, status: 'preparing' };
    case 'ready': return { ...state, status: 'idle', findingsByKey: action.findingsByKey || new Map() };
    case 'start': return { ...state, status: 'playing', index: 0 };
    case 'goto': {
      const max = Math.max(0, (action.total || 0) - 1);
      return { ...state, index: Math.min(max, Math.max(0, action.index)) };
    }
    case 'exit': return { ...state, status: 'idle', index: -1 };
    default: return state;
  }
}

export const focusSets = step => ({
  tourNodeIds: new Set(step?.nodeIds || []),
  tourLinkKeys: new Set(step?.linkKeys || []),
});
