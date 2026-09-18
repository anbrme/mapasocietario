import React, { useEffect, useRef } from 'react';
import {
  Box, Button, Dialog, IconButton, LinearProgress, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { trackEvent } from '../../utils/track';
import { replayCopyFor } from './replayCopy';
import useReplayHistory from './useReplayHistory';
import ReplayPlayer from './ReplayPlayer';

/**
 * Replay history: one company and its officers, or one officer and their
 * companies, replayed in registry time. Its own full-screen stage; the user's
 * graph is never touched.
 *
 * @param {{ open: boolean, subject: { kind: 'company'|'officer', name: string, groupKey?: string } | null,
 *   language: string, onClose: () => void, container?: Element }} props
 */
export default function ReplayDialog({ open, subject, language, onClose, container }) {
  const theme = useTheme();
  const copy = replayCopyFor(language);
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { status, progress, model, retry } = useReplayHistory(open, subject);
  const openedFor = useRef(null);

  useEffect(() => {
    if (status !== 'ready' || !model || openedFor.current === model) return;
    openedFor.current = model;
    trackEvent('replay_open', {
      subject_kind: model.subject.kind,
      acts_total: model.acts.length,
      truncated: model.completeness.truncatedBefore ? 1 : 0,
    });
  }, [status, model]);

  const subtitle = subject?.kind === 'officer' ? copy.subtitleOfficer : copy.subtitleCompany;

  return (
    <Dialog open={open} onClose={onClose} fullScreen container={container} aria-labelledby="replay-dialog-title">
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id="replay-dialog-title" variant="h6" noWrap sx={{ fontWeight: 700 }}>
              {copy.title} · {subject?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          </Box>
          <IconButton onClick={onClose} aria-label={copy.close}><CloseIcon /></IconButton>
        </Box>

        {status === 'loading' && (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {copy.loading(progress?.loaded || 0, progress?.total || 0)}
            </Typography>
            <LinearProgress
              variant={progress?.total ? 'determinate' : 'indeterminate'}
              value={progress?.total ? (100 * progress.loaded) / progress.total : 0}
            />
          </Box>
        )}
        {status === 'error' && (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>{copy.loadFailed}</Typography>
            <Button variant="outlined" onClick={retry}>{copy.retry}</Button>
          </Box>
        )}
        {status === 'ready' && model && model.acts.length === 0 && (
          <Box sx={{ p: 3 }}><Typography variant="body2">{copy.empty}</Typography></Box>
        )}
        {status === 'ready' && model && model.acts.length > 0 && (
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <ReplayPlayer
              key={`${model.subject.kind}|${model.subject.id}`}
              model={model}
              copy={copy}
              language={language}
              isNarrow={isNarrow}
              reducedMotion={reducedMotion}
            />
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
