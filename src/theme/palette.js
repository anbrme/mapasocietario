// Single source of colour truth. Plain objects rather than CSS custom
// properties: the force-graph canvas needs real values at draw time, and CSS
// variables would force a getComputedStyle read-back on every mode change.
//
// Every value under graph.node / link / ring / noteFlag and the badge and chip
// FILLS is contrast-verified against its own mode's graph.surface.canvas at the
// WCAG 1.4.11 3:1 non-text floor. palette.test.js enforces this, so adding a
// token here without checking its contrast fails the suite.
//
// Semantic hues keep their family across modes — green = appointment,
// red = cessation, amber = sole shareholder — so the legend and the reader's
// learned associations survive the switch. Light values are darkened, not re-hued.

export const DARK_TOKENS = Object.freeze({
  primary: { main: '#14b8a6', light: '#2dd4bf', dark: '#0d9488' },
  background: { default: '#0a0e1a', paper: '#121828' },
  graph: {
    surface: {
      // The graph viewport background. Distinct from background.default: this is
      // the container Box behind the canvas, which ForceGraph2D shows through.
      canvas: '#0d1220',
      // Nodes are hollow — fill matches the canvas, identity is the outline.
      nodeFill: '#0d1220',
      label: '#e0e0e0',
      labelSubtle: 'rgba(180, 180, 180, 0.85)',
      labelHalo: 'rgba(0, 0, 0, 0.7)',
      badgeHalo: 'rgba(4, 18, 31, 0.9)',
      arrowOutline: '#0d1220',
    },
    node: {
      company: '#33bdad',
      officerIndividual: '#cd87c0',
      officerCompany: '#8a86d4',
      expanded: '#56b387',
      selected: '#e26d9a',
      searchOrigin: '#5fd6c6',
    },
    link: {
      appointment: '#34d399',
      cessation: '#f87171',
      dissolved: '#f87171',
      ownership: '#fbbf24',
      ownershipPrevious: '#94a3b8',
      ownershipLost: '#c79a3a',
      unknown: '#64748b',
      pathHighlight: '#4dd0e1',
    },
    badge: {
      unified: '#14b8a6',
      unifiedText: '#04121f',
      cargo: '#f59e0b',
      cargoText: '#1a1206',
    },
    chip: { active: '#f59e0b', former: '#9ca3af', outline: '#ffffff' },
    ring: { investigation: '#7c4dff', merged: '#f59e0b' },
    marker: { noteOutline: '#f8fafc', noteGlyph: '#0f172a' },
    noteFlag: {
      none: '#94a3b8',
      amber: '#f59e0b',
      red: '#ef4444',
      blue: '#3b82f6',
      green: '#22c55e',
    },
  },
});

export const LIGHT_TOKENS = Object.freeze({
  primary: { main: '#0d9488', light: '#14b8a6', dark: '#0f766e' },
  background: { default: '#f8fafc', paper: '#ffffff' },
  graph: {
    surface: {
      canvas: '#f8fafc',
      // Slightly lighter than the canvas so a node reads as a white card on
      // off-white, preserving the hollow-node language.
      nodeFill: '#ffffff',
      label: '#1e293b',
      labelSubtle: 'rgba(51, 65, 85, 0.85)',
      labelHalo: 'rgba(255, 255, 255, 0.85)',
      badgeHalo: 'rgba(255, 255, 255, 0.9)',
      arrowOutline: '#ffffff',
    },
    node: {
      company: '#0f766e',
      officerIndividual: '#a21caf',
      officerCompany: '#4f46e5',
      // Not #047857: that is link.appointment, and the two must stay apart.
      expanded: '#15803d',
      selected: '#be123c',
      searchOrigin: '#0d9488',
    },
    link: {
      appointment: '#047857',
      cessation: '#dc2626',
      dissolved: '#dc2626',
      ownership: '#b45309',
      ownershipPrevious: '#475569',
      ownershipLost: '#92400e',
      unknown: '#475569',
      pathHighlight: '#0891b2',
    },
    badge: {
      unified: '#0f766e',
      // Badge fills darken in light mode, so their text inverts to white — the
      // contrast is carried by the fill either way.
      unifiedText: '#ffffff',
      cargo: '#b45309',
      cargoText: '#ffffff',
    },
    chip: { active: '#b45309', former: '#64748b', outline: '#ffffff' },
    ring: { investigation: '#6d28d9', merged: '#b45309' },
    marker: { noteOutline: '#1e293b', noteGlyph: '#ffffff' },
    noteFlag: {
      none: '#475569',
      amber: '#b45309',
      red: '#dc2626',
      blue: '#1d4ed8',
      green: '#15803d',
    },
  },
});

export const TOKENS_BY_MODE = Object.freeze({
  dark: DARK_TOKENS,
  light: LIGHT_TOKENS,
});
