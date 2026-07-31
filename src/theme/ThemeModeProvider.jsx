import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { createAppTheme } from './createAppTheme';
import { isAppRoute, readStoredMode, resolveThemeMode, writeStoredMode } from './themeMode';

const ThemeModeContext = createContext(null);

const getStorage = () => {
  try {
    return window.localStorage;
  } catch {
    // Safari private mode throws on property access, not just on read.
    return null;
  }
};

export function useThemeMode() {
  const value = useContext(ThemeModeContext);
  if (!value) throw new Error('useThemeMode must be used inside ThemeModeProvider');
  return value;
}

// Thin wrapper over themeMode.js — all decision logic lives there, unit-tested.
// This component only holds state and applies the two document side effects.
export function ThemeModeProvider({ children }) {
  const { pathname } = useLocation();
  const [mode, setMode] = useState(() => readStoredMode(getStorage()));

  const effectiveMode = resolveThemeMode({ stored: mode, pathname });
  const canToggle = isAppRoute(pathname);

  const toggleMode = useCallback(() => {
    setMode(current => {
      const next = current === 'light' ? 'dark' : 'light';
      writeStoredMode(getStorage(), next);
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(effectiveMode), [effectiveMode]);

  // Keep the document in sync with what React renders: [data-theme] drives the
  // page background, overscroll and scrollbar (index.css), and theme-color
  // drives mobile browser chrome.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveMode);
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', theme.palette.background.default);
  }, [effectiveMode, theme]);

  const value = useMemo(
    () => ({ mode, effectiveMode, canToggle, toggleMode }),
    [mode, effectiveMode, canToggle, toggleMode]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
