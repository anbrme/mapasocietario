import { describe, it, expect } from 'vitest';
import { autoFitDecision } from './graphAutoFit';

// The auto-fit used to fire only when the node COUNT changed. It missed the
// two cases that leave a small graph off-screen: the canvas mounting after the
// data (a background tab: the fit ran with no canvas to fit, and the library's
// own zoom then framed the empty origin), and a new graph with the same count
// as the last one (the counter never reset on clear). Both are decided here.

const previous = (count, ready) => ({ count, ready });

describe('autoFitDecision', () => {
  it('fits the first data once the canvas is ready', () => {
    const d = autoFitDecision({ count: 2, containerReady: true, snapshotMode: false, previous: previous(0, false) });
    expect(d.fit).toBe(true);
    expect(d.next).toEqual({ count: 2, ready: true });
  });

  it('does not fit while the canvas is not ready, and remembers that it did not', () => {
    const d = autoFitDecision({ count: 2, containerReady: false, snapshotMode: false, previous: previous(0, false) });
    expect(d.fit).toBe(false);
    expect(d.next).toEqual({ count: 2, ready: false });
  });

  it('fits when the canvas becomes ready with the nodes already present', () => {
    const d = autoFitDecision({ count: 2, containerReady: true, snapshotMode: false, previous: previous(2, false) });
    expect(d.fit).toBe(true);
  });

  it('fits when the count changes on a ready canvas', () => {
    const d = autoFitDecision({ count: 8, containerReady: true, snapshotMode: false, previous: previous(2, true) });
    expect(d.fit).toBe(true);
  });

  it('stays still when nothing changed', () => {
    const d = autoFitDecision({ count: 2, containerReady: true, snapshotMode: false, previous: previous(2, true) });
    expect(d.fit).toBe(false);
  });

  it('forgets the count when the graph is cleared, so the same count fits again', () => {
    const cleared = autoFitDecision({ count: 0, containerReady: true, snapshotMode: false, previous: previous(2, true) });
    expect(cleared.fit).toBe(false);
    expect(cleared.next).toEqual({ count: 0, ready: true });
    const again = autoFitDecision({ count: 2, containerReady: true, snapshotMode: false, previous: cleared.next });
    expect(again.fit).toBe(true);
  });

  it('never fits an imported snapshot, which carries its own camera', () => {
    const d = autoFitDecision({ count: 5, containerReady: true, snapshotMode: true, previous: previous(0, false) });
    expect(d.fit).toBe(false);
    expect(d.next).toEqual({ count: 5, ready: true });
  });
});
