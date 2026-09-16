import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectionIndex, connectionFocus, connectionPress, toggleConnectionRoot } from './connectionFocus';

describe('direct connection focus', () => {
  const graph = {
    nodes: ['a', 'b', 'c', 'd', 'isolated'].map(id => ({ id })),
    links: [
      { source: 'a', target: { id: 'b' } }, { source: 'b', target: 'c' },
      { source: 'c', target: 'd' }, { source: 'a', target: 'hidden' },
    ],
  };
  const index = connectionIndex(graph);
  it('highlights only one hop, treating incoming and outgoing edges alike', () => {
    expect([...connectionFocus(index, new Set(), 'b').nodes].sort()).toEqual(['a', 'b', 'c']);
    expect([...connectionFocus(index, new Set(), 'a').nodes].sort()).toEqual(['a', 'b']);
  });
  it('unions locked neighborhoods with a temporary hover, then restores locks', () => {
    const locked = new Set(['a']);
    expect(connectionFocus(index, locked, 'd').nodes.size).toBe(4);
    expect([...connectionFocus(index, locked, null).nodes]).toEqual(['a', 'b']);
    expect([...locked]).toEqual(['a']);
  });
  it('ignores hidden roots and handles isolated nodes and normalized ids', () => {
    expect(connectionFocus(index, new Set(['gone']), null).active).toBe(false);
    expect([...connectionFocus(index, new Set(), 'isolated').nodes]).toEqual(['isolated']);
    expect(connectionFocus(connectionIndex({ nodes: [{ id: 1 }], links: [] }), new Set(), 1).active).toBe(true);
  });
  it('replaces on an ordinary hold and toggles on a modified hold', () => {
    const locked = new Set(['a']);
    expect([...toggleConnectionRoot(locked, 'b', false)]).toEqual(['b']);
    expect([...toggleConnectionRoot(locked, 'b', true)]).toEqual(['a', 'b']);
    expect([...toggleConnectionRoot(locked, 'a', true)]).toEqual([]);
    expect([...locked]).toEqual(['a']);
  });
});

describe('connection hold gesture', () => {
  afterEach(() => vi.useRealTimers());
  const event = extra => ({ button: 0, isPrimary: true, pointerId: 1, clientX: 20, clientY: 20, timeStamp: 100, ...extra });
  function setup() {
    vi.useFakeTimers();
    const held = vi.fn();
    return { held, press: connectionPress(held) };
  }
  it('preserves a short click and locks only after 500ms', () => {
    const { held, press } = setup();
    press.begin('a', event());
    vi.advanceTimersByTime(499);
    expect(held).not.toHaveBeenCalled();
    press.end(event());
    vi.advanceTimersByTime(20);
    expect(held).not.toHaveBeenCalled();
    expect(press.suppresses(event())).toBe(false);
    press.begin('a', event({ shiftKey: true }));
    vi.advanceTimersByTime(500);
    expect(held).toHaveBeenCalledWith('a', true);
    press.end(event({ timeStamp: 900 }));
    expect(press.suppresses(event({ timeStamp: 900 }))).toBe(true);
    // A subsequent short click must still work.
    expect(press.suppresses(event({ timeStamp: 1000 }))).toBe(false);
  });
  it.each(['shiftKey', 'metaKey', 'ctrlKey'])('supports %s as an additive modifier', key => {
    const { held, press } = setup();
    press.begin('a', event({ [key]: true }));
    vi.advanceTimersByTime(500);
    expect(held).toHaveBeenCalledWith('a', true);
    press.cancel();
  });
  it('cancels when dragging beyond the tolerance, but tolerates tiny jitter', () => {
    const { held, press } = setup();
    press.begin('a', event());
    press.move(event({ clientX: 24 }));
    vi.advanceTimersByTime(250);
    press.move(event({ clientX: 26 }));
    vi.advanceTimersByTime(500);
    expect(held).not.toHaveBeenCalled();
  });
  it('does not let another pointer release the gesture; cancellation and right click never lock', () => {
    const { held, press } = setup();
    press.begin('a', event());
    press.end(event({ pointerId: 2 }));
    vi.advanceTimersByTime(500);
    expect(held).toHaveBeenCalledTimes(1);
    press.cancel();
    press.begin('b', event());
    press.cancel();
    press.begin('c', event({ button: 2 }));
    vi.advanceTimersByTime(500);
    expect(held).toHaveBeenCalledTimes(1);
  });
});
