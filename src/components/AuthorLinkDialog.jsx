import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, TextField, Chip, ToggleButton, ToggleButtonGroup,
  Typography, Button,
} from '@mui/material';
import { validateAuthorLinkDraft, AUTHOR_LABEL_MAX, AUTHOR_NOTE_MAX } from '../utils/authorLayer';

// The blank draft an "add" opens with. Editing (initial set) overrides these
// from the existing author link's raw fields — see buildDraft below.
const BLANK_DRAFT = {
  label: '', directed: 'none', citationText: '', citationUrl: '', asserted: '', note: '',
};

// `initial`, when present, is the raw author link this dialog is editing
// (the object makeAuthorLink produced): `.relationship`, `.directed`
// (boolean — the arrow always points sourceNode -> targetNode as stored, so
// there is no "backward" to reconstruct), and `.provenance.{citation,
// asserted, note}`.
const buildDraft = initial => {
  if (!initial) return { ...BLANK_DRAFT };
  return {
    label: initial.relationship || '',
    directed: initial.directed ? 'forward' : 'none',
    citationText: initial.provenance?.citation?.text || '',
    citationUrl: initial.provenance?.citation?.url || '',
    asserted: initial.provenance?.asserted || '',
    note: initial.provenance?.note || '',
  };
};

/**
 * Add/edit dialog for one author-layer link between two graph nodes.
 * The author name for provenance is resolved by the caller (sitrepAuthor),
 * never collected here.
 */
export default function AuthorLinkDialog({
  open, sourceNode, targetNode, initial = null, text, onCancel, onSave,
}) {
  const [draft, setDraft] = useState(() => buildDraft(initial));

  // Re-seed the draft each time the dialog opens, so a leftover edit never
  // bleeds into the next add.
  useEffect(() => {
    if (open) setDraft(buildDraft(initial));
  }, [open, initial]);

  const validation = useMemo(() => validateAuthorLinkDraft(draft), [draft]);

  const sourceName = sourceNode?.name || '';
  const targetName = targetNode?.name || '';

  const setField = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!validation.ok) return;
    onSave(draft);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{text.linkToNode}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box>
            <TextField
              autoFocus
              fullWidth
              size="small"
              required
              label={text.fieldLabel}
              value={draft.label}
              onChange={e => setField('label', e.target.value.slice(0, AUTHOR_LABEL_MAX))}
              error={!!validation.errors.label}
              helperText={validation.errors.label ? text.labelRequired : ' '}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {(text.labelChips || []).map(chip => (
                <Chip
                  key={chip}
                  label={chip}
                  size="small"
                  variant={draft.label === chip ? 'filled' : 'outlined'}
                  color={draft.label === chip ? 'primary' : 'default'}
                  onClick={() => setField('label', chip)}
                />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {text.fieldDirection}
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={draft.directed}
              onChange={(e, value) => { if (value) setField('directed', value); }}
            >
              <ToggleButton value="none">{text.directionNone}</ToggleButton>
              <ToggleButton value="forward" sx={{ textTransform: 'none' }}>
                {`${sourceName} → ${targetName}`}
              </ToggleButton>
              <ToggleButton value="backward" sx={{ textTransform: 'none' }}>
                {`${targetName} → ${sourceName}`}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <TextField
            fullWidth
            size="small"
            label={text.fieldSourceText}
            value={draft.citationText}
            onChange={e => setField('citationText', e.target.value)}
          />
          <TextField
            fullWidth
            size="small"
            label={text.fieldSourceUrl}
            value={draft.citationUrl}
            onChange={e => setField('citationUrl', e.target.value)}
            error={!!validation.errors.url}
            helperText={validation.errors.url ? text.urlInvalid : ' '}
          />
          <TextField
            fullWidth
            size="small"
            type="date"
            label={text.fieldDate}
            value={draft.asserted}
            onChange={e => setField('asserted', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            label={text.fieldNote}
            value={draft.note}
            onChange={e => setField('note', e.target.value.slice(0, AUTHOR_NOTE_MAX))}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{text.cancel}</Button>
        <Button variant="contained" disabled={!validation.ok} onClick={handleSave}>
          {text.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
