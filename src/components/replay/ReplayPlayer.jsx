import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { SIMPLIFIED_EXCLUDED_CATEGORIES } from '../../utils/positionCategories';
import { activityByMonth } from '../../utils/replay/replayModel';
import { replayStateAt, actsBetween } from '../../utils/replay/replayState';
import { ringLayout } from '../../utils/replay/replayLayout';
import { dayNumber, isoFromDay, nextActDay, prevActDay } from '../../utils/replay/replayClock';
import { isoDayLong } from '../../utils/isoDay';
import { trackEvent } from '../../utils/track';
import useReplayClock from './useReplayClock';
import ReplayCanvas from './ReplayCanvas';
import ReplayControls from './ReplayControls';
import ReplayLedger from './ReplayLedger';

const NO_CATEGORIES = new Set();
// Above this many drawn counterparts, labelling everyone who moves turns the
// stage into text; labels then appear on hover only.
const DENSE_COUNTERPARTS = 400;
// A jump across more acts than this (a ledger click years ahead) is not
// replayed as flashes: it would be a wall of simultaneous colour.
const MAX_FLASHES_PER_STEP = 50;
const ANNOUNCE_EVERY_MS = 1000;
const LEDGER_WIDTH = 300;

/** Index of the last act on or before `iso`, or -1. Acts are date-ascending. */
const lastActIndexAt = (acts, iso) => {
  let lo = 0;
  let hi = acts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (acts[mid].date <= iso) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
};

