import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useThemeMode } from './ThemeModeProvider';

// Renders nothing off the app route: only /app can be light, so a toggle
// elsewhere would be a dead control.
export function ThemeModeToggle({ label }) {
  const { effectiveMode, canToggle, toggleMode } = useThemeMode();
  if (!canToggle) return null;

  const isLight = effectiveMode === 'light';
  const title = isLight ? label.toDark : label.toLight;

  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={toggleMode}
        aria-label={title}
        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.light' } }}
      >
        {isLight
          ? <DarkModeIcon sx={{ fontSize: 20 }} />
          : <LightModeIcon sx={{ fontSize: 20 }} />}
      </IconButton>
    </Tooltip>
  );
}
