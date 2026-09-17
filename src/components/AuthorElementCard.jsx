import React from 'react';
import { Box, Stack, Typography, Button, Link } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { formatDate } from '../utils/formatDate';

// One "field" row: a caption label over a body line. Skipped entirely when
// there is nothing to show, so an entity with no country/identifier/note
// does not leave a trail of empty rows.
const Field = ({ label, children }) => {
  if (children == null || children === '') return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{children}</Typography>
    </Box>
  );
};

/**
 * Inspector body for an author-layer entity (a person or company the author
 * added to the map). Pure renderer over the node's own fields — it never
 * fetches, because an author node never reached the registry in the first
 * place.
 */
// A graph can be loaded from an imported snapshot file — untrusted input —
// so a citation URL is never trusted as-is: only an http(s) URL is ever
// handed to an href. Anything else (a `javascript:` URL, most obviously)
// still renders, but as inert text.
const isSafeHttpUrl = url => /^https?:\/\//i.test(String(url || ''));

export default function AuthorElementCard({ node, text, onEdit }) {
  if (!node) return null;
  const provenance = node.provenance || {};
  const citation = provenance.citation || null;
  const kindLabel = node.type === 'officer' ? text.kindPerson : text.kindCompany;
  const safeUrl = isSafeHttpUrl(citation?.url) ? citation.url : null;

  return (
    <Stack spacing={1.5}>
      <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
        {text.authorCard}
      </Typography>
      <Field label={text.fieldKind}>{kindLabel}</Field>
      <Field label={text.fieldName}>{node.name}</Field>
      <Field label={text.fieldCountry}>{node.country}</Field>
      <Field label={text.fieldIdentifier}>{node.identifier}</Field>
      <Field label={text.fieldSourceText}>{citation?.text}</Field>
      {citation?.url && (
        <Field label={text.fieldSourceUrl}>
          {safeUrl ? (
            <Link href={safeUrl} target="_blank" rel="noopener noreferrer">
              {citation.url}
            </Link>
          ) : citation.url}
        </Field>
      )}
      <Field label={text.fieldNote}>{provenance.note}</Field>
      <Field label={text.fieldDate}>{formatDate(provenance.at)}</Field>
      {provenance.author && (
        <Typography variant="caption" color="text.secondary">
          {provenance.author}
        </Typography>
      )}
      <Box>
        <Button size="small" variant="outlined" startIcon={<EditIcon fontSize="small" />} onClick={onEdit}>
          {text.editEntity}
        </Button>
      </Box>
    </Stack>
  );
}
