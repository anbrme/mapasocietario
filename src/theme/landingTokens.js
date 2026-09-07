// Landing-page surfaces per mode. The landing was built dark-only with glass
// panels drawn as white-alpha washes over navy; those washes vanish on a light
// page, so light gets its own solid or slate-alpha set. Dark keeps the exact
// values that shipped — landingTokens.test.js pins them — because following
// the system theme must not change what dark-system visitors already see.
//
// Text colours the landing pulls from the MUI palette (text.primary,
// text.secondary, accent.*) already adapt; only the muted copy needs a token,
// because MUI's light `text.disabled` is far below the WCAG text floor.
import { DARK_TOKENS, LIGHT_TOKENS } from './palette';
import { normalizeMode } from './themeMode';

const deepFreeze = (obj) => {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return obj;
};

export const LANDING_TOKENS = deepFreeze({
  dark: {
    page: DARK_TOKENS.background.default,
    muted: 'rgba(255,255,255,0.5)',
    hairline: 'rgba(255,255,255,0.06)',
    panelBg: 'rgba(255,255,255,0.025)',
    panelBorder: 'rgba(255,255,255,0.09)',
    panelBgSoft: 'rgba(255,255,255,0.015)',
    panelBgStrong: 'rgba(255,255,255,0.04)',
    panelBorderStrong: 'rgba(255,255,255,0.1)',
    cardBg: 'rgba(255,255,255,0.02)',
    cardBorder: 'rgba(255,255,255,0.07)',
    chipBg: 'rgba(255,255,255,0.08)',
    chipBorder: 'rgba(255,255,255,0.15)',
    chipMutedBg: 'rgba(255,255,255,0.07)',
    chipMutedBorder: 'rgba(255,255,255,0.10)',
    codeBg: 'rgba(255,255,255,0.05)',
    codeBorder: 'rgba(255,255,255,0.12)',
    outlineBorder: 'rgba(255,255,255,0.28)',
    outlineHoverBg: 'rgba(255,255,255,0.06)',
    tealWash: 'rgba(20,184,166,0.04)',
    tealWashMid: 'rgba(20,184,166,0.07)',
    tealWashStrong: 'rgba(20,184,166,0.12)',
    tealWashSelected: 'rgba(20,184,166,0.14)',
    tealBorderSoft: 'rgba(20,184,166,0.18)',
    tealBorder: 'rgba(20,184,166,0.30)',
    tealBorderStrong: 'rgba(20,184,166,0.35)',
    tealGlow: 'rgba(20,184,166,0.10)',
    tealGlowWide: 'rgba(20,184,166,0.08)',
    amberWash: 'rgba(250,204,21,0.09)',
    amberBorder: 'rgba(250,204,21,0.4)',
    demoSurface: DARK_TOKENS.graph.surface.canvas,
    demoShadow: '0 20px 60px rgba(0,0,0,0.45)',
    fieldBg: 'rgba(255,255,255,0.12)',
    fieldBorder: 'rgba(255,255,255,0.72)',
    fieldBorderHover: 'rgba(255,255,255,0.92)',
    exampleChipBorder: 'rgba(20,184,166,0.45)',
    exampleChipHoverBg: 'rgba(20,184,166,0.10)',
    heroLabel: 'rgba(236,240,243,0.95)',
    heroLabelSubtle: 'rgba(214,222,228,0.78)',
    heroLabelRole: 'rgba(150,162,172,0.8)',
    heroEdge: 'rgba(45,212,191,0.20)',
    heroNodeStroke: 'rgba(45,212,191,0.55)',
    heroHubStroke: '#2dd4bf',
    heroPulse: '45,212,191',
  },
  light: {
    page: LIGHT_TOKENS.background.default,
    muted: '#475569',
    hairline: 'rgba(15,23,42,0.08)',
    panelBg: '#ffffff',
    panelBorder: 'rgba(15,23,42,0.12)',
    panelBgSoft: 'rgba(15,23,42,0.02)',
    panelBgStrong: '#ffffff',
    panelBorderStrong: 'rgba(15,23,42,0.14)',
    cardBg: '#ffffff',
    cardBorder: 'rgba(15,23,42,0.10)',
    chipBg: 'rgba(15,23,42,0.06)',
    chipBorder: 'rgba(15,23,42,0.14)',
    chipMutedBg: 'rgba(15,23,42,0.05)',
    chipMutedBorder: 'rgba(15,23,42,0.12)',
    codeBg: 'rgba(15,23,42,0.04)',
    codeBorder: 'rgba(15,23,42,0.14)',
    outlineBorder: 'rgba(15,23,42,0.28)',
    outlineHoverBg: 'rgba(15,23,42,0.05)',
    tealWash: 'rgba(13,148,136,0.05)',
    tealWashMid: 'rgba(13,148,136,0.08)',
    tealWashStrong: 'rgba(13,148,136,0.14)',
    tealWashSelected: 'rgba(13,148,136,0.16)',
    tealBorderSoft: 'rgba(13,148,136,0.22)',
    tealBorder: 'rgba(13,148,136,0.35)',
    tealBorderStrong: 'rgba(13,148,136,0.40)',
    tealGlow: 'rgba(13,148,136,0.10)',
    tealGlowWide: 'rgba(13,148,136,0.08)',
    amberWash: 'rgba(180,83,9,0.08)',
    amberBorder: 'rgba(180,83,9,0.40)',
    demoSurface: '#ffffff',
    demoShadow: '0 20px 60px rgba(15,23,42,0.12)',
    fieldBg: '#ffffff',
    fieldBorder: 'rgba(15,23,42,0.42)',
    fieldBorderHover: 'rgba(15,23,42,0.70)',
    exampleChipBorder: 'rgba(13,148,136,0.45)',
    exampleChipHoverBg: 'rgba(13,148,136,0.10)',
    heroLabel: '#0f172a',
    heroLabelSubtle: '#334155',
    heroLabelRole: '#475569',
    heroEdge: 'rgba(13,148,136,0.35)',
    heroNodeStroke: 'rgba(13,148,136,0.75)',
    heroHubStroke: '#0d9488',
    heroPulse: '13,148,136',
  },
});

export function landingTokens(mode) {
  return LANDING_TOKENS[normalizeMode(mode)];
}
