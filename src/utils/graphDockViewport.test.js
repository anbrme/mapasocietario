import { describe, it, expect } from 'vitest';
import { anchoredCentre, DOCK_ANCHOR_PADDING } from './graphDockViewport';

// force-graph maps graph space to canvas pixels as
//   screen = (graph - centre) * zoom + size / 2
// so a centre is only correct if it puts the node back at the same pixel.
const screenOf = (graph, centre, zoom, size) => (graph - centre) * zoom + size / 2;

describe('anchoredCentre', () => {
  it('keeps a node at the pixel it occupied before the panel docked', () => {
    const node = { x: 120, y: -40 };
    const zoom = 1.5;
    const before = { width: 1200, height: 800 };
    const after = { width: 860, height: 800 };
    const screen = {
      x: screenOf(node.x, 0, zoom, before.width),
      y: screenOf(node.y, 0, zoom, before.height),
    };

    const centre = anchoredCentre({ node, zoom, canvas: after, screen });

    expect(screenOf(node.x, centre.x, zoom, after.width)).toBeCloseTo(screen.x, 6);
    expect(screenOf(node.y, centre.y, zoom, after.height)).toBeCloseTo(screen.y, 6);
  });

  it('brings a node the panel would now cover just inside the canvas', () => {
    const node = { x: 400, y: 0 };
    const zoom = 1;
    const after = { width: 700, height: 600 };
    // The node sat at x=1050 in the old 1200px canvas — under the dock now.
    const centre = anchoredCentre({ node, zoom, canvas: after, screen: { x: 1050, y: 300 } });

    const x = screenOf(node.x, centre.x, zoom, after.width);
    expect(x).toBeCloseTo(after.width - DOCK_ANCHOR_PADDING, 6);
    expect(x).toBeLessThan(after.width);
  });

  it('pushes a node off the left edge back inside too', () => {
    const node = { x: -300, y: 0 };
    const after = { width: 700, height: 600 };
    const centre = anchoredCentre({ node, zoom: 2, canvas: after, screen: { x: -90, y: 300 } });

    expect(screenOf(node.x, centre.x, 2, after.width)).toBeCloseTo(DOCK_ANCHOR_PADDING, 6);
  });

  it('centres the node when no previous screen position is known', () => {
    const node = { x: 10, y: 20 };
    const centre = anchoredCentre({ node, zoom: 1, canvas: { width: 800, height: 600 }, screen: null });
    expect(centre).toEqual({ x: 10, y: 20 });
  });

  it('centres the node on a canvas too small for the padding', () => {
    const node = { x: 10, y: 20 };
    const centre = anchoredCentre({
      node, zoom: 1, canvas: { width: 100, height: 90 }, screen: { x: 0, y: 0 },
    });
    expect(centre).toEqual({ x: 10, y: 20 });
  });

  it('returns null rather than a camera the caller cannot trust', () => {
    const canvas = { width: 800, height: 600 };
    expect(anchoredCentre({ node: { x: 1, y: 1 }, zoom: 0, canvas })).toBeNull();
    expect(anchoredCentre({ node: { x: 1, y: 1 }, zoom: NaN, canvas })).toBeNull();
    expect(anchoredCentre({ node: {}, zoom: 1, canvas })).toBeNull();
    expect(anchoredCentre({ node: null, zoom: 1, canvas })).toBeNull();
    expect(anchoredCentre({ node: { x: 1, y: 1 }, zoom: 1, canvas: { width: 0, height: 600 } })).toBeNull();
  });
});
