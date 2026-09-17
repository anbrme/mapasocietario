import { describe, it, expect } from 'vitest';
import { rememberFirstClick, shiftedDoubleClickTarget } from './inspectorDockDoubleClick';

// The first click on a node docks the inspector, the canvas narrows to make
// room, and the graph re-frames. The second click of a double-click then lands
// where the node WAS: on empty canvas, or on a neighbour that slid under the
// pointer. The helper recognises that sequence and names the node the reader
// meant, so the double-click still expands it.

const THRESHOLD = 450;

describe('shiftedDoubleClickTarget', () => {
  it('names the first node when the second click comes fast and the inspector docked in between', () => {
    const last = rememberFirstClick({ nodeId: 'company-a', time: 1000, reservedInspectorWidth: 0 });

    const target = shiftedDoubleClickTarget(last, {
      now: 1200,
      threshold: THRESHOLD,
      reservedInspectorWidth: 420,
    });

    expect(target).toBe('company-a');
  });

  it('stays out of the way when the canvas did not shift (inspector already docked)', () => {
    const last = rememberFirstClick({ nodeId: 'company-a', time: 1000, reservedInspectorWidth: 420 });

    const target = shiftedDoubleClickTarget(last, {
      now: 1200,
      threshold: THRESHOLD,
      reservedInspectorWidth: 420,
    });

    expect(target).toBeNull();
  });

  it('treats a slow second click as an ordinary click', () => {
    const last = rememberFirstClick({ nodeId: 'company-a', time: 1000, reservedInspectorWidth: 0 });

    const target = shiftedDoubleClickTarget(last, {
      now: 1000 + THRESHOLD,
      threshold: THRESHOLD,
      reservedInspectorWidth: 420,
    });

    expect(target).toBeNull();
  });

  it('returns nothing when no node was clicked first', () => {
    expect(
      shiftedDoubleClickTarget({ nodeId: null, time: 0 }, {
        now: 100,
        threshold: THRESHOLD,
        reservedInspectorWidth: 420,
      })
    ).toBeNull();
    expect(
      shiftedDoubleClickTarget(null, { now: 100, threshold: THRESHOLD, reservedInspectorWidth: 420 })
    ).toBeNull();
  });
});

describe('rememberFirstClick', () => {
  it('records the node, the moment and the inspector reserve at that moment', () => {
    expect(rememberFirstClick({ nodeId: 'officer-x', time: 5, reservedInspectorWidth: 0 })).toEqual({
      nodeId: 'officer-x',
      time: 5,
      reservedInspectorWidth: 0,
    });
  });
});
