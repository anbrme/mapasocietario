/**
 * The landing-page search funnel as a pure reducer.
 *
 * GA4 saw one event from this field (the selection), so a visitor who typed,
 * got results and left looked identical to one who never touched it. This
 * reducer turns the field's raw interactions — focus, input, results arriving,
 * Enter/button submits, picks, blur — into the funnel events the graph already
 * reports, plus the two it could not: zero-result searches and abandonment.
 *
 * Pure so it can be tested without a DOM: `stepFunnel(state, action)` returns
 * the next state, the events to send, and (for submits) what to open. The
 * component adds `language` to every event; query TEXT is never sent, only its
 * length, because officer searches are people's names.
 */
import { classifyEntitySelection } from './entitySelection';
import { resolveSubmitTarget } from './landingSearchSubmit';

const MIN_QUERY_LENGTH = 2;

export function initialFunnelState() {
  return {
    focusedAt: null,
    startedAt: null,
    query: '',
    focusTracked: false,
    typingTracked: false,
    resultsShownTracked: false,
    emptyQueriesTracked: [],
    lastResults: null,
    pendingSubmit: null,
    selected: false,
    abandonedQuery: null,
  };
}

const event = (name, params) => ({ name, params });
const queryLength = query => String(query ?? '').trim().length;

function entityTypeOf(option) {
  const { route } = classifyEntitySelection(option);
  if (route === 'company') return 'company';
  if (route === 'officer') return 'officer';
  return 'shareholder';
}

function onFocus(state, { at }) {
  const events = state.focusTracked ? [] : [event('home_search_focus', {})];
  return {
    state: { ...state, focusTracked: true, focusedAt: state.focusedAt ?? at },
    events,
  };
}

function abandonmentStage(state) {
  const { lastResults, query } = state;
  if (!lastResults || lastResults.query !== query) return { stage: 'typed', suggestion_count: 0 };
  return {
    stage: lastResults.count > 0 ? 'results_shown' : 'zero_results',
    suggestion_count: lastResults.count,
  };
}

function onBlur(state) {
  const typedEnough = queryLength(state.query) >= MIN_QUERY_LENGTH;
  const alreadyReported = state.abandonedQuery === state.query;
  if (!typedEnough || state.selected || alreadyReported) return { state, events: [] };
  return {
    state: { ...state, abandonedQuery: state.query },
    events: [event('home_search_abandoned', { ...abandonmentStage(state), query_length: queryLength(state.query) })],
  };
}

function onInput(state, { query, at }) {
  const events = query && !state.typingTracked
    ? [event('home_search_typing_started', { time_to_type_ms: at - (state.focusedAt ?? at) })]
    : [];
  const keepPending = state.pendingSubmit && state.pendingSubmit.query === query;
  return {
    state: {
      ...state,
      query,
      typingTracked: state.typingTracked || Boolean(query),
      startedAt: state.startedAt ?? at,
      pendingSubmit: keepPending ? state.pendingSubmit : null,
      selected: false,
    },
    events,
  };
}

function submittedEvent({ method, outcome, count, query }) {
  return event('home_search_submitted', {
    method,
    outcome,
    suggestion_count: count,
    query_length: queryLength(query),
  });
}

function onResults(state, { query, options }) {
  if (query !== state.query) return { state, events: [] };
  const list = Array.isArray(options) ? options : [];
  const count = list.length;
  const events = [];

  if (count > 0 && !state.resultsShownTracked) {
    events.push(event('home_search_results', { result_state: 'shown', suggestion_count: count, query_length: queryLength(query) }));
  }
  const emptyIsNew = count === 0 && !state.emptyQueriesTracked.includes(query);
  if (emptyIsNew) {
    events.push(event('home_search_results', { result_state: 'empty', suggestion_count: 0, query_length: queryLength(query) }));
  }

  let open;
  const pending = state.pendingSubmit && state.pendingSubmit.query === query ? state.pendingSubmit : null;
  if (pending) {
    open = resolveSubmitTarget(query, list);
    events.push(submittedEvent({ method: pending.method, outcome: open ? open.match : 'no_results', count, query }));
  }

  return {
    state: {
      ...state,
      resultsShownTracked: state.resultsShownTracked || count > 0,
      emptyQueriesTracked: emptyIsNew ? [...state.emptyQueriesTracked, query] : state.emptyQueriesTracked,
      lastResults: { query, count },
      pendingSubmit: pending ? null : state.pendingSubmit,
    },
    events,
    open,
  };
}

function onSubmit(state, { method, query, options, loading }) {
  const list = Array.isArray(options) ? options : [];
  const count = list.length;

  if (queryLength(query) < MIN_QUERY_LENGTH) {
    return { state, events: [submittedEvent({ method, outcome: 'too_short', count, query })] };
  }
  if (count > 0) {
    const open = resolveSubmitTarget(query, list);
    return { state, events: [submittedEvent({ method, outcome: open.match, count, query })], open };
  }
  if (loading) {
    return {
      state: { ...state, pendingSubmit: { method, query } },
      events: [submittedEvent({ method, outcome: 'pending', count, query })],
    };
  }
  return { state, events: [submittedEvent({ method, outcome: 'no_results', count, query })] };
}

function onSelect(state, { option, method, match, rank, options, at }) {
  const since = state.startedAt ?? state.focusedAt ?? at;
  return {
    state: { ...state, selected: true, pendingSubmit: null },
    events: [
      event('home_search_selection', {
        entity_type: entityTypeOf(option),
        selection_method: method,
        selection_match: match,
        selection_rank: rank,
        suggestion_count: (options || []).length,
        time_to_selection_ms: at - since,
      }),
    ],
  };
}

const HANDLERS = {
  focus: onFocus,
  blur: onBlur,
  input: onInput,
  results: onResults,
  submit: onSubmit,
  select: onSelect,
};

/**
 * @returns {{ state: object, events: Array<{name: string, params: object}>, open?: object|null }}
 */
export function stepFunnel(state, action) {
  const handler = HANDLERS[action?.type];
  if (!handler) return { state, events: [] };
  return handler(state, action);
}
