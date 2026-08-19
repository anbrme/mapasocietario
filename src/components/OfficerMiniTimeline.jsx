import React from 'react';
import { Box, Typography, Tooltip, ButtonBase } from '@mui/material';

/**
 * The officer Gantt, compressed to fit the docked inspector panel.
 *
 * Not a smaller copy of the dialog's chart: at ~450px wide there is no room for
 * a 180px label column, so each seat becomes a stacked block — company and role
 * on one line, a full-width track beneath — which keeps long Spanish company
 * names readable instead of ellipsing them into "NURNBERG CONSULTING & PART…".
 *
 * It reads the same `chart` object the dialog does, so the preview and the
 * modal can never disagree about where a bar sits.
 */

const ROW_BLOCK_HEIGHT = 38;
const TRACK_HEIGHT = 10;

const OfficerMiniTimeline = ({ chart, copy, maxRows = 6, onExpand }) => {
  const rows = chart?.rows || [];
  const scale = chart?.scale;
  if (!rows.length || !scale) return null;

  const visible = rows.slice(0, maxRows);
  const hidden = rows.length - visible.length;
  const firstYear = scale.years[0]?.year;
  const lastYear = scale.years[scale.years.length - 1]?.year;

  return (
    <ButtonBase
      onClick={onExpand}
      focusRipple
      aria-label={copy.openTimeline}
      sx={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        borderRadius: 1,
        p: 1,
        border: '1px solid',
        borderColor: 'divider',
        transition: 'border-color 0.15s, background-color 0.15s',
        '&:hover': { borderColor: 'accent.primary', bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ position: 'relative', width: '100%' }}>
        {/* Today marker, drawn once behind every track so the seats line up
            against a single "now". */}
        {scale.todayPct >= 0 && scale.todayPct <= 100 && (
          <Box
            sx={{
              position: 'absolute',
              left: `${scale.todayPct}%`,
              top: 0,
              height: visible.length * ROW_BLOCK_HEIGHT,
              borderLeft: '1px dashed',
              borderColor: 'warning.main',
              opacity: 0.55,
              pointerEvents: 'none',
            }}
          />
        )}

        {visible.map((row, rowIdx) => (
          <Box key={`${row.company}-${row.role}-${rowIdx}`} sx={{ height: ROW_BLOCK_HEIGHT }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600, fontSize: '0.68rem', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: 'text.primary', minWidth: 0,
                }}
              >
                {row.company}
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontSize: '0.6rem', color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {row.role}
              </Typography>
            </Box>
            <Box sx={{ position: 'relative', height: TRACK_HEIGHT, mt: 0.25 }}>
              {/* Baseline: without it a short bar floats with no sense of the
                  period it sits inside. */}
              <Box sx={{
                position: 'absolute', left: 0, right: 0, top: TRACK_HEIGHT / 2 - 1,
                height: 2, bgcolor: 'divider', borderRadius: 1,
              }} />
              {row.spans.map((span, sIdx) => {
                if (span.unknownStart) {
                  const pos = scale.toPercent(span.endDate) ?? 0;
                  return (
                    <Tooltip key={sIdx} title={`${span.role}: ? → ${span.end} (${copy.cessation})`} arrow>
                      <Box sx={{
                        position: 'absolute', left: `${pos}%`, top: 0,
                        width: TRACK_HEIGHT, height: TRACK_HEIGHT, borderRadius: '50%',
                        bgcolor: row.color, opacity: 0.65, transform: `translateX(-${TRACK_HEIGHT / 2}px)`,
                      }} />
                    </Tooltip>
                  );
                }
                const startPct = scale.toPercent(span.startDate) ?? 0;
                const endPct = span.endDate ? scale.toPercent(span.endDate) : scale.todayPct;
                const width = Math.max(endPct - startPct, 0.8);
                return (
                  <Tooltip key={sIdx} title={`${span.role}: ${span.start || '?'} → ${span.end || copy.active}`} arrow>
                    <Box sx={{
                      position: 'absolute', left: `${startPct}%`, width: `${width}%`, top: 0,
                      height: TRACK_HEIGHT, bgcolor: row.color,
                      opacity: span.isActive ? 1 : 0.6, borderRadius: '2px', minWidth: 3,
                      ...(span.isActive && {
                        clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 50%, calc(100% - 4px) 100%, 0 100%)',
                      }),
                    }} />
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
          {firstYear} — {lastYear}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'accent.primary', fontWeight: 600 }}>
          {hidden > 0 ? copy.andMoreSeats(hidden) : copy.openTimeline}
        </Typography>
      </Box>
    </ButtonBase>
  );
};

export default OfficerMiniTimeline;
