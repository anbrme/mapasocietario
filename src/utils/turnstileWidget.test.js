import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTurnstileWidget } from './turnstileWidget';

function setup() {
  const widgets = new Map();
  let nextId = 0;
  const api = {
    render: vi.fn((container, options) => {
      const id = String(nextId++);
      widgets.set(id, { container, options, token: '' });
      return id;
    }),
    remove: vi.fn(id => widgets.delete(id)),
    getResponse: vi.fn(id => {
      if (!widgets.has(id)) throw new Error('Widget not found');
      return widgets.get(id).token;
    }),
    reset: vi.fn(id => {
      if (!widgets.has(id)) throw new Error('Nothing to reset found for provided container');
      widgets.get(id).token = '';
    }),
  };
  const onToken = vi.fn();
  const onError = vi.fn();
  const options = { getApi: () => api, getContainer: () => ({}), sitekey: 'test', onToken, onError };
  const solve = (id, token) => {
    widgets.get(id).token = token;
    widgets.get(id).options.callback(token);
  };
  return { api, widgets, onToken, onError, options, solve };
}

afterEach(() => vi.useRealTimers());

describe('Turnstile dialog lifecycle', () => {
  it('waits for both the script and the dialog container', () => {
    vi.useFakeTimers();
    const s = setup();
    let api;
    let container;
    const widget = createTurnstileWidget({ ...s.options, getApi: () => api, getContainer: () => container });
    expect(widget.getResponse()).toBe('');
    api = s.api;
    vi.advanceTimersByTime(200);
    expect(api.render).not.toHaveBeenCalled();
    container = {};
    vi.advanceTimersByTime(200);
    expect(api.render).toHaveBeenCalledTimes(1);
    s.solve('0', 'fresh-token');
    expect(widget.getResponse()).toBe('fresh-token');
    expect(s.onToken).toHaveBeenLastCalledWith('fresh-token');
    widget.dispose();
  });

  it('removes the closed dialog widget and uses a fresh ID after reopening', () => {
    const s = setup();
    const first = createTurnstileWidget(s.options);
    first.dispose();
    expect(s.api.remove).toHaveBeenCalledWith('0');
    const second = createTurnstileWidget(s.options);
    s.solve('1', 'new-token');
    expect(second.getResponse()).toBe('new-token');
    second.reset();
    expect(s.api.reset).toHaveBeenCalledWith('1');
    expect(second.getResponse()).toBe('');
    second.dispose();
  });

  it('ignores callbacks and failed requests from a closed dialog', () => {
    const s = setup();
    const first = createTurnstileWidget(s.options);
    const oldCallbacks = s.widgets.get('0').options;
    first.dispose();
    const second = createTurnstileWidget(s.options);
    oldCallbacks.callback('stale-token');
    oldCallbacks['error-callback']();
    first.reset();
    expect(first.getResponse()).toBe('');
    expect(s.onToken).not.toHaveBeenCalled();
    expect(s.onError).not.toHaveBeenCalled();
    expect(s.api.reset).not.toHaveBeenCalled();
    second.dispose();
  });

  it('re-renders a missing widget instead of throwing the reported reset error', () => {
    const s = setup();
    const widget = createTurnstileWidget(s.options);
    s.widgets.delete('0'); // Turnstile no longer recognizes the old ID.
    expect(() => widget.reset()).not.toThrow();
    expect(s.onToken).toHaveBeenLastCalledWith('');
    expect(s.api.render).toHaveBeenCalledTimes(2);
    s.solve('1', 'retry-token');
    expect(widget.getResponse()).toBe('retry-token');
    widget.dispose();
  });

  it('does not submit a stale response when the widget has disappeared', () => {
    const s = setup();
    const widget = createTurnstileWidget(s.options);
    s.solve('0', 'old-token');
    s.widgets.delete('0');
    expect(widget.getResponse()).toBe('');
    expect(s.onToken).toHaveBeenLastCalledWith('');
    s.solve('1', 'replacement-token');
    expect(widget.getResponse()).toBe('replacement-token');
    widget.dispose();
  });

  it('clears verification on expiration, timeout, and challenge failure', () => {
    const s = setup();
    const widget = createTurnstileWidget(s.options);
    for (const callback of ['expired-callback', 'timeout-callback', 'error-callback']) {
      s.solve('0', 'token');
      s.widgets.get('0').options[callback]();
      expect(s.onToken).toHaveBeenLastCalledWith('');
    }
    expect(s.onError).toHaveBeenCalledTimes(1);
    widget.dispose();
  });

  it('contains render and cleanup errors during recovery', () => {
    const s = setup();
    const widget = createTurnstileWidget(s.options);
    s.api.reset.mockImplementation(() => { throw new Error('Missing widget'); });
    s.api.remove.mockImplementation(() => { throw new Error('Missing widget'); });
    s.api.render.mockImplementation(() => { throw new Error('Script unavailable'); });
    expect(() => widget.reset()).not.toThrow();
    expect(s.onError).toHaveBeenCalledOnce();
    expect(() => widget.dispose()).not.toThrow();
  });

  it('cancels script polling on unmount (including a StrictMode cleanup)', () => {
    vi.useFakeTimers();
    const s = setup();
    const widget = createTurnstileWidget({ ...s.options, getContainer: () => null });
    widget.dispose();
    vi.advanceTimersByTime(1000);
    expect(s.api.render).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
