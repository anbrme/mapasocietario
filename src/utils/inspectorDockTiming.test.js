import { describe, it, expect } from 'vitest';
import { shouldDeferInspectorOpen } from './inspectorDockTiming';

// Docking the inspector narrows the canvas and moves every node. Done on the
// first click of a double-click, it moves the node out from under the second
// click, which is then lost. So when a click would DOCK the inspector, the
// dock waits until the double-click window has passed. When the inspector is
// already docked, or never reserves width (compact viewports use a sheet),
// a click changes nothing in the layout and the inspector opens at once.

describe('shouldDeferInspectorOpen', () => {
  it('defers when the click would dock a closed inspector', () => {
    expect(shouldDeferInspectorOpen({ previewOpen: false, isInspectorDockable: true })).toBe(true);
  });

  it('opens at once when the inspector is already docked', () => {
    expect(shouldDeferInspectorOpen({ previewOpen: true, isInspectorDockable: true })).toBe(false);
  });

  it('opens at once where the inspector never reserves canvas width', () => {
    expect(shouldDeferInspectorOpen({ previewOpen: false, isInspectorDockable: false })).toBe(false);
  });
});
