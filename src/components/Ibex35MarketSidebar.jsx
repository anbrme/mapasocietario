import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Divider, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { getIbexCompanyData } from '../services/ibex35DashboardClient';
import { buildIbexCardViewModel } from '../utils/ibex35Match';

const STRINGS = {
  es: {
    title: 'Datos de mercado',
    marketCap: 'Capitalización',
    volume: 'Volumen',
    peRatio: 'PER',
    eps: 'BPA',
    high52: 'Máx. 52 sem.',
    low52: 'Mín. 52 sem.',
    dividendYield: 'Rentabilidad por dividendo',
    shareholders: 'Accionistas significativos',
    asOf: fecha => `a fecha de ${fecha}`,
    loading: 'Cargando datos de mercado…',
    unavailable: 'Datos de mercado no disponibles (temporalmente).',
  },
  en: {
    title: 'Market data',
    marketCap: 'Market cap',
    volume: 'Volume',
    peRatio: 'P/E ratio',
    eps: 'EPS',
    high52: '52w high',
    low52: '52w low',
    dividendYield: 'Dividend yield',
    shareholders: 'Significant shareholders',
    asOf: date => `as of ${date}`,
    loading: 'Loading market data…',
    unavailable: 'Market data unavailable (temporarily).',
  },
};

// Non-modal, right-anchored, fixed sidebar mirroring ApoderadosSidebar.jsx's
// positioning. Fully automatic: shown/hidden entirely by the `open`/`seedEntry`
// props (no close button, no manual dismiss) — the caller (the graph
// component) owns visibility, keyed to the focused node and precedence
// against ApoderadosSidebar.
const Ibex35MarketSidebar = ({ open, seedEntry, lang = 'es' }) => {
  const t = STRINGS[lang === 'en' ? 'en' : 'es'];
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

  const rows = viewModel
    ? [
        [t.marketCap, viewModel.marketCapLabel],
        [t.volume, viewModel.volumeLabel],
        [t.peRatio, viewModel.peRatioLabel],
        [t.eps, viewModel.epsLabel],
        [t.high52, viewModel.high52Label],
        [t.low52, viewModel.low52Label],
        [t.dividendYield, viewModel.dividendYieldLabel],
      ].filter(([, value]) => value != null)
    : [];

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
          <>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h5">{viewModel.priceLabel}</Typography>
              {viewModel.changeLabel && (
                <Chip
                  size="small"
                  icon={viewModel.changePositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
                  label={viewModel.changeLabel}
                  color={viewModel.changePositive ? 'success' : 'error'}
                  variant="outlined"
                />
              )}
            </Box>

            {rows.map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2">{value}</Typography>
              </Box>
            ))}

            {viewModel.shareholders.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t.shareholders}
                </Typography>
                {viewModel.shareholders.map(s => (
                  <Box key={s.name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Box>
                      <Typography variant="body2">{s.name}</Typography>
                      {s.asOfLabel && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {t.asOf(s.asOfLabel)}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {s.percentageLabel}
                    </Typography>
                  </Box>
                ))}
              </>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default Ibex35MarketSidebar;
