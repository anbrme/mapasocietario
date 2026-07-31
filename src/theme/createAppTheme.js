import { createTheme } from '@mui/material';
import { TOKENS_BY_MODE } from './palette';
import { normalizeMode } from './themeMode';

// Builds the MUI theme for a mode. The custom `palette.graph` branch is what the
// force-graph canvas reads at draw time — MUI passes unknown palette keys
// through untouched, so this is a supported way to carry app-specific tokens.
export function createAppTheme(mode) {
  const safeMode = normalizeMode(mode);
  const tokens = TOKENS_BY_MODE[safeMode];

  return createTheme({
    palette: {
      mode: safeMode,
      primary: { ...tokens.primary },
      background: { ...tokens.background },
      graph: tokens.graph,
    },
    typography: {
      fontFamily: '"IBM Plex Sans", "Roboto", "Helvetica", "Arial", sans-serif',
    },
  });
}
