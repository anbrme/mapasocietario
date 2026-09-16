import { useCallback, useEffect, useRef, useState } from 'react';
import { LASSO_MIN_DRAG_PX, nodesInRect, rectFromPoints } from '../utils/lassoSelect';

// Shift-drag on empty canvas draws a rectangle; on release every positioned
// node inside it is handed to onSelect. The caller decides whether a pointer
// down starts a lasso (it must not sit on a node: Shift + hold on a node is
// the connection gesture) by calling `begin(event)` from its pointerdown
// capture handler. While a lasso is live the hook swallows the mousedown so
// d3-zoom does not pan, and the click that follows the release so the
// background-click handler does not clear what was just selected.
//
// `rect` is in container pixels, for an overlay; `null` when no lasso shows.
export function useLassoSelect({ containerEl, fgRef, getNodes, onSelect }) {
  const [rect, setRect] = useState(null);
  const gestureRef = useRef(null);   // { pointerId, start, current, dragged }
  const swallowClickRef = useRef(false);

  const toLocal = useCallback(event => {
    const box = containerEl?.getBoundingClientRect();
    if (!box) return null;
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }, [containerEl]);

  const begin = useCallback(event => {
    if (!event.shiftKey || event.button !== 0 || event.isPrimary === false) return false;
    const start = toLocal(event);
    if (!start) return false;
    gestureRef.current = { pointerId: event.pointerId, start, current: start, dragged: false };
    // Keep the pointerdown from reaching force-graph's own listeners.
    event.stopPropagation();
    return true;
  }, [toLocal]);

  useEffect(() => {
    const move = event => {
      const g = gestureRef.current;
      if (!g || event.pointerId !== g.pointerId) return;
      const current = toLocal(event);
      if (!current) return;
      g.current = current;
      if (!g.dragged && Math.hypot(current.x - g.start.x, current.y - g.start.y) >= LASSO_MIN_DRAG_PX) {
        g.dragged = true;
      }
      if (g.dragged) setRect(rectFromPoints(g.start, current));
    };
    const finish = event => {
      const g = gestureRef.current;
      if (!g || event.pointerId !== g.pointerId) return;
      gestureRef.current = null;
      setRect(null);
      if (!g.dragged) return;
      swallowClickRef.current = true;
      const fg = fgRef?.current;
      if (!fg?.screen2GraphCoords) return;
      const a = fg.screen2GraphCoords(g.start.x, g.start.y);
      const b = fg.screen2GraphCoords(g.current.x, g.current.y);
      if (!a || !b) return;
      const ids = nodesInRect(getNodes?.() || [], a, b);
      if (ids.length > 0) onSelect?.(ids);
    };
    const cancel = () => {
      gestureRef.current = null;
      setRect(null);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', cancel);
    return () => {
      cancel();
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', cancel);
    };
  }, [toLocal, fgRef, getNodes, onSelect]);

  // d3-zoom listens for mousedown on the canvas; a live lasso must not pan.
  const onMouseDownCapture = useCallback(event => {
    if (gestureRef.current) { event.stopPropagation(); event.preventDefault(); }
  }, []);

  // The click after a lasso release would otherwise reach the background
  // handler (and force-graph's own click), which treat it as "clicked nothing".
  const onClickCapture = useCallback(event => {
    if (!swallowClickRef.current) return;
    swallowClickRef.current = false;
    event.stopPropagation();
    event.preventDefault();
  }, []);

  return { rect, begin, onMouseDownCapture, onClickCapture, isActive: rect != null };
}
