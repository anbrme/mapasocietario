import React from 'react';
import { Box, Typography, Chip, Divider } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

export const IBEX_STRINGS = {
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
    close: 'Cerrar',
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
    close: 'Close',
  },
};

// Pure presentational content shared by Ibex35MarketSidebar (web, wraps
// this in its fixed Paper) and Ibex35MarketDialog (Android, wraps this in
// a MUI Dialog) — price/change header, market-data stat rows, and the
// significant-shareholders list. No wrapper chrome, no loading/unavailable
// state — callers own those.
const Ibex35MarketCardBody = ({ viewModel, t }) => {
  const rows = [
    [t.marketCap, viewModel.marketCapLabel],
    [t.volume, viewModel.volumeLabel],
    [t.peRatio, viewModel.peRatioLabel],
    [t.eps, viewModel.epsLabel],
    [t.high52, viewModel.high52Label],
    [t.low52, viewModel.low52Label],
    [t.dividendYield, viewModel.dividendYieldLabel],
  ].filter(([, value]) => value != null);

  return (
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
  );
};

export default Ibex35MarketCardBody;
