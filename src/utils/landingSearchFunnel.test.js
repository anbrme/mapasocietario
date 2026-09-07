import { describe, expect, it } from 'vitest';
import { initialFunnelState, stepFunnel } from './landingSearchFunnel';

// A tiny driver: feed actions in order, collect every emitted event.
function drive(actions, start = initialFunnelState()) {
  return actions.reduce(
    (acc, action) => {
      const out = stepFunnel(acc.state, action);
      return { state: out.state, events: [...acc.events, ...out.events], open: out.open ?? acc.open };
    },
    { state: start, events: [], open: null }
  );
}

const company = (name, id) => ({ type: 'company', name, value: name, label: name, id });
const names = events => events.map(e => e.name);
const ENDESA = [company('ENDESA ENERGIA SA', 'H:M-205381'), company('ENDESA SA', 'H:M-6405')];

describe('stepFunnel — focus and typing', () => {
  it('reports focus once, however many times the field is focused', () => {
    const { events } = drive([{ type: 'focus', at: 1000 }, { type: 'blur', at: 1500 }, { type: 'focus', at: 2000 }]);
    expect(names(events)).toEqual(['home_search_focus']);
  });

  it('reports typing once, with the delay since focus', () => {
    const { events } = drive([
      { type: 'focus', at: 1000 },
      { type: 'input', query: 'e', at: 1800 },
      { type: 'input', query: 'en', at: 1900 },
    ]);
    expect(events.filter(e => e.name === 'home_search_typing_started')).toEqual([
      { name: 'home_search_typing_started', params: { time_to_type_ms: 800 } },
    ]);
  });

  it('does not mutate the state it is given', () => {
    const start = initialFunnelState();
    const frozen = Object.freeze({ ...start });
    stepFunnel(frozen, { type: 'focus', at: 1 });
    expect(frozen).toEqual(start);
  });
});

describe('stepFunnel — results, including the zero-result searches', () => {
  it('reports the first shown result set once', () => {
    const { events } = drive([
      { type: 'input', query: 'en', at: 1 },
      { type: 'results', query: 'en', options: ENDESA, at: 400 },
      { type: 'input', query: 'end', at: 500 },
      { type: 'results', query: 'end', options: ENDESA, at: 900 },
    ]);
    expect(events.filter(e => e.name === 'home_search_results')).toEqual([
      { name: 'home_search_results', params: { result_state: 'shown', suggestion_count: 2, query_length: 2 } },
    ]);
  });

  it('reports every distinct query that came back empty', () => {
    const { events } = drive([
      { type: 'input', query: 'zzq', at: 1 },
      { type: 'results', query: 'zzq', options: [], at: 400 },
      { type: 'results', query: 'zzq', options: [], at: 500 }, // same query, same answer
      { type: 'input', query: 'zzqx', at: 600 },
      { type: 'results', query: 'zzqx', options: [], at: 900 },
    ]);
    expect(events.filter(e => e.name === 'home_search_results').map(e => e.params)).toEqual([
      { result_state: 'empty', suggestion_count: 0, query_length: 3 },
      { result_state: 'empty', suggestion_count: 0, query_length: 4 },
    ]);
  });
});