export default function ReplayPlayer({ model, copy, language, isNarrow, reducedMotion }) {
  const [showPast, setShowPast] = useState(true);
  const [includeApoderados, setIncludeApoderados] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(!isNarrow);
  const [announcement, setAnnouncement] = useState('');
  const flashesRef = useRef([]);
  const scrubbingRef = useRef(false);
  const prevIsoRef = useRef(model.domain.start);
  const trackedRef = useRef({});
  const lastAnnounceRef = useRef(0);

  const isCompany = model.subject.kind === 'company';
  const hiddenCategories = isCompany && !includeApoderados ? SIMPLIFIED_EXCLUDED_CATEGORIES : NO_CATEGORIES;
  const analytics = useMemo(() => ({
    subject_kind: model.subject.kind,
    acts_total: model.acts.length,
    truncated: model.completeness.truncatedBefore ? 1 : 0,
  }), [model]);

  const visibleCounterparts = useMemo(() => {
    const visible = new Set(model.terms.filter(t => !hiddenCategories.has(t.category)).map(t => t.counterpartId));
    return model.counterparts.filter(c => visible.has(c.id));
  }, [model, hiddenCategories]);
  const layout = useMemo(() => ringLayout(visibleCounterparts), [visibleCounterparts]);
  const names = useMemo(() => new Map(model.counterparts.map(c => [c.id, c.name])), [model]);
  const bins = useMemo(() => activityByMonth(model, { hiddenCategories }), [model, hiddenCategories]);
  const hiddenActs = useMemo(() => bins.reduce((sum, b) => sum + b.hidden, 0), [bins]);

  const startDay = dayNumber(model.domain.start);
  const endDay = dayNumber(model.domain.end);
  const clock = useReplayClock({ startDay, endDay, acts: model.acts, reducedMotion });
  const iso = isoFromDay(clock.day);
  const state = useMemo(() => replayStateAt(model, iso, { hiddenCategories }), [model, iso, hiddenCategories]);
  const currentIndex = lastActIndexAt(model.acts, iso);

  // Flashes for acts the clock crossed moving forward — not while scrubbing.
  useEffect(() => {
    const prev = prevIsoRef.current;
    prevIsoRef.current = iso;
    if (scrubbingRef.current || iso <= prev) return;
    const crossed = actsBetween(model, prev, iso).filter(a => !hiddenCategories.has(a.category));
    if (crossed.length > MAX_FLASHES_PER_STEP) return;
    const at = performance.now();
    crossed.forEach(act => flashesRef.current.push({ act, at }));
  }, [iso, model, hiddenCategories]);

  // Throttled screen-reader line: the date and the act just passed.
  useEffect(() => {
    const now = Date.now();
    if (now - lastAnnounceRef.current < ANNOUNCE_EVERY_MS) return;
    lastAnnounceRef.current = now;
    const act = model.acts[currentIndex];
    const actText = act ? ` — ${act.kind === 'appointment' ? copy.appointment : act.kind === 'cessation' ? copy.cessation : copy.closure}: ${names.get(act.counterpartId)}, ${act.role}` : '';
    setAnnouncement(`${isoDayLong(iso, language)}${actText}`);
  // Keyed on the act index alone: the line changes when an act is passed, not
  // on every frame the date moves.
  }, [currentIndex]);

  // Reaching the end while playing is a completed replay.
  useEffect(() => {
    if (!clock.playing && clock.day >= endDay && trackedRef.current.play && !trackedRef.current.complete) {
      trackedRef.current.complete = true;
      trackEvent('replay_complete', analytics);
    }
  }, [clock.playing, clock.day, endDay, analytics]);

  const trackOnce = (key, event) => {
    if (trackedRef.current[key]) return;
    trackedRef.current[key] = true;
    trackEvent(event, analytics);
  };
  const play = () => {
    scrubbingRef.current = false;
    trackOnce('play', 'replay_play');
    clock.play();
  };
  const scrubStart = () => {
    scrubbingRef.current = true;
    clock.pause();
    trackOnce('scrub', 'replay_scrub');
  };
  const stepTo = day => {
    scrubbingRef.current = false;
    clock.seek(day);
  };
  const next = nextActDay(model.acts, clock.day);
  const onNextAct = () => {
    if (next === null) { stepTo(endDay); return; }
    // One day before the act, and keep playing: the act lands as it would have.
    stepTo(next - 1);
    play();
  };
  const onSeekAct = act => { clock.pause(); stepTo(dayNumber(act.date)); };

  const onKeyDown = e => {
    if (e.target?.getAttribute?.('role') === 'slider') return;
    if (e.key === ' ') { e.preventDefault(); (clock.playing ? clock.pause : play)(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); clock.pause(); stepTo(next ?? endDay); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); clock.pause(); stepTo(prevActDay(model.acts, clock.day) ?? startDay); }
    else if (e.key === 'Home') { e.preventDefault(); clock.pause(); stepTo(startDay); }
    else if (e.key === 'End') { e.preventDefault(); clock.pause(); stepTo(endDay); }
  };

  const { truncatedBefore, recordsBegin, loaded, total } = model.completeness;
  const hasUnknownStart = model.terms.some(t => t.from === null && !hiddenCategories.has(t.category));
  const hasInferred = model.terms.some(t => t.endKind === 'inferred' && !hiddenCategories.has(t.category));
  const isDense = visibleCounterparts.length > DENSE_COUNTERPARTS;
  const notes = [
    recordsBegin && copy.recordsBegin(isoDayLong(recordsBegin, language)),
    hasUnknownStart && copy.unknownStartNote,
    hasInferred && copy.inferredNote,
    isDense && copy.dense(visibleCounterparts.length),
  ].filter(Boolean);

  const ledger = (
    <ReplayLedger
      model={model}
      currentIndex={currentIndex}
      names={names}
      hiddenCategories={hiddenCategories}
      copy={copy}
      language={language}
      onSeekAct={onSeekAct}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, outline: 'none' }} tabIndex={0} onKeyDown={onKeyDown}>
      {truncatedBefore && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          {copy.truncated(isoDayLong(truncatedBefore, language), Math.max(0, (total || 0) - (loaded || 0)))}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', flex: 1, minHeight: 0 }}>
        <ReplayCanvas
          model={model}
          positions={layout.positions}
          radius={layout.radius}
          state={state}
          showPast={showPast}
          labelChanges={!isDense}
          flashesRef={flashesRef}
          ariaLabel={`${copy.title}: ${model.subject.name}`}
          labels={{ zoomIn: copy.zoomIn, zoomOut: copy.zoomOut, resetView: copy.resetView }}
        />
        {ledgerOpen && (
          <Box sx={{
            width: isNarrow ? '100%' : LEDGER_WIDTH, maxHeight: isNarrow ? '35vh' : 'none',
            display: 'flex', flexDirection: 'column', borderLeft: isNarrow ? 0 : '1px solid', borderTop: isNarrow ? '1px solid' : 0, borderColor: 'divider',
          }}>
            <Typography variant="overline" sx={{ px: 1.5, pt: 0.5 }}>
              {copy.ledger} · {copy.actsCount(model.acts.length)}
            </Typography>
            {ledger}
          </Box>
        )}
      </Box>
      <Box sx={{ px: 2, pt: 0.5, display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {notes.map(note => (
            <Typography key={note} variant="caption" color="text.secondary" sx={{ display: 'block' }}>{note}</Typography>
          ))}
        </Box>
        <Button size="small" onClick={() => setLedgerOpen(o => !o)} sx={{ textTransform: 'none' }}>
          {ledgerOpen ? copy.hideLedger : copy.showLedger}
        </Button>
      </Box>
      <ReplayControls
        copy={copy}
        language={language}
        domain={model.domain}
        day={clock.day}
        playing={clock.playing}
        speed={clock.speed}
        bins={bins}
        hasNextAct={next !== null}
        hiddenActs={hiddenActs}
        showPast={showPast}
        includeApoderados={includeApoderados}
        canFilterApoderados={isCompany}
        onPlay={play}
        onPause={clock.pause}
        onNextAct={onNextAct}
        onSeek={clock.seek}
        onScrubStart={scrubStart}
        onSpeed={clock.setSpeed}
        onShowPast={setShowPast}
        onIncludeApoderados={setIncludeApoderados}
      />
      <Box aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {announcement}
      </Box>
    </Box>
  );
}
