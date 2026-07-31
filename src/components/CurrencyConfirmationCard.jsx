import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import VerifiedIcon from '@mui/icons-material/Verified';
import { confirmationViewModel } from '../../functions/empresa/_confirmation.js';

// Decay-level → MUI semantic palette key. Mode-aware: flips automatically
// between light and dark so the status dot always clears the 3:1 contrast
// floor against the surface it renders on (fresh/aging ≈ success/warning by
// meaning — see confirmationStatus() in _confirmation.js). `stale` is
// deliberately NOT mapped to a severity colour: an old-but-not-wrong
// confirmation isn't an error, so it renders neutral, matching the SEO-page
// HTML renderer (functions/empresa/_lib.js .cc-stale rule) — user-decided,
// final review finding 4.
const LEVEL_TOKEN = {
  fresh: 'success',
  aging: 'warning',
};

// The dot (VerifiedIcon) renders on top of this card's own translucent tint,
// not directly on the outer Paper, so its real contrast is icon-vs-tint, not
// icon-vs-paper. MUI's warning.main only clears ~2.7:1 against that tint in
// light mode (still under the 3:1 floor); warning.dark clears 3.3:1 there.
// success.main already clears 3:1 against its own tint, so only the warning
// dot needs the darker shade.
const DOT_VARIANT = {
  success: 'main',
  warning: 'dark',
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
  const isStale = vm.level === 'stale';
  const token = isStale ? null : (LEVEL_TOKEN[vm.level] || LEVEL_TOKEN.fresh);

  return (
    <Box
      sx={(theme) => ({
        border: `1px solid ${isStale ? theme.palette.text.disabled : theme.palette[token].main}`,
        bgcolor: alpha(isStale ? theme.palette.text.disabled : theme.palette[token].main, 0.12),
        borderRadius: 2,
        p: 1.5,
        mb: 2,
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <VerifiedIcon
          sx={{
            fontSize: 18,
            // text.disabled's own default alpha (0.38 light / 0.5 dark) can
            // NEVER reach 3:1 against this card's tint at any tint strength —
            // verified by brute-force compositing: the ceiling in light mode
            // is ~2.68:1 even directly on white. text.secondary is the
            // least-emphasised MUI token that still clears the floor here
            // (5.26:1 light / 7.01:1 dark against the card's own tint).
            color: isStale ? 'text.secondary' : `${token}.${DOT_VARIANT[token]}`,
          }}
        />
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

      {vm.verifiedVia && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {vm.verifiedVia}
        </Typography>
      )}

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
