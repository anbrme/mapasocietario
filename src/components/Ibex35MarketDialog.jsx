import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { buildIbexCardViewModel } from '../utils/ibex35Match';
import Ibex35MarketCardBody, { IBEX_STRINGS } from './Ibex35MarketCardBody';

// Android entry point for IBEX 35 market data: opened from the node
// context menu only once a background prefetch (in
// SpanishCompanyNetworkGraph.jsx) has already confirmed data exists for
// this company. Unlike Ibex35MarketSidebar, this never fetches and never
// shows a loading or unavailable state — it only ever opens with
// already-resolved data.
const Ibex35MarketDialog = ({ open, onClose, seedEntry, apiRow, lang = 'es' }) => {
  const t = IBEX_STRINGS[lang === 'en' ? 'en' : 'es'];
  if (!seedEntry || !apiRow) return null;
  const viewModel = buildIbexCardViewModel(seedEntry, apiRow, lang);
  if (!viewModel) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" component="div">
            {t.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {seedEntry.name}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label={t.close}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Ibex35MarketCardBody viewModel={viewModel} t={t} />
      </DialogContent>
    </Dialog>
  );
};

export default Ibex35MarketDialog;