describe('stepFunnel — submitting with Enter or the button', () => {
  it('opens the exact match when results are already on screen', () => {
    const { events, open } = drive([
      { type: 'input', query: 'endesa', at: 1 },
      { type: 'results', query: 'endesa', options: ENDESA, at: 300 },
      { type: 'submit', method: 'enter', query: 'endesa', options: ENDESA, loading: false, at: 900 },
    ]);
    expect(open).toEqual({ option: ENDESA[1], match: 'exact', rank: 2 });
    expect(events.at(-1)).toEqual({
      name: 'home_search_submitted',
      params: { method: 'enter', outcome: 'exact', suggestion_count: 2, query_length: 6 },
    });
  });

  it('holds a submit made while suggestions are still loading, then opens on arrival', () => {
    const typed = drive([
      { type: 'input', query: 'endesa', at: 1 },
      { type: 'submit', method: 'enter', query: 'endesa', options: [], loading: true, at: 100 },
    ]);
    expect(typed.open).toBeNull();
    expect(typed.events.at(-1)).toEqual({
      name: 'home_search_submitted',
      params: { method: 'enter', outcome: 'pending', suggestion_count: 0, query_length: 6 },
    });

    const arrived = drive([{ type: 'results', query: 'endesa', options: ENDESA, at: 400 }], typed.state);
    expect(arrived.open).toEqual({ option: ENDESA[1], match: 'exact', rank: 2 });
    expect(arrived.events.at(-1)).toEqual({
      name: 'home_search_submitted',
      params: { method: 'enter', outcome: 'exact', suggestion_count: 2, query_length: 6 },
    });
  });

  it('drops a held submit when the visitor keeps typing', () => {
    const { open, events } = drive([
      { type: 'input', query: 'ende', at: 1 },
      { type: 'submit', method: 'button', query: 'ende', options: [], loading: true, at: 100 },
      { type: 'input', query: 'endesa', at: 200 },
      { type: 'results', query: 'endesa', options: ENDESA, at: 500 },
    ]);
    expect(open).toBeNull();
    expect(names(events)).not.toContain('home_search_selection');
    expect(events.filter(e => e.name === 'home_search_submitted')).toHaveLength(1);
  });

  it('reports a submit that found nothing, and does not open anything', () => {
    const { open, events } = drive([
      { type: 'input', query: 'zzq', at: 1 },
      { type: 'results', query: 'zzq', options: [], at: 300 },
      { type: 'submit', method: 'button', query: 'zzq', options: [], loading: false, at: 900 },
    ]);
    expect(open).toBeNull();
    expect(events.at(-1).params).toMatchObject({ method: 'button', outcome: 'no_results' });
  });

  it('refuses a query too short to search rather than reporting no results', () => {
    const { events } = drive([{ type: 'submit', method: 'enter', query: 'e', options: [], loading: false, at: 9 }]);
    expect(events.at(-1).params).toMatchObject({ outcome: 'too_short', query_length: 1 });
  });
});

describe('stepFunnel — selection and abandonment', () => {
  it('describes a selection with how it was made and how it was matched', () => {
    const { events } = drive([
      { type: 'input', query: 'endesa', at: 1 },
      { type: 'results', query: 'endesa', options: ENDESA, at: 300 },
      { type: 'select', option: ENDESA[1], method: 'click', match: 'highlighted', rank: 2, options: ENDESA, at: 900 },
    ]);
    expect(events.at(-1)).toEqual({
      name: 'home_search_selection',
      params: {
        entity_type: 'company',
        selection_method: 'click',
        selection_match: 'highlighted',
        selection_rank: 2,
        suggestion_count: 2,
        time_to_selection_ms: 899,
      },
    });
  });

  it('counts blur after typing with results on screen as an abandoned search', () => {
    const { events } = drive([
      { type: 'focus', at: 1 },
      { type: 'input', query: 'endesa', at: 100 },
      { type: 'results', query: 'endesa', options: ENDESA, at: 400 },
      { type: 'blur', at: 5000 },
    ]);
    expect(events.at(-1)).toEqual({
      name: 'home_search_abandoned',
      params: { stage: 'results_shown', suggestion_count: 2, query_length: 6 },
    });
  });

  it('distinguishes leaving after a zero-result answer', () => {
    const { events } = drive([
      { type: 'input', query: 'zzq', at: 100 },
      { type: 'results', query: 'zzq', options: [], at: 400 },
      { type: 'blur', at: 5000 },
    ]);
    expect(events.at(-1).params).toMatchObject({ stage: 'zero_results' });
  });

  it('distinguishes leaving before any answer arrived', () => {
    const { events } = drive([
      { type: 'input', query: 'zz', at: 100 },
      { type: 'blur', at: 300 },
    ]);
    expect(events.at(-1).params).toMatchObject({ stage: 'typed', suggestion_count: 0 });
  });

  it('does not call a blur abandonment when nothing was typed or something was chosen', () => {
    const untouched = drive([{ type: 'focus', at: 1 }, { type: 'blur', at: 2 }]);
    expect(names(untouched.events)).not.toContain('home_search_abandoned');

    const chosen = drive([
      { type: 'input', query: 'endesa', at: 1 },
      { type: 'results', query: 'endesa', options: ENDESA, at: 300 },
      { type: 'select', option: ENDESA[1], method: 'click', match: 'highlighted', rank: 2, options: ENDESA, at: 900 },
      { type: 'blur', at: 950 },
    ]);
    expect(names(chosen.events)).not.toContain('home_search_abandoned');
  });

  it('reports one abandonment per typed query, not one per blur', () => {
    const { events } = drive([
      { type: 'input', query: 'endesa', at: 1 },
      { type: 'blur', at: 100 },
      { type: 'focus', at: 200 },
      { type: 'blur', at: 300 },
    ]);
    expect(events.filter(e => e.name === 'home_search_abandoned')).toHaveLength(1);
  });
});
