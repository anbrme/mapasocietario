// Fixed positions for the replay stage. The subject sits at the origin and its
// counterparts on concentric rings, ordered clockwise from 12 o'clock by their
// FIRST act, so position reads as time too: a burst lands as one contiguous
// arc. Deterministic, so the same subject always gives the same picture and a
// screenshot is reproducible. Nothing ever moves during playback.

export const RING_BASE_RADIUS = 140;
const RING_GAP = 70;
const MIN_ARC_SPACING = 34;

/**
 * @param {{ id: string, firstAct: string }[]} counterparts - already in display order
 * @returns {{ positions: Map<string, {x: number, y: number}>, radius: number }}
 */
export const ringLayout = counterparts => {
  const positions = new Map();
  let radius = RING_BASE_RADIUS;
  let index = 0;

  while (index < counterparts.length) {
    const capacity = Math.max(6, Math.floor((2 * Math.PI * radius) / MIN_ARC_SPACING));
    const onRing = counterparts.slice(index, index + capacity);
    // A partly filled outer ring still spans the full circle, so the last
    // arrivals are not bunched into one sector.
    const step = (2 * Math.PI) / onRing.length;
    onRing.forEach((cp, i) => {
      const angle = -Math.PI / 2 + i * step;
      positions.set(cp.id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    });
    index += onRing.length;
    if (index < counterparts.length) radius += RING_GAP;
  }

  return { positions, radius: counterparts.length ? radius : 0 };
};
