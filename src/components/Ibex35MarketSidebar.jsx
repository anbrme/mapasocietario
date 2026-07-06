import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Divider } from '@mui/material';
import { getIbexCompanyData } from '../services/ibex35DashboardClient';
import { buildIbexCardViewModel } from '../utils/ibex35Match';
import Ibex35MarketCardBody, { IBEX_STRINGS } from './Ibex35MarketCardBody';

// Non-modal, right-anchored, fixed sidebar mirroring ApoderadosSidebar.jsx's
// positioning. Fully automatic: shown/hidden entirely by the `open`/`seedEntry`
// props (no close button, no manual dismiss) — the caller (the graph
// component) owns visibility, keyed to the focused node and precedence
// against ApoderadosSidebar. Web only — see Ibex35MarketDialog for the
// Android context-menu-triggered equivalent.
const Ibex35MarketSidebar = ({ open, seedEntry, lang = 'es' }) => {
  const t = IBEX_STRINGS[lang === 'en' ? 'en' : 'es'];
  const [loading, setLoading] = useState(false);
  const [viewModel, setViewModel] = useState(null);

  useEffect(() => {
    if (!open || !seedEntry) {
      setViewModel(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setViewModel(null);
    (async () => {
      // Any failure here (network error, malformed upstream data, an
      // unexpected throw while building the view model) must still resolve
      // `loading` — otherwise the sidebar hangs on the spinner forever
      // instead of falling back to the "unavailable" message below.
      try {
        const apiRow = await getIbexCompanyData(seedEntry.nif);
        if (cancelled) return;
        setViewModel(buildIbexCardViewModel(seedEntry, apiRow, lang));
      } catch (err) {
        if (!cancelled) {
          console.warn('[Ibex35MarketSidebar] failed to build market data view:', err.message);
          setViewModel(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, seedEntry, lang]);

  if (!open || !seedEntry) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        maxWidth: '100vw',
        zIndex: theme => theme.zIndex.drawer + 1,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid',
        borderColor: 'divider',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
      }}
    >
      <Box sx={{ p: 2, pb: 1.5 }}>
        <Typography variant="h6">{t.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {seedEntry.name}
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, py: 6 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              {t.loading}
            </Typography>
          </Box>
        ) : !viewModel ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t.unavailable}
            </Typography>
          </Box>
        ) : (
          <Ibex35MarketCardBody viewModel={viewModel} t={t} />
        )}
      </Box>
    </Paper>
  );
};

export default Ibex35MarketSidebar;
