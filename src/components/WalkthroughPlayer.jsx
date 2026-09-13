// src/components/WalkthroughPlayer.jsx
// The one-row controller of the live walkthrough: where you are, what the step
// is, and the way back to the report. It reads a step and never writes one —
// notes, moments, order and hiding live in the situation-report modal and on
// the node's own private note. Its height is exported so the camera can fit
// the step into the band of canvas it leaves uncovered.
import React, { useEffect } from 'react';
import { Box, Button, Chip, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { walkthroughCopy, stepKindLabel } from '../utils/walkthrough/walkthroughCopy';
import { NODE_NOTE_FLAGS } from '../utils/nodeNotes';

// Height reserved at the bottom of the canvas while the controller is open.
// The camera's inset, not a measurement: the row is laid out to this height
// on a wide viewport and wraps to twice it on a compact one.
export const WALKTHROUGH_CONTROLLER_HEIGHT = 56;
export const WALKTHROUGH_CONTROLLER_HEIGHT_COMPACT = 104;
const CONTROLLER_MARGIN = 12;

export const walkthroughControllerInset = compact => (compact
  ? WALKTHROUGH_CONTROLLER_HEIGHT_COMPACT
  : WALKTHROUGH_CONTROLLER_HEIGHT + CONTROLLER_MARGIN);

// The moment is an ISO day in the model and a sentence to the reader. A bare
// 'YYYY-MM-DD' read as UTC midnight renders as the previous day west of
// Greenwich, so it is read at noon.
const fmtMoment = (iso, lang) => new Date(`${iso}T12:00:00`).toLocaleDateString(
  lang === 'en' ? 'en-GB' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

export default function WalkthroughPlayer({
  open, step, index, total, lang = 'es', compact = false, opening = null, bottomOffset = 0,
  onPrev, onNext, onExit, onEdit, onEvidence,
}) {
  const t = walkthroughCopy(lang);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      const el = e.target;
      if (el && typeof el.closest === 'function' && el.closest('input,textarea,[contenteditable="true"],[role="listbox"],[role="option"],[role="dialog"]')) return;
      if (e.key === 'ArrowRight') onNext?.();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'Escape') onExit?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onNext, onPrev, onExit]);

  if (!open || !step) return null;
  const flagColor = NODE_NOTE_FLAGS[step.narrative?.flag || step.authorNote?.flag] || null;
  const counter = `${index + 1} / ${total}`;

  return (
    <Paper
      elevation={6}
      role="toolbar"
      aria-label={opening?.title || t.opening(total)}
      sx={{
        position: 'absolute', zIndex: 20,
        left: compact ? 0 : CONTROLLER_MARGIN, right: compact ? 0 : CONTROLLER_MARGIN,
        bottom: bottomOffset + (compact ? 0 : CONTROLLER_MARGIN),
        minHeight: compact ? WALKTHROUGH_CONTROLLER_HEIGHT_COMPACT : WALKTHROUGH_CONTROLLER_HEIGHT,
        px: 1.5, py: 0.75, borderRadius: compact ? '12px 12px 0 0' : 2,
        borderLeft: flagColor ? `4px solid ${flagColor}` : undefined,
        display: 'flex', alignItems: 'center', gap: 1, flexWrap: compact ? 'wrap' : 'nowrap',
      }}
    >
      <Tooltip title={opening?.line || ''}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>
          {counter}
        </Typography>
      </Tooltip>
      <Chip size="small" variant="outlined" label={stepKindLabel(step, t)} sx={{ height: 20, fontSize: '0.7rem' }} />
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 700, flex: compact ? '1 1 100%' : 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', order: compact ? -1 : 0 }}
        title={step.title}
      >
        {step.title}
      </Typography>
      {step.moment && (
        <Chip size="small" label={fmtMoment(step.moment, lang)} sx={{ height: 20, fontSize: '0.7rem' }} />
      )}
      {onEvidence && (
        <Button size="small" onClick={() => onEvidence(step)} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
          {t.evidence} →
        </Button>
      )}
      <Box sx={{ flex: compact ? 1 : 0 }} />
      <Button size="small" variant="outlined" onClick={onPrev} disabled={index <= 0} sx={{ textTransform: 'none' }}>{t.prev}</Button>
      <Button size="small" variant="contained" onClick={onNext} disabled={index >= total - 1} sx={{ textTransform: 'none' }}>{t.next}</Button>
      {onEdit && (
        <Tooltip title={t.editInReport}>
          <IconButton size="small" onClick={onEdit} aria-label={t.editInReport}><EditOutlinedIcon fontSize="small" /></IconButton>
        </Tooltip>
      )}
      <Tooltip title={t.exit}>
        <IconButton size="small" onClick={onExit} aria-label={t.exit}><CloseIcon fontSize="small" /></IconButton>
      </Tooltip>
    </Paper>
  );
}
