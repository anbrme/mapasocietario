import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import { graphEmptyStateView } from './graphEmptyStateView';

/**
 * The invitation shown on a blank graph canvas, before the first search.
 *
 * Deliberately stateless — no "seen" flag, no dismissal. An empty state is
 * correct on the hundredth visit for the same reason it is correct on the
 * first: there is nothing on the canvas. That is what keeps it from becoming a
 * nag, and it is why this is not a tour.
 *
 * All logic is in graphEmptyStateView (unit-tested under the node-env config);
 * this component only maps the view model to MUI.
 *
 * @param {object} p
 * @param {object} p.copy - the graph's language dictionary
 * @param {(example: {v3Name: string, groupKey: string, slug: string}) => void} p.onPick
 */
export default function GraphEmptyState({ copy, onPick }) {
  const vm = graphEmptyStateView({ copy });

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        // force-graph renders its canvas into a later, position:relative sibling
        // with z-index auto, so at auto it paints ON TOP of this overlay and
        // swallows every chip click (the chips still LOOK right, because the
        // canvas is transparent). One layer up puts them back in reach.
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // The canvas keeps its own pointer behaviour (panning, background
        // clicks); only the chips below opt back in.
        pointerEvents: 'none',
        px: 3,
        textAlign: 'center',
      }}
    >
      <Box sx={{ maxWidth: 460 }}>
        <HubIcon
          sx={{ fontSize: 44, mb: 1.5, color: 'graph.node.company', opacity: 0.7 }}
        />
        {/* graph.surface.* rather than text.* : this renders on the canvas, and
            those are the tokens contrast-verified against it (palette.test.js). */}
        <Typography
          sx={{ fontSize: '1.05rem', fontWeight: 600, color: 'graph.surface.label', mb: 1 }}
        >
          {vm.title}
        </Typography>
        <Typography
          sx={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'graph.surface.labelSubtle', mb: 2.5 }}
        >
          {vm.body}
        </Typography>
        <Typography
          sx={{ fontSize: '0.75rem', color: 'graph.surface.labelSubtle', mb: 1.25 }}
        >
          {vm.examplesLabel}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ pointerEvents: 'auto' }}
        >
          {vm.examples.map(example => (
            <Chip
              key={example.slug}
              label={example.label}
              onClick={() => onPick(example)}
              variant="outlined"
              sx={{
                borderColor: 'graph.node.company',
                color: 'graph.surface.label',
                fontWeight: 600,
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
              }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
