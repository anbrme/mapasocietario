import { describe, expect, it } from 'vitest';
import { createAppTheme } from './createAppTheme';
import { DARK_TOKENS, LIGHT_TOKENS } from './palette';

describe('createAppTheme', () => {
  it('builds a dark theme carrying the dark graph tokens', () => {
    const theme = createAppTheme('dark');
    expect(theme.palette.mode).toBe('dark');
    expect(theme.palette.background.default).toBe(DARK_TOKENS.background.default);
    expect(theme.palette.graph).toEqual(DARK_TOKENS.graph);
    expect(theme.palette.accent).toEqual(DARK_TOKENS.accent);
  });

  it('builds a light theme carrying the light graph tokens', () => {
    const theme = createAppTheme('light');
    expect(theme.palette.mode).toBe('light');
    expect(theme.palette.background.default).toBe(LIGHT_TOKENS.background.default);
    expect(theme.palette.graph).toEqual(LIGHT_TOKENS.graph);
    expect(theme.palette.accent).toEqual(LIGHT_TOKENS.accent);
  });

  it('falls back to dark for an unrecognised mode', () => {
    expect(createAppTheme('sepia').palette.mode).toBe('dark');
    expect(createAppTheme(undefined).palette.mode).toBe('dark');
  });

  it('keeps the IBM Plex Sans typography the app already ships', () => {
    expect(createAppTheme('light').typography.fontFamily).toContain('IBM Plex Sans');
  });

  it('produces independent theme objects per call so callers cannot mutate shared state', () => {
    expect(createAppTheme('dark')).not.toBe(createAppTheme('dark'));
  });
});
