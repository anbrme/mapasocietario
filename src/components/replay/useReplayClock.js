import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceDays, nextActDay } from '../../utils/replay/replayClock';

// A frame gap longer than this (a background tab, a GC pause) is not played as
// history: the clock would jump years in one frame and skip every flash.
const MAX_FRAME_MS = 100;
const REDUCED_MOTION_STEP_MS = 1000;

/**
 * The replay clock: a fractional day number that advances linearly while
 * playing. Under reduced motion it steps from act to act once a second
 * instead, so nothing slides.
 */
export default function useReplayClock({ startDay, endDay, acts, reducedMotion }) {
  const [day, setDay] = useState(startDay);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const dayRef = useRef(startDay);

  const seek = useCallback(target => {
    const clamped = Math.min(endDay, Math.max(startDay, target));
    dayRef.current = clamped;
    setDay(clamped);
  }, [startDay, endDay]);

  useEffect(() => {
    dayRef.current = startDay;
    setDay(startDay);
    setPlaying(false);
  }, [startDay, endDay]);

  useEffect(() => {
    if (!playing) return undefined;

    if (reducedMotion) {
      const timer = setInterval(() => {
        const next = nextActDay(acts, dayRef.current) ?? endDay;
        seek(next);
        if (next >= endDay) setPlaying(false);
      }, REDUCED_MOTION_STEP_MS);
      return () => clearInterval(timer);
    }

    let raf = 0;
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(now - last, MAX_FRAME_MS);
      last = now;
      const next = Math.min(endDay, dayRef.current + advanceDays(dt, speed));
      seek(next);
      if (next >= endDay) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, endDay, acts, reducedMotion, seek]);

  const play = useCallback(() => {
    if (dayRef.current >= endDay) seek(startDay);
    setPlaying(true);
  }, [endDay, startDay, seek]);
  const pause = useCallback(() => setPlaying(false), []);

  return { day, playing, speed, setSpeed, play, pause, seek };
}
