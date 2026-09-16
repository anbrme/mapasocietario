const idOf = ref => String(ref && typeof ref === 'object' ? ref.id : ref);

// Rebuilt only when the visible graph changes, never on pointer movement.
export function connectionIndex({ nodes, links }) {
  const index = new Map(nodes.map(node => [idOf(node.id), new Set()]));
  for (const link of links) {
    const source = idOf(link.source), target = idOf(link.target);
    if (!index.has(source) || !index.has(target)) continue;
    index.get(source).add(target);
    index.get(target).add(source);
  }
  return index;
}

export function connectionFocus(index, locked, hovered) {
  const roots = new Set([...locked].filter(id => index.has(id)));
  if (hovered != null && index.has(String(hovered))) roots.add(String(hovered));
  const nodes = new Set(roots);
  for (const root of roots) for (const neighbor of index.get(root)) nodes.add(neighbor);
  return { roots, nodes, active: roots.size > 0 };
}

export function toggleConnectionRoot(previous, id, additive) {
  if (!additive) return new Set([id]);
  const next = new Set(previous);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

// force-graph fires its click callback on the frame AFTER pointerup. Remember
// the release event, rather than clearing click suppression on pointerup.
export function connectionPress(onHold, { delay = 500, tolerance = 5 } = {}) {
  let press = null;
  const suppressedReleases = new Set();
  const cancel = () => {
    if (press) clearTimeout(press.timer);
    press = null;
  };
  return {
    cancel,
    begin(id, event) {
      cancel();
      if (id == null || event.button !== 0 || event.isPrimary === false) return;
      const current = {
        id, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        additive: event.shiftKey || event.metaKey || event.ctrlKey, fired: false,
      };
      press = current;
      current.timer = setTimeout(() => {
        current.fired = true;
        onHold(current.id, current.additive);
      }, delay);
    },
    move(event) {
      if (!press || event.pointerId !== press.pointerId) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > tolerance) {
        clearTimeout(press.timer);
        // Retain a completed hold until release to suppress its click.
        if (!press.fired) press = null;
      }
    },
    end(event) {
      if (!press || event.pointerId !== press.pointerId) return;
      if (press.fired) {
        suppressedReleases.add(event.timeStamp);
        if (suppressedReleases.size > 8) suppressedReleases.delete(suppressedReleases.values().next().value);
      }
      cancel();
    },
    suppresses(event) { return suppressedReleases.has(event?.timeStamp); },
  };
}
