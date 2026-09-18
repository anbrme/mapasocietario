import React from 'react';
import {
  Box, Button, LinearProgress, Paper, Typography,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

/**
 * Progress + outcome of refreshing an imported snapshot against the live
 * registry. Covers the canvas while running: a graph-wide refresh makes many
 * API calls, and the user should see that it is working and how far along.
 */
const COPY = {
  es: {
    title: 'Actualizando con datos actuales',
    progress: (done, total) => `${done} / ${total} empresas`,
    note: 'Se consultan los datos actuales del registro para cada empresa de la instantánea. Los nodos, posiciones y tus ediciones se conservan.',
    cancel: 'Cancelar',
    doneTitle: 'Instantánea actualizada',
    cancelledTitle: 'Actualización cancelada',
    errorTitle: 'No se pudo actualizar',
    errorBody: 'Algo falló al aplicar los datos. La instantánea no ha cambiado.',
    refreshed: n => `${n} ${n === 1 ? 'empresa actualizada' : 'empresas actualizadas'}`,
    ceased: n => `${n} ${n === 1 ? 'cese' : 'ceses'} desde la instantánea`,
    dissolved: n => `${n} ${n === 1 ? 'empresa disuelta' : 'empresas disueltas'} desde la instantánea`,
    failed: n => `${n} ${n === 1 ? 'empresa' : 'empresas'} sin respuesta`,
    skipped: n => `${n} sin consultar`,
    retry: 'Reintentar las fallidas',
    close: 'Cerrar',
  },
  en: {
    title: 'Refreshing with current data',
    progress: (done, total) => `${done} / ${total} companies`,
    note: 'Current registry data is being fetched for every company in the snapshot. Nodes, positions and your edits are kept.',
    cancel: 'Cancel',
    doneTitle: 'Snapshot refreshed',
    cancelledTitle: 'Refresh cancelled',
    errorTitle: 'Refresh failed',
    errorBody: 'Something went wrong applying the data. The snapshot is unchanged.',
    refreshed: n => `${n} ${n === 1 ? 'company' : 'companies'} refreshed`,
    ceased: n => `${n} ${n === 1 ? 'cessation' : 'cessations'} since the snapshot`,
    dissolved: n => `${n} ${n === 1 ? 'company' : 'companies'} dissolved since the snapshot`,
    failed: n => `${n} ${n === 1 ? 'company' : 'companies'} did not respond`,
    skipped: n => `${n} not fetched`,
    retry: 'Retry the failed ones',
    close: 'Close',
  },
};

const summaryLines = (summary, t) => [
  t.refreshed(summary.refreshed),
  summary.newlyCeased > 0 && t.ceased(summary.newlyCeased),
  summary.newlyDissolved > 0 && t.dissolved(summary.newlyDissolved),
  summary.failed.length > 0 && t.failed(summary.failed.length),
  summary.skipped > 0 && t.skipped(summary.skipped),
].filter(Boolean);

function RunningCard({ state, t, onCancel }) {
  const percent = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <SyncIcon color="primary" sx={{ animation: 'spin 1.2s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{t.title}</Typography>
      </Box>
      <LinearProgress variant="determinate" value={percent} sx={{ height: 10, borderRadius: 5, mb: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.progress(state.done, state.total)}</Typography>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0 }}>{state.current}</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{t.note}</Typography>
      <Box sx={{ textAlign: 'right' }}>
        <Button onClick={onCancel} color="inherit">{t.cancel}</Button>
      </Box>
    </>
  );
}

function ResultCard({ state, t, onRetry, onDismiss }) {
  const { summary } = state;
  const isError = state.status === 'error';
  const title = isError ? t.errorTitle : summary.cancelled ? t.cancelledTitle : t.doneTitle;
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        {!isError && <CheckCircleOutlineIcon color="success" />}
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
      </Box>
      {isError ? (
        <Typography variant="body2" sx={{ mb: 2 }}>{t.errorBody}</Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, mb: 2, pl: 2.5 }}>
          {summaryLines(summary, t).map(line => (
            <Typography component="li" variant="body2" key={line}>{line}</Typography>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        {!isError && summary.failed.length > 0 && (
          <Button onClick={() => onRetry(new Set(summary.failed.map(f => f.id)))}>{t.retry}</Button>
        )}
        <Button variant="contained" onClick={onDismiss}>{t.close}</Button>
      </Box>
    </>
  );
}

export default function SnapshotRefreshOverlay({ state, lang = 'es', onCancel, onRetry, onDismiss }) {
  if (!state || state.status === 'idle') return null;
  const t = COPY[lang] || COPY.es;
  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        bgcolor: theme => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'),
        backdropFilter: 'blur(2px)',
      }}
    >
      <Paper elevation={8} sx={{ width: '100%', maxWidth: 460, p: 3 }}>
        {state.status === 'running'
          ? <RunningCard state={state} t={t} onCancel={onCancel} />
          : <ResultCard state={state} t={t} onRetry={onRetry} onDismiss={onDismiss} />}
      </Paper>
    </Box>
  );
}
