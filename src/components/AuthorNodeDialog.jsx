import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, TextField, ToggleButton, ToggleButtonGroup, Button,
} from '@mui/material';
import {
  validateAuthorNodeDraft, AUTHOR_NAME_MAX, AUTHOR_NOTE_MAX, AUTHOR_SOURCE_MAX,
} from '../utils/authorLayer';

// The blank draft an "add" opens with. Editing (initial set) overrides these
// from the existing author node's raw fields — see buildDraft below.
const BLANK_DRAFT = {
  kind: 'person', name: '', country: '', identifier: '', citationText: '', citationUrl: '', note: '',
};

// `initial`, when present, is the raw author node this dialog is editing (the
// object makeAuthorNode produced): `.type` ('officer' | 'company'), `.name`,
// `.country`, `.identifier`, and `.provenance.{citation, note}`.
const buildDraft = initial => {
  if (!initial) return { ...BLANK_DRAFT };
  return {
    kind: initial.type === 'officer' ? 'person' : 'company',
    name: initial.name || '',
    country: initial.country || '',
    identifier: initial.identifier || '',
    citationText: initial.provenance?.citation?.text || '',
    citationUrl: initial.provenance?.citation?.url || '',
    note: initial.provenance?.note || '',
  };
};

/**
 * Add/edit dialog for one author-layer entity (person or company) on the
 * graph. The author name for provenance is resolved by the caller
 * (sitrepAuthor), never collected here.
 */
export default function AuthorNodeDialog({
  open, initial = null, text, onCancel, onSave, container = undefined,
}) {
  const [draft, setDraft] = useState(() => buildDraft(initial));

  // Re-seed the draft each time the dialog opens, so a leftover edit never
  // bleeds into the next add.
  useEffect(() => {
    if (open) setDraft(buildDraft(initial));
  }, [open, initial]);

  const validation = useMemo(() => validateAuthorNodeDraft(draft), [draft]);

  const setField = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!validation.ok) return;
    onSave(draft);
  };

  return (
    // container: in the embedded fullscreen graph the dialog must portal into
    // the fullscreen element, or it renders behind it — same rule as every
    // other overlay the graph opens.
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth container={container}>
      <DialogTitle>{initial ? text.editEntity : text.addEntity}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={draft.kind}
              onChange={(e, value) => { if (value) setField('kind', value); }}
            >
              <ToggleButton value="person">{text.kindPerson}</ToggleButton>
              <ToggleButton value="company">{text.kindCompany}</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <TextField
            autoFocus
            fullWidth
            size="small"
            required
            label={text.fieldName}
            value={draft.name}
            onChange={e => setField('name', e.target.value.slice(0, AUTHOR_NAME_MAX))}
            error={!!validation.errors.name}
            helperText={validation.errors.name ? text.nameRequired : ' '}
          />
          <TextField
            fullWidth
            size="small"
            label={text.fieldCountry}
            value={draft.country}
            onChange={e => setField('country', e.target.value.toUpperCase().slice(0, 2))}
          />
          <TextField
            fullWidth
            size="small"
            label={text.fieldIdentifier}
            value={draft.identifier}
            onChange={e => setField('identifier', e.target.value.slice(0, AUTHOR_SOURCE_MAX))}
          />
          <TextField
            fullWidth
            size="small"
            label={text.fieldSourceText}
            value={draft.citationText}
            onChange={e => setField('citationText', e.target.value.slice(0, AUTHOR_SOURCE_MAX))}
          />
          <TextField
            fullWidth
            size="small"
            label={text.fieldSourceUrl}
            value={draft.citationUrl}
            onChange={e => setField('citationUrl', e.target.value.slice(0, AUTHOR_SOURCE_MAX))}
            error={!!validation.errors.url}
            helperText={validation.errors.url ? text.urlInvalid : ' '}
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
