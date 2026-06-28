import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import { confirmationViewModel } from '../../functions/empresa/_confirmation.js';

// Decay-level → dark-theme accent (tuned for the #0a0e1a app background).
const LEVEL_STYLE = {
  fresh: { border: '#2e7d32', bg: 'rgba(46,125,50,0.12)', dot: '#4caf50' },
  aging: { border: '#b88300', bg: 'rgba(184,131,0,0.14)', dot: '#ffb300' },
  stale: { border: '#5b6472', bg: 'rgba(91,100,114,0.14)', dot: '#90a4ae' },
};

/**
 * In-app currency-confirmation card. Mirrors the SEO-page panel but themed for
 * the dark canvas. All logic is in confirmationViewModel (shared with the HTML
 * renderer); this component only maps the view model to MUI. Renders nothing
 * when there is no valid confirmation for the company.
 */
export default function CurrencyConfirmationCard({ rec, lang = 'es' }) {
  const vm = confirmationViewModel(rec, lang);
  if (!vm) return null;
  const s = LEVEL_STYLE[vm.level] || LEVEL_STYLE.fresh;

  return (
    <Box
      sx={{
        border: `1px solid ${s.border}`,
        bgcolor: s.bg,
        borderRadius: 2,
        p: 1.5,
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <VerifiedIcon sx={{ fontSize: 18, color: s.dot }} />
        <Typography
          variant="caption"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}
        >
          {vm.title}
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {vm.statusLine}
      </Typography>

      {vm.asOf && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 0.5 }}>
            {vm.asOf}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {vm.facts.map((f, i) => (
              <Chip
                key={i}
                size="small"
                label={`${f.label} · ${f.chipLabel}`}
                color={f.status === 'none' ? 'default' : 'success'}
                variant={f.status === 'none' ? 'outlined' : 'filled'}
              />
            ))}
          </Box>
        </>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {vm.disclaimer}
      </Typography>
    </Box>
  );
}
