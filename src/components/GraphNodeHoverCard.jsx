import React from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import { formatDate } from '../utils/formatDate';

const CARD_WIDTH = 268;
/** Clearance between the node and the card so the cursor never sits on it. */
const NODE_GAP = 18;
/** Keep the card off the container edges. */
const EDGE_MARGIN = 8;
/** Rough card height, used only to decide whether to flip above the node. */
const ESTIMATED_HEIGHT = 150;

/**
 * Instant node summary on hover.
 *
 * Everything here is already on the node — no fetch, no spinner, no loading
 * state. That is the point: a node used to tell you nothing at all until you
 * clicked it, and the answer to "what is this?" should not cost a request.
 *
 * Anything that needs the network lives one click away in the inspector.
 */
const GraphNodeHoverCard = ({ node, position, containerWidth, containerHeight, lang = 'es', text, degree }) => {
  if (!node || !position) return null;

  const isOfficer = node.type === 'officer';
  const summary = node.companySummary || {};
  const previousName = (node.previousNames || summary.previousNames || [])[0];
  const earliest = summary.dateRange?.earliest;
  const latest = summary.dateRange?.latest;
  const publications = summary.totalEntries;
  const variantCount = (node.nameVariants || []).length;

  // Flip to the other side of the node when the card would overflow, so it stays
  // inside the canvas instead of being clipped at an edge.
  const flipLeft = position.x + NODE_GAP + CARD_WIDTH + EDGE_MARGIN > containerWidth;
  const flipUp = position.y + ESTIMATED_HEIGHT + EDGE_MARGIN > containerHeight;

  const left = flipLeft
    ? Math.max(EDGE_MARGIN, position.x - NODE_GAP - CARD_WIDTH)
    : position.x + NODE_GAP;
  const top = flipUp
    ? Math.max(EDGE_MARGIN, position.y - ESTIMATED_HEIGHT)
    : position.y + NODE_GAP;

  const facts = [];
  if (Number.isFinite(degree)) facts.push([text.hoverConnections, String(degree)]);
  if (publications > 0) facts.push([text.publicationsFound, String(publications)]);
  if (!isOfficer && (earliest || latest)) {
    facts.push([
      text.bormeRange,
      `${earliest ? formatDate(earliest, lang) : '?'} — ${latest ? formatDate(latest, lang) : '?'}`,
    ]);
  }
  if (isOfficer && variantCount > 1) facts.push([text.nameVariants, String(variantCount)]);

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        left,
        top,
        width: CARD_WIDTH,
        zIndex: 35,
        p: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: t => alpha(t.palette.background.paper, 0.97),
        backdropFilter: 'blur(8px)',
        // The card follows the pointer's target; it must never intercept the
        // click or drag the user is actually aiming at the node underneath.
        pointerEvents: 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
        {isOfficer
          ? <PersonIcon sx={{ fontSize: 18, mt: '1px', color: 'warning.main' }} />
          : <BusinessIcon sx={{ fontSize: 18, mt: '1px', color: 'primary.main' }} />}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            lineHeight: 1.3,
            textDecoration: node.isDissolved ? 'line-through' : 'none',
            color: node.isDissolved ? 'error.main' : 'inherit',
          }}
        >
          {node.name}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
        <Chip
          label={isOfficer ? text.officer : text.company}
          size="small"
          color={isOfficer ? 'warning' : 'primary'}
          variant="outlined"
          sx={{ height: 18, fontSize: '0.62rem' }}
        />
        {node.isDissolved && (
          <Chip label={text.dissolved} size="small" color="error" sx={{ height: 18, fontSize: '0.62rem' }} />
        )}
        {node.isInConcurso && (
          <Chip label={text.concurso} size="small" color="warning" sx={{ height: 18, fontSize: '0.62rem' }} />
        )}
        {node.isUnipersonal && (
          <Chip label={text.unipersonal} size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} />
        )}
      </Box>

      {previousName && (
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 0.5, color: 'warning.main', fontStyle: 'italic' }}
          noWrap
        >
          {text.previous}: {previousName}
        </Typography>
      )}

      {facts.length > 0 && (
        <Box sx={{ mt: 0.75, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 1, rowGap: 0.25, alignItems: 'baseline' }}>
          {facts.map(([label, value]) => (
            <React.Fragment key={label}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }} className="registry-ref">
                {value}
              </Typography>
            </React.Fragment>
          ))}
        </Box>
      )}

      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mt: 0.75,
          pt: 0.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          color: 'text.disabled',
          fontSize: '0.62rem',
        }}
      >
        {text.hoverHint}
      </Typography>
    </Paper>
  );
};

export default GraphNodeHoverCard;
