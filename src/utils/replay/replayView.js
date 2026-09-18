// The replay stage's zoom and pan, on top of the fit-to-canvas scale. A stage
// point p is drawn at centre + (x, y) + p * fit * k, so zooming about the
// cursor only has to keep (cursor - centre - pan) / k constant.

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;
export const IDENTITY_VIEW = Object.freeze({ k: 1, x: 0, y: 0 });

/**
 * Zoom by `factor` about a screen point, keeping that point fixed.
 * @param {{k:number,x:number,y:number}} view
 * @param {number} factor
 * @param {{x:number,y:number}} cursor - canvas-relative CSS pixels
 * @param {{x:number,y:number}} centre - the canvas centre, same units
 */
export const zoomAt = (view, factor, cursor, centre) => {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
  if (k === view.k) return view;
  const ratio = k / view.k;
  return {
    k,
    x: cursor.x - centre.x - (cursor.x - centre.x - view.x) * ratio,
    y: cursor.y - centre.y - (cursor.y - centre.y - view.y) * ratio,
  };
};

/** Pan by a screen-pixel delta. */
export const panBy = (view, dx, dy) => ({ k: view.k, x: view.x + dx, y: view.y + dy });
