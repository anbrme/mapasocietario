import { Chip } from '@mui/material';
import { ddStatusView, DD_TAKING_LONG_MS } from './ddStatusView';

// Re-export the pure view-model so existing importers keep a single entry point.
export { ddStatusView, DD_TAKING_LONG_MS };

export function DdStatusChip({ view }) {
  return (
    <Chip
      label={view.label}
      size="small"
      color={view.color}
      variant="outlined"
      sx={{ fontSize: '0.65rem', height: 22, mt: 0.5 }}
    />
  );
}
