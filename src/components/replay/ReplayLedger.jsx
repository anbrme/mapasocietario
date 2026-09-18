import React, { useEffect, useRef } from 'react';
import { Box, Typography, ButtonBase } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { isoDayShort } from '../../utils/isoDay';

// Rows rendered around the clock. A large company holds tens of thousands of
// acts; the ledger shows the neighbourhood of the playhead, which is what an
// analyst checks a frame against.
const WINDOW_BEFORE = 120;
const WINDOW_AFTER = 40;

/**
 * Every act in date order, the last one the clock passed highlighted.
 * Clicking a row moves the clock to it. The auditable, non-visual twin of
 * the stage.
 */
export default function ReplayLedger({ model, currentIndex, names, hiddenCategories, copy, language, onSeekAct }) {
  const theme = useTheme();
  const link = theme.palette.graph.link;
  const currentRef = useRef(null);
  const acts = model.acts;
  const from = Math.max(0, currentIndex - WINDOW_BEFORE);
  const to = Math.min(acts.length, Math.max(currentIndex, 0) + WINDOW_AFTER);
  const unknownStartKeys = new Set(
    model.terms.filter(t => t.from === null).map(t => `${t.counterpartId}|${t.role}|${t.to}`),
  );

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentIndex]);

  const kindLabel = act => (act.kind === 'appointment' ? copy.appointment : act.kind === 'cessation' ? copy.cessation : copy.closure);
  const kindColor = act => (act.kind === 'appointment' ? link.appointment : act.kind === 'cessation' ? link.cessation : link.unknown);

  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, overflowY: 'auto', flex: 1 }} aria-label={copy.ledger}>
      {from > 0 && <Typography component="li" variant="caption" color="text.secondary" sx={{ px: 1.5 }}>…</Typography>}
      {acts.slice(from, to).map((act, offset) => {
        const index = from + offset;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;
        const isHidden = hiddenCategories.has(act.category);
        const unknownStart = act.kind === 'cessation' && unknownStartKeys.has(`${act.counterpartId}|${act.role}|${act.date}`);
        return (
          <li key={`${act.date}|${act.counterpartId}|${act.role}|${act.kind}|${index}`} ref={isCurrent ? currentRef : null}>
            <ButtonBase
              onClick={() => onSeekAct(act)}
              sx={{
                display: 'block', width: '100%', textAlign: 'left', px: 1.5, py: 0.5,
                borderLeft: '3px solid', borderColor: isCurrent ? 'primary.main' : 'transparent',
                bgcolor: isCurrent ? 'action.selected' : 'transparent',
                opacity: isFuture || isHidden ? 0.5 : 1,
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                {isoDayShort(act.date, language)}
                {' · '}
                <Box component="span" sx={{ color: kindColor(act), fontWeight: 600 }}>{kindLabel(act)}</Box>
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.3 }}>
                {names.get(act.counterpartId) || act.counterpartId}
                <Box component="span" sx={{ color: 'text.secondary' }}>{` · ${act.role}`}</Box>
              </Typography>
              {unknownStart && (
                <Typography variant="caption" color="text.secondary">{copy.unknownStartRow}</Typography>
              )}
            </ButtonBase>
          </li>
        );
      })}
      {to < acts.length && <Typography component="li" variant="caption" color="text.secondary" sx={{ px: 1.5 }}>…</Typography>}
    </Box>
  );
}
