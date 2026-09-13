// src/components/WalkthroughPlayer.jsx
// The docked card of the live walkthrough. Reads one step, writes one note.
// Reordering lives in the situation-report modal, not here.
import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Divider, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CloseIcon from '@mui/icons-material/Close';
import { walkthroughCopy } from '../utils/walkthrough/walkthroughCopy';
import { NODE_NOTE_FLAGS, NODE_NOTE_MAX_LENGTH } from '../utils/nodeNotes';

const evidenceLine = (step, t) => {
  const ev = step?.evidence;
  if (!ev) return '';
  if (step.kind === 'company') {
    const findingText = ev.findings?.[0]?.text;
    if (findingText) return findingText;
    const lastFiling = ev.status?.lastFiling;
    return lastFiling ? `${t.subheads.filings}: ${lastFiling.date} · ${lastFiling.type}` : '';
  }
  if (step.kind === 'person') {
    return (ev.seats || []).slice(0, 2).map(s => `${s.role} · ${s.company}`).join(' · ');
  }
  return '';
};

export default function WalkthroughPlayer({
  open, step, index, total, lang = 'es', compact = false, opening = null, showOpening = false,
  onPrev, onNext, onExit, onHide, onNote, onEvidence,
}) {
  const t = walkthroughCopy(lang);
  const [note, setNote] = useState('');
  const initialText = step?.narrative?.text || step?.authorNote?.text || '';
  useEffect(() => {
    setNote(initialText);
  }, [step?.key, initialText]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      const t = e.target;
      if (t && typeof t.closest === 'function' && t.closest('input,textarea,[contenteditable="true"],[role="listbox"],[role="option"],[role="dialog"]')) return;
      if (e.key === 'ArrowRight') onNext?.();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'Escape') onExit?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onNext, onPrev, onExit]);

  if (!open || !step) return null;
  const flagColor = NODE_NOTE_FLAGS[step.narrative?.flag || step.authorNote?.flag] || null;
  const canEvidence = !!onEvidence;
  const eyebrow = t.kinds?.[step.kind] || t.sections?.[step.section] || '';
  const body = step.summary || step.text;
  const evidence = evidenceLine(step, t);
  const noteLabel = step.narrative ? `${t.kinds.note} · ${t.noteField}` : t.noteField;

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute', left: compact ? 0 : 16, right: compact ? 0 : 16, bottom: compact ? 0 : 16,
        zIndex: 20, p: 2, borderRadius: compact ? '12px 12px 0 0' : 2,
        borderLeft: flagColor ? `4px solid ${flagColor}` : undefined, maxHeight: '45vh', overflow: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, lineHeight: 1.6 }}>
          {eyebrow}
        </Typography>
        <Chip size="small" variant="outlined" label={t.sources[step.source]} sx={{ height: 20, fontSize: '0.7rem' }} />
        {step.date && <Typography variant="caption" color="text.secondary">{step.date}</Typography>}
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t.hideStep}><IconButton size="small" onClick={() => onHide?.(step.key)}><VisibilityOffIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title={t.exit}><IconButton size="small" onClick={onExit}><CloseIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
      {showOpening && opening && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{opening.title}</Typography>
          <Typography variant="caption" color="text.secondary">{opening.line}</Typography>
          <Divider sx={{ mb: 1 }} />
        </>
      )}
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{step.title}</Typography>
      {body && (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb: evidence ? 0.5 : 1 }}>{body}</Typography>
      )}
      {evidence && (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', mb: 1 }}>{evidence}</Typography>
      )}
      {canEvidence && (
        <Button size="small" onClick={() => onEvidence(step)} sx={{ textTransform: 'none', px: 0, mb: 1 }}>{t.evidence} →</Button>
      )}
      <TextField
        fullWidth size="small" multiline minRows={1} maxRows={4}
        label={noteLabel} value={note}
        onChange={e => setNote(e.target.value.slice(0, NODE_NOTE_MAX_LENGTH))}
        onBlur={() => { if (note !== initialText) onNote?.(step.key, note); }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
        <Button size="small" variant="outlined" onClick={onPrev} disabled={index <= 0} sx={{ textTransform: 'none' }}>{t.prev}</Button>
        <Button size="small" variant="contained" onClick={onNext} disabled={index >= total - 1} sx={{ textTransform: 'none' }}>{t.next}</Button>
        <Typography variant="caption" color="text.secondary">{index + 1} / {total}</Typography>
      </Box>
    </Paper>
  );
}
