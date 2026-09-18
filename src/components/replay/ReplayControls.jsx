import React, { useMemo } from 'react';
import {
  Box, IconButton, Slider, ToggleButton, ToggleButtonGroup, Tooltip, Typography, FormControlLabel, Switch, Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { isoDayLong } from '../../utils/isoDay';
import { dayNumber, isoFromDay } from '../../utils/replay/replayClock';

export const SPEEDS = [0.5, 1, 2, 4];
const STRIP_HEIGHT = 40;

/**
 * Acts per month, stacked: appointments, cessations, then hidden acts in a
 * faint tone on top. Shares the scrubber's x-axis, so a burst is visible
 * before anyone presses play and can be clicked straight into.
 */
function ActivityStrip({ bins, playheadFraction, onSeekFraction, copy }) {
  const theme = useTheme();
  const link = theme.palette.graph.link;
  const max = Math.max(1, ...bins.map(b => b.appointments + b.cessations + b.hidden));
  const n = Math.max(1, bins.length);
  const onClick = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeekFraction((e.clientX - rect.left) / rect.width);
  };

  return (
    <Box sx={{ position: 'relative', height: STRIP_HEIGHT, cursor: 'pointer' }} onClick={onClick} aria-hidden="true">
      <svg width="100%" height={STRIP_HEIGHT} viewBox={`0 0 ${n} ${STRIP_HEIGHT}`} preserveAspectRatio="none">
        {bins.map((b, i) => {
          const scale = STRIP_HEIGHT / max;
          const a = b.appointments * scale;
          const c = b.cessations * scale;
          const h = b.hidden * scale;
          return (
            <g key={b.month}>
              <rect x={i + 0.1} width={0.8} y={STRIP_HEIGHT - a} height={a} fill={link.appointment} />
              <rect x={i + 0.1} width={0.8} y={STRIP_HEIGHT - a - c} height={c} fill={link.cessation} />
              <rect x={i + 0.1} width={0.8} y={STRIP_HEIGHT - a - c - h} height={h} fill={link.unknown} opacity={0.35} />
            </g>
          );
        })}
      </svg>
      <Box sx={{
        position: 'absolute', top: 0, bottom: 0, left: `${playheadFraction * 100}%`,
        borderLeft: '2px solid', borderColor: 'text.primary', pointerEvents: 'none',
      }} />
      <Box sx={{ position: 'absolute', right: 0, top: -2, display: 'flex', gap: 1 }}>
        <Typography variant="caption" sx={{ color: link.appointment, fontSize: '0.65rem' }}>{copy.legendAppointments}</Typography>
        <Typography variant="caption" sx={{ color: link.cessation, fontSize: '0.65rem' }}>{copy.legendCessations}</Typography>
      </Box>
    </Box>
  );
}

export default function ReplayControls({
  copy, language, domain, day, playing, speed, bins, hasNextAct, hiddenActs,
  showPast, includeApoderados, canFilterApoderados,
  onPlay, onPause, onNextAct, onSeek, onScrubStart, onSpeed, onShowPast, onIncludeApoderados,
}) {
  const startDay = useMemo(() => dayNumber(domain.start), [domain.start]);
  const endDay = useMemo(() => dayNumber(domain.end), [domain.end]);
  const span = Math.max(1, endDay - startDay);
  const iso = isoFromDay(day);

  return (
    <Box sx={{ px: 2, pt: 1, pb: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} aria-hidden="true">
        {isoDayLong(iso, language)}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          · {copy.publicationDate}
        </Typography>
      </Typography>

      <ActivityStrip
        bins={bins}
        copy={copy}
        playheadFraction={(day - startDay) / span}
        onSeekFraction={f => { onScrubStart(); onSeek(startDay + f * span); }}
      />
      <Slider
        size="small"
        min={startDay}
        max={endDay}
        step={1}
        value={Math.floor(day)}
        onChange={(_, v) => { onScrubStart(); onSeek(v); }}
        valueLabelDisplay="off"
        aria-label={copy.publicationDate}
        getAriaValueText={v => isoDayLong(isoFromDay(v), language)}
        // No transitions: the clock sets a new value every frame, and MUI's
        // 150 ms ease-in restarts each time from a near-flat start, so the
        // thumb crawled at the domain start while the replay reached 2020.
        sx={{ mt: -0.5, py: 1, '& .MuiSlider-thumb, & .MuiSlider-track': { transition: 'none' } }}
      />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Tooltip title={playing ? copy.pause : copy.play}>
          <IconButton color="primary" onClick={playing ? onPause : onPlay} aria-label={playing ? copy.pause : copy.play}>
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>
        <Button size="small" startIcon={<SkipNextIcon />} onClick={onNextAct} sx={{ textTransform: 'none' }}>
          {hasNextAct ? copy.nextAct : copy.skipToEnd}
        </Button>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={speed}
          onChange={(_, v) => v && onSpeed(v)}
          aria-label={copy.speed}
        >
          {SPEEDS.map(s => (
            <ToggleButton key={s} value={s} sx={{ px: 1, py: 0.25, textTransform: 'none' }}>{`${s}×`}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Switch size="small" checked={showPast} onChange={e => onShowPast(e.target.checked)} />}
          label={<Typography variant="body2">{copy.showPast}</Typography>}
          sx={{ ml: 1 }}
        />
        {canFilterApoderados && (
          <FormControlLabel
            control={<Switch size="small" checked={includeApoderados} onChange={e => onIncludeApoderados(e.target.checked)} />}
            label={<Typography variant="body2">{copy.includeApoderados}</Typography>}
          />
        )}
        {hiddenActs > 0 && (
          <Typography variant="caption" color="text.secondary">{copy.hiddenCount(hiddenActs)}</Typography>
        )}
      </Box>
    </Box>
  );
}
