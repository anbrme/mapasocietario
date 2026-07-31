# Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in light mode to the `/app` company-graph screen, leaving every other route dark.

**Architecture:** A new `src/theme/` module holds all colour tokens as plain JS objects and exposes `createAppTheme(mode)`, which builds a normal MUI theme plus a custom `palette.graph` branch the force-graph canvas reads at draw time. A `ThemeModeProvider` at the root resolves the *effective* mode as `isAppRoute(pathname) ? storedMode : 'dark'`, so only `/app` can ever be light. All decision logic lives in a pure `themeMode.js` so it is unit-testable without a DOM.

**Tech Stack:** React 19, MUI 5 (`@mui/material`), Vite 5, Vitest (node environment, pure-logic tests only), `react-force-graph-2d`.

**Spec:** `docs/superpowers/specs/2026-07-31-light-mode-design.md`

## Global Constraints

- **Tests are pure-logic only.** `vitest.config.js` sets `environment: 'node'` and `include: ['src/**/*.test.js']`, with a comment stating no jsdom and no component tests. Do **not** add jsdom, `@testing-library/react`, or any `.test.jsx` file — a `.test.jsx` would not even be collected. React components are verified by running the app.
- **No new dependencies.** Everything here uses packages already in `package.json`.
- **Storage is always injected**, never referenced as a global inside `src/theme/themeMode.js`, so tests can pass a fake. Every access is wrapped in `try/catch` — Safari private mode throws on `localStorage`.
- **Default mode is `'dark'`.** Any unrecognised, corrupt, or missing stored value resolves to `'dark'`.
- **Only `/app` may be light.** Every other route renders dark regardless of stored mode.
- **Contrast floor: 3:1** (WCAG 1.4.11 non-text) for every node, link, badge fill, chip fill, ring and note-flag colour, measured against its own mode's `graph.surface.canvas`.
- **Commit style:** conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- **Git signing:** commit with `git -c commit.gpgsign=false commit ...` — 1Password signing fails non-interactively in this environment.
- **Baseline:** `npm test` currently passes 135 tests across 17 files. It must still pass after every task.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/theme/contrast.js` | `parseColor()`, `relativeLuminance()`, `contrastRatio()` — pure colour maths |
| `src/theme/contrast.test.js` | Verifies the maths against known ratios |
| `src/theme/themeMode.js` | `APP_ROUTE`, `STORAGE_KEY`, `THEME_MODES`, `DEFAULT_MODE`, `isAppRoute()`, `normalizeMode()`, `resolveThemeMode()`, `readStoredMode()`, `writeStoredMode()` |
| `src/theme/themeMode.test.js` | Mode resolution, persistence, route scoping |
| `src/theme/palette.js` | `DARK_TOKENS`, `LIGHT_TOKENS`, `TOKENS_BY_MODE` |
| `src/theme/palette.test.js` | Key parity, valid colour syntax, 3:1 contrast floor |
| `src/theme/createAppTheme.js` | `createAppTheme(mode)` → MUI theme with `palette.graph` |
| `src/theme/createAppTheme.test.js` | Palette mode, graph branch, background wiring |
| `src/theme/indexHtml.test.js` | Pins the `index.html` inline script to the current constants |
| `src/theme/ThemeModeProvider.jsx` | Context, `useThemeMode()`, `data-theme` + `theme-color` side effects |
| `src/theme/ThemeModeToggle.jsx` | Sun/moon `IconButton` |

**Modify:**

| File | Change |
|---|---|
| `index.html:15` | Inline pre-paint script; `theme-color` meta gets an `id` |
| `src/index.css:8-13, 36-47` | Document background and scrollbar move to CSS variables |
| `src/main.jsx:3, 18, 169-196` | Replace inline `darkTheme` with provider + `createAppTheme` |
| `src/App.jsx:219` | Add the toggle to the breadcrumb bar |
| `src/utils/nodeNotes.js:5-11` | Export `NODE_NOTE_FLAG_KEYS`; keep `NODE_NOTE_FLAGS` as the dark fallback |
| `src/components/SpanishCompanyNetworkGraph.jsx` | Canvas + JSX chrome read from `palette.graph` |
| `src/components/DDCheckoutDialog.jsx`, `AIInvestigationGate.jsx`, `CurrencyConfirmationCard.jsx` | Dialog literals become theme tokens |

---

## Task 1: Contrast maths

The palette test asserts a 3:1 floor, so the function doing the measuring must itself be verified first — otherwise Task 3's contrast test proves nothing.

**Files:**
- Create: `src/theme/contrast.js`
- Test: `src/theme/contrast.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `parseColor(value: string) => {r, g, b} | null` — accepts `#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)`; returns `null` for anything else
  - `relativeLuminance(value: string) => number`
  - `contrastRatio(a: string, b: string) => number` — rounded to 2 decimals

- [ ] **Step 1: Write the failing test**

Create `src/theme/contrast.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor, relativeLuminance } from './contrast';

describe('parseColor', () => {
  it('parses six-digit hex', () => {
    expect(parseColor('#0d1220')).toEqual({ r: 13, g: 18, b: 32 });
  });

  it('parses three-digit hex by doubling each nibble', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses rgba() and ignores the alpha channel', () => {
    expect(parseColor('rgba(180, 180, 180, 0.85)')).toEqual({ r: 180, g: 180, b: 180 });
  });

  it('returns null for an unparseable value', () => {
    expect(parseColor('teal')).toBeNull();
    expect(parseColor('')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('returns the maximum 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  });

  it('returns 1 for a colour against itself', () => {
    expect(contrastRatio('#33bdad', '#33bdad')).toBe(1);
  });

  it('is symmetric regardless of argument order', () => {
    expect(contrastRatio('#33bdad', '#0d1220')).toBe(contrastRatio('#0d1220', '#33bdad'));
  });

  it('matches the known ratio for the company teal on the dark canvas', () => {
    expect(contrastRatio('#33bdad', '#0d1220')).toBe(8.02);
  });

  it('throws on an unparseable colour rather than returning a wrong number', () => {
    expect(() => contrastRatio('nope', '#ffffff')).toThrow(/unparseable colour/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/contrast.test.js`
Expected: FAIL — `Failed to resolve import "./contrast"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/theme/contrast.js`:

```javascript
// WCAG 2.x relative luminance and contrast ratio, used by palette.test.js to
// enforce the 3:1 non-text contrast floor (WCAG 1.4.11) on every graph colour.
// Alpha is ignored: canvas colours are drawn over an opaque canvas, so the
// solid colour is the case worth measuring.

const HEX_LONG = /^#([0-9a-f]{6})$/i;
const HEX_SHORT = /^#([0-9a-f]{3})$/i;
const RGB_FUNC = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i;

export function parseColor(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();

  const long = HEX_LONG.exec(input);
  if (long) {
    const n = parseInt(long[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const short = HEX_SHORT.exec(input);
  if (short) {
    const [a, b, c] = short[1].split('');
    return {
      r: parseInt(a + a, 16),
      g: parseInt(b + b, 16),
      b: parseInt(c + c, 16),
    };
  }

  const rgb = RGB_FUNC.exec(input);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  return null;
}

const channelLuminance = channel => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(value) {
  const rgb = parseColor(value);
  if (!rgb) throw new Error(`Unparseable colour: ${value}`);
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

export function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/contrast.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/theme/contrast.js src/theme/contrast.test.js
git -c commit.gpgsign=false commit -m "feat: add WCAG contrast maths for palette verification"
```

---

## Task 2: Pure theme-mode logic

**Files:**
- Create: `src/theme/themeMode.js`
- Test: `src/theme/themeMode.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `APP_ROUTE = '/app'`
  - `STORAGE_KEY = 'ms_theme_mode'`
  - `THEME_MODES = ['light', 'dark']`
  - `DEFAULT_MODE = 'dark'`
  - `isAppRoute(pathname: string) => boolean`
  - `normalizeMode(value: unknown) => 'light' | 'dark'`
  - `resolveThemeMode({ stored, pathname }) => 'light' | 'dark'`
  - `readStoredMode(storage) => 'light' | 'dark'`
  - `writeStoredMode(storage, mode) => void`

- [ ] **Step 1: Write the failing test**

Create `src/theme/themeMode.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import {
  APP_ROUTE,
  DEFAULT_MODE,
  STORAGE_KEY,
  isAppRoute,
  normalizeMode,
  readStoredMode,
  resolveThemeMode,
  writeStoredMode,
} from './themeMode';

// Minimal stand-in for window.localStorage. The real thing is unavailable in
// vitest's node environment, which is exactly why themeMode takes storage as a
// parameter instead of reaching for a global.
const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    snapshot: () => ({ ...data }),
  };
};

const throwingStorage = () => ({
  getItem: () => { throw new Error('SecurityError: storage disabled'); },
  setItem: () => { throw new Error('SecurityError: storage disabled'); },
});

describe('isAppRoute', () => {
  it('matches the app route exactly', () => {
    expect(isAppRoute(APP_ROUTE)).toBe(true);
  });

  it('matches the app route with a trailing slash', () => {
    expect(isAppRoute('/app/')).toBe(true);
  });

  it('rejects the landing page and marketing routes', () => {
    expect(isAppRoute('/')).toBe(false);
    expect(isAppRoute('/pricing')).toBe(false);
    expect(isAppRoute('/due-diligence')).toBe(false);
  });

  it('rejects a route that merely starts with the same characters', () => {
    expect(isAppRoute('/application-form')).toBe(false);
  });

  it('treats a missing pathname as not the app route', () => {
    expect(isAppRoute(undefined)).toBe(false);
    expect(isAppRoute(null)).toBe(false);
  });
});

describe('normalizeMode', () => {
  it('passes through the two valid modes', () => {
    expect(normalizeMode('light')).toBe('light');
    expect(normalizeMode('dark')).toBe('dark');
  });

  it('falls back to dark for unrecognised, corrupt or missing values', () => {
    expect(normalizeMode('LIGHT')).toBe(DEFAULT_MODE);
    expect(normalizeMode('sepia')).toBe(DEFAULT_MODE);
    expect(normalizeMode('')).toBe(DEFAULT_MODE);
    expect(normalizeMode(null)).toBe(DEFAULT_MODE);
    expect(normalizeMode(undefined)).toBe(DEFAULT_MODE);
    expect(normalizeMode({ mode: 'light' })).toBe(DEFAULT_MODE);
  });
});

describe('resolveThemeMode', () => {
  it('honours a stored light mode on the app route', () => {
    expect(resolveThemeMode({ stored: 'light', pathname: '/app' })).toBe('light');
  });

  it('forces dark off the app route even when light is stored', () => {
    expect(resolveThemeMode({ stored: 'light', pathname: '/' })).toBe('dark');
    expect(resolveThemeMode({ stored: 'light', pathname: '/pricing' })).toBe('dark');
    expect(resolveThemeMode({ stored: 'light', pathname: '/admin' })).toBe('dark');
  });

  it('defaults to dark on the app route when nothing is stored', () => {
    expect(resolveThemeMode({ stored: null, pathname: '/app' })).toBe('dark');
  });

  it('defaults to dark when a corrupt value is stored', () => {
    expect(resolveThemeMode({ stored: 'sepia', pathname: '/app' })).toBe('dark');
  });
});

describe('readStoredMode', () => {
  it('reads a previously persisted mode', () => {
    expect(readStoredMode(fakeStorage({ [STORAGE_KEY]: 'light' }))).toBe('light');
  });

  it('returns dark when the key is absent', () => {
    expect(readStoredMode(fakeStorage())).toBe(DEFAULT_MODE);
  });

  it('returns dark when storage throws', () => {
    expect(readStoredMode(throwingStorage())).toBe(DEFAULT_MODE);
  });

  it('returns dark when storage is missing entirely', () => {
    expect(readStoredMode(null)).toBe(DEFAULT_MODE);
    expect(readStoredMode(undefined)).toBe(DEFAULT_MODE);
  });
});

describe('writeStoredMode', () => {
  it('persists a valid mode under the storage key', () => {
    const storage = fakeStorage();
    writeStoredMode(storage, 'light');
    expect(storage.snapshot()).toEqual({ [STORAGE_KEY]: 'light' });
  });

  it('normalizes before writing so no invalid value can be persisted', () => {
    const storage = fakeStorage();
    writeStoredMode(storage, 'sepia');
    expect(storage.snapshot()).toEqual({ [STORAGE_KEY]: DEFAULT_MODE });
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => writeStoredMode(throwingStorage(), 'light')).not.toThrow();
    expect(() => writeStoredMode(null, 'light')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/themeMode.test.js`
Expected: FAIL — `Failed to resolve import "./themeMode"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/theme/themeMode.js`:

```javascript
// Pure theme-mode logic. Deliberately free of React and of any global browser
// reference so it can be unit-tested under vitest's node environment, which is
// the only kind of test this repo runs (see vitest.config.js).

export const APP_ROUTE = '/app';
export const STORAGE_KEY = 'ms_theme_mode';
export const THEME_MODES = Object.freeze(['light', 'dark']);
export const DEFAULT_MODE = 'dark';

// Only /app may be light. Marketing pages pin their own dark background, and
// DueDiligencePage / OrderStatusPage / AdminPage layer translucent white panels
// over the global dark — they become unreadable on a light background.
export function isAppRoute(pathname) {
  if (typeof pathname !== 'string') return false;
  return pathname === APP_ROUTE || pathname === `${APP_ROUTE}/`;
}

export function normalizeMode(value) {
  return THEME_MODES.includes(value) ? value : DEFAULT_MODE;
}

export function resolveThemeMode({ stored, pathname }) {
  if (!isAppRoute(pathname)) return DEFAULT_MODE;
  return normalizeMode(stored);
}

export function readStoredMode(storage) {
  try {
    return normalizeMode(storage?.getItem(STORAGE_KEY));
  } catch {
    // Safari private mode throws on storage access. Dark is the safe default.
    return DEFAULT_MODE;
  }
}

export function writeStoredMode(storage, mode) {
  try {
    storage?.setItem(STORAGE_KEY, normalizeMode(mode));
  } catch {
    // Persistence is a nicety; failing to store must never break the toggle.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/themeMode.test.js`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add src/theme/themeMode.js src/theme/themeMode.test.js
git -c commit.gpgsign=false commit -m "feat: add pure theme-mode resolution with route scoping"
```

---

## Task 3: Colour tokens

**Files:**
- Create: `src/theme/palette.js`
- Test: `src/theme/palette.test.js`

**Interfaces:**
- Consumes: `contrastRatio`, `parseColor` from `src/theme/contrast.js` (test only)
- Produces: `DARK_TOKENS`, `LIGHT_TOKENS`, `TOKENS_BY_MODE` — each token object has the shape `{ primary, background: { default, paper }, graph: { surface, node, link, badge, chip, ring, marker, noteFlag } }`

- [ ] **Step 1: Write the failing test**

Create `src/theme/palette.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor } from './contrast';
import { DARK_TOKENS, LIGHT_TOKENS, TOKENS_BY_MODE } from './palette';

// Walks a nested token object into flat dotted paths, e.g. "graph.node.company".
const flatten = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return entry && typeof entry === 'object' ? flatten(entry, path) : [[path, entry]];
  });

const pathsOf = tokens => flatten(tokens).map(([path]) => path).sort();

// Groups whose values are drawn directly on the canvas and must therefore clear
// the 3:1 non-text contrast floor. Excluded: surface (the canvas itself, plus
// halos and label colours), badge *Text, chip.outline and marker.* — all of
// which render on top of a coloured shape, not on the canvas.
const CONTRAST_GROUPS = ['node', 'link', 'ring', 'noteFlag'];
const CONTRAST_KEYS_IN_MIXED_GROUPS = {
  badge: ['unified', 'cargo'],
  chip: ['active', 'former'],
};

const MIN_CONTRAST = 3;

describe('palette parity', () => {
  it('exposes exactly the two modes', () => {
    expect(Object.keys(TOKENS_BY_MODE).sort()).toEqual(['dark', 'light']);
    expect(TOKENS_BY_MODE.dark).toBe(DARK_TOKENS);
    expect(TOKENS_BY_MODE.light).toBe(LIGHT_TOKENS);
  });

  it('defines the same token paths in both modes', () => {
    expect(pathsOf(LIGHT_TOKENS)).toEqual(pathsOf(DARK_TOKENS));
  });

  it('defines every token the graph canvas reads', () => {
    const paths = pathsOf(DARK_TOKENS);
    for (const required of [
      'graph.surface.canvas',
      'graph.surface.nodeFill',
      'graph.surface.label',
      'graph.surface.labelSubtle',
      'graph.surface.labelHalo',
      'graph.surface.badgeHalo',
      'graph.surface.arrowOutline',
      'graph.node.company',
      'graph.node.officerIndividual',
      'graph.node.officerCompany',
      'graph.node.expanded',
      'graph.node.selected',
      'graph.node.searchOrigin',
      'graph.link.appointment',
      'graph.link.cessation',
      'graph.link.ownership',
      'graph.link.ownershipPrevious',
      'graph.link.ownershipLost',
      'graph.link.unknown',
      'graph.link.dissolved',
      'graph.link.pathHighlight',
      'graph.badge.unified',
      'graph.badge.unifiedText',
      'graph.badge.cargo',
      'graph.badge.cargoText',
      'graph.chip.active',
      'graph.chip.former',
      'graph.chip.outline',
      'graph.ring.investigation',
      'graph.ring.merged',
      'graph.marker.noteOutline',
      'graph.marker.noteGlyph',
      'graph.noteFlag.none',
      'graph.noteFlag.amber',
      'graph.noteFlag.red',
      'graph.noteFlag.blue',
      'graph.noteFlag.green',
    ]) {
      expect(paths).toContain(required);
    }
  });
});

describe.each([['dark', DARK_TOKENS], ['light', LIGHT_TOKENS]])('%s tokens', (mode, tokens) => {
  it('uses only parseable colour values', () => {
    for (const [path, value] of flatten(tokens)) {
      expect(parseColor(value), `${mode}.${path} = ${value}`).not.toBeNull();
    }
  });

  it('renders a dissolved link exactly like a cessation link', () => {
    expect(tokens.graph.link.dissolved).toBe(tokens.graph.link.cessation);
  });

  it('clears the 3:1 non-text contrast floor against its own canvas', () => {
    const canvas = tokens.graph.surface.canvas;

    for (const group of CONTRAST_GROUPS) {
      for (const [key, value] of Object.entries(tokens.graph[group])) {
        const ratio = contrastRatio(value, canvas);
        expect(ratio, `${mode}.graph.${group}.${key} (${value}) vs canvas ${canvas}`)
          .toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }

    for (const [group, keys] of Object.entries(CONTRAST_KEYS_IN_MIXED_GROUPS)) {
      for (const key of keys) {
        const value = tokens.graph[group][key];
        const ratio = contrastRatio(value, canvas);
        expect(ratio, `${mode}.graph.${group}.${key} (${value}) vs canvas ${canvas}`)
          .toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });

  it('keeps the expanded node distinguishable from an appointment link', () => {
    expect(tokens.graph.node.expanded).not.toBe(tokens.graph.link.appointment);
  });

  it('keeps node labels legible against the node fill', () => {
    expect(contrastRatio(tokens.graph.surface.label, tokens.graph.surface.nodeFill))
      .toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/palette.test.js`
Expected: FAIL — `Failed to resolve import "./palette"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/theme/palette.js`:

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/palette.test.js`
Expected: PASS, 13 tests (3 parity + 5 per mode).

- [ ] **Step 5: Commit**

```bash
git add src/theme/palette.js src/theme/palette.test.js
git -c commit.gpgsign=false commit -m "feat: add contrast-verified light and dark colour tokens"
```

---

## Task 4: Theme factory

**Files:**
- Create: `src/theme/createAppTheme.js`
- Test: `src/theme/createAppTheme.test.js`

**Interfaces:**
- Consumes: `TOKENS_BY_MODE` from `./palette`, `normalizeMode` from `./themeMode`
- Produces: `createAppTheme(mode: 'light' | 'dark') => Theme` — a MUI theme whose `palette.graph` is the mode's `graph` token branch

- [ ] **Step 1: Write the failing test**

Create `src/theme/createAppTheme.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { createAppTheme } from './createAppTheme';
import { DARK_TOKENS, LIGHT_TOKENS } from './palette';

describe('createAppTheme', () => {
  it('builds a dark theme carrying the dark graph tokens', () => {
    const theme = createAppTheme('dark');
    expect(theme.palette.mode).toBe('dark');
    expect(theme.palette.background.default).toBe(DARK_TOKENS.background.default);
    expect(theme.palette.graph).toEqual(DARK_TOKENS.graph);
  });

  it('builds a light theme carrying the light graph tokens', () => {
    const theme = createAppTheme('light');
    expect(theme.palette.mode).toBe('light');
    expect(theme.palette.background.default).toBe(LIGHT_TOKENS.background.default);
    expect(theme.palette.graph).toEqual(LIGHT_TOKENS.graph);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/createAppTheme.test.js`
Expected: FAIL — `Failed to resolve import "./createAppTheme"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/theme/createAppTheme.js`:

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/createAppTheme.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npm test`
Expected: PASS — 135 baseline tests plus the 45 added so far.

```bash
git add src/theme/createAppTheme.js src/theme/createAppTheme.test.js
git -c commit.gpgsign=false commit -m "feat: add createAppTheme factory with graph palette branch"
```

---

## Task 5: Provider, document wiring and the no-flash script

The first task that changes what a user sees. After it, `/app` still renders dark (no toggle yet) but the whole theming path is live.

**Files:**
- Create: `src/theme/ThemeModeProvider.jsx`
- Create: `src/theme/indexHtml.test.js`
- Modify: `index.html:15`
- Modify: `src/index.css:8-13, 36-47`
- Modify: `src/main.jsx:3, 18, 169-196`

**Interfaces:**
- Consumes: `createAppTheme` from `./createAppTheme`; `readStoredMode`, `writeStoredMode`, `resolveThemeMode`, `isAppRoute` from `./themeMode`
- Produces:
  - `ThemeModeProvider` — React component, props `{ children }`
  - `useThemeMode() => { mode, effectiveMode, canToggle, toggleMode }` where `mode` is the user's stored preference, `effectiveMode` is what is actually rendered, and `canToggle` is true only on the app route

- [ ] **Step 1: Write the failing test**

This test pins the duplication between `index.html`'s inline script and the JS constants. The script cannot import the module — it runs before the module graph exists — so a test is the only thing keeping them in sync.

Create `src/theme/indexHtml.test.js`:

```javascript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ROUTE, STORAGE_KEY } from './themeMode';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('index.html pre-paint theme script', () => {
  it('contains the inline theme script', () => {
    expect(html).toContain('data-theme');
  });

  it('references the current storage key', () => {
    expect(html).toContain(STORAGE_KEY);
  });

  it('references the current app route', () => {
    expect(html).toContain(`'${APP_ROUTE}'`);
  });

  it('gives the theme-color meta tag an id so the provider can update it', () => {
    expect(html).toMatch(/<meta[^>]*id="theme-color-meta"[^>]*>/);
  });

  it('runs the script before the app bundle so no dark frame is painted first', () => {
    expect(html.indexOf('data-theme')).toBeLessThan(html.indexOf('src="/src/main.jsx"'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/indexHtml.test.js`
Expected: FAIL — `index.html` has no `data-theme` and no `id="theme-color-meta"`.

- [ ] **Step 3: Add the inline script to `index.html`**

Replace line 15:

```html
    <meta name="theme-color" content="#0a0e1a" />
```

with:

```html
    <meta name="theme-color" id="theme-color-meta" content="#0a0e1a" />
    <script>
      // Stamps the theme on <html> before first paint, so a user who chose light
      // never sees a dark frame flash first. It must apply the SAME route rule as
      // ThemeModeProvider: only /app may be light, or a stored light preference
      // would briefly flash a light landing page.
      //
      // This duplicates isAppRoute/STORAGE_KEY from src/theme/themeMode.js — an
      // inline script runs before the module graph exists and cannot import them.
      // src/theme/indexHtml.test.js pins the duplication.
      (function () {
        try {
          var APP_ROUTE = '/app';
          var path = window.location.pathname;
          var isApp = path === APP_ROUTE || path === APP_ROUTE + '/';
          var stored = window.localStorage.getItem('ms_theme_mode');
          var mode = isApp && stored === 'light' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', mode);
        } catch (e) {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      })();
    </script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/indexHtml.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Move document colours into CSS variables**

In `src/index.css`, replace the `html, body, #root` rule (lines 8-13):

```css
html, body, #root {
  height: 100%;
  width: 100%;
  background: #0a0e1a;
  color: #e0e0e0;
  font-family: 'IBM Plex Sans', 'Roboto', 'Helvetica', 'Arial', sans-serif;
}
```

with:

```css
/* Document chrome is the one place colour lives in CSS rather than in the theme
   objects: it has to be correct before React mounts. The inline script in
   index.html stamps [data-theme], and these variables follow it. Every other
   colour in the app comes from src/theme/palette.js. */
:root {
  --ms-app-bg: #0a0e1a;
  --ms-app-fg: #e0e0e0;
  --ms-scrollbar-thumb: rgba(255, 255, 255, 0.12);
  --ms-scrollbar-thumb-hover: rgba(255, 255, 255, 0.2);
}

:root[data-theme='light'] {
  --ms-app-bg: #f8fafc;
  --ms-app-fg: #1e293b;
  --ms-scrollbar-thumb: rgba(15, 23, 42, 0.18);
  --ms-scrollbar-thumb-hover: rgba(15, 23, 42, 0.3);
}

html, body, #root {
  height: 100%;
  width: 100%;
  background: var(--ms-app-bg);
  color: var(--ms-app-fg);
  font-family: 'IBM Plex Sans', 'Roboto', 'Helvetica', 'Arial', sans-serif;
}
```

Then replace the two scrollbar thumb rules (lines 41-47):

```css
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

with:

```css
::-webkit-scrollbar-thumb {
  background: var(--ms-scrollbar-thumb);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--ms-scrollbar-thumb-hover);
}
```

Also change the comment on line 36 from `/* Dark-themed scrollbar */` to `/* Scrollbar, themed via the variables above */`.

- [ ] **Step 6: Write the provider**

Create `src/theme/ThemeModeProvider.jsx`:

```jsx
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
```

- [ ] **Step 7: Wire it into `src/main.jsx`**

`ThemeModeProvider` calls `useLocation`, so it must sit **inside** `BrowserRouter`. Replace the `darkTheme` definition (lines 169-181) and the render block (lines 183-196) with:

```jsx
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ThemeModeProvider>
          <CssBaseline />
          <TermsProvider>
            <AppRoutes />
          </TermsProvider>
        </ThemeModeProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
```

Update the import on line 3 — `ThemeProvider` and `createTheme` are no longer used here:

```jsx
import { CssBaseline, Box, Button } from '@mui/material';
```

And add after line 18:

```jsx
import { ThemeModeProvider } from './theme/ThemeModeProvider';
```

- [ ] **Step 8: Verify nothing regressed**

Run: `npm test`
Expected: PASS, all files.

Run: `npm run dev`, then open `http://localhost:5174/app` and `http://localhost:5174/`.
Expected: both look exactly as before — dark. No flash on reload. Nothing is light yet; the toggle arrives in Task 6.

- [ ] **Step 9: Commit**

```bash
git add index.html src/index.css src/main.jsx src/theme/ThemeModeProvider.jsx src/theme/indexHtml.test.js
git -c commit.gpgsign=false commit -m "feat: wire route-scoped theme provider with no-flash pre-paint script"
```

---

## Task 6: The toggle

**Files:**
- Create: `src/theme/ThemeModeToggle.jsx`
- Modify: `src/App.jsx:219` (icon row), plus the per-language `copy` objects

**Interfaces:**
- Consumes: `useThemeMode()` from `./ThemeModeProvider`
- Produces: `ThemeModeToggle` — React component, props `{ label: { toLight: string, toDark: string } }`

- [ ] **Step 1: Write the toggle component**

There is no test step here: `vitest.config.js` excludes component tests by project convention, and this component has no logic beyond delegating to `useThemeMode`. It is verified by running the app in Step 4.

Create `src/theme/ThemeModeToggle.jsx`:

```jsx
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
```

- [ ] **Step 2: Add the bilingual copy to `src/App.jsx`**

`App.jsx` holds a `copy` object per language. Find the object containing `menu: { tooltip: ... }` for each language and add a sibling `themeToggle` key.

English:

```javascript
    themeToggle: {
      toLight: 'Switch to light mode',
      toDark: 'Switch to dark mode',
    },
```

Spanish:

```javascript
    themeToggle: {
      toLight: 'Cambiar a modo claro',
      toDark: 'Cambiar a modo oscuro',
    },
```

- [ ] **Step 3: Render it in the breadcrumb bar**

In `src/App.jsx`, add the import alongside the existing component imports:

```jsx
import { ThemeModeToggle } from './theme/ThemeModeToggle';
```

Then inside the icon-row `Box` at line 219, add the toggle immediately before the existing menu `Tooltip`:

```jsx
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <ThemeModeToggle label={copy.themeToggle} />
          <Tooltip title={copy.menu.tooltip}>
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open `http://localhost:5174/app`.

Expected:
- A sun icon appears left of the hamburger menu.
- Clicking it turns the breadcrumb bar, search panel and dialogs light. **The graph canvas will still be dark** — that is Task 8.
- Reloading keeps light mode with no dark flash.
- Navigating to `/` shows a dark landing page and no toggle.
- Returning to `/app` restores light.

- [ ] **Step 5: Run the suite and commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/App.jsx src/theme/ThemeModeToggle.jsx
git -c commit.gpgsign=false commit -m "feat: add light/dark toggle to the app breadcrumb bar"
```

---

## Task 7: Note-flag colours move to the palette

**Files:**
- Modify: `src/utils/nodeNotes.js:5-11`
- Test: `src/utils/nodeNotes.test.js` (add two cases)

**Interfaces:**
- Consumes: nothing
- Produces: `NODE_NOTE_FLAG_KEYS: readonly string[]` exported from `src/utils/nodeNotes.js`, listing `['none', 'amber', 'red', 'blue', 'green']`

`NODE_NOTE_FLAGS` keeps existing so nothing breaks mid-migration; Task 9 removes its last colour consumer.

- [ ] **Step 1: Write the failing test**

Append inside the `describe('node notes', ...)` block in `src/utils/nodeNotes.test.js`:

```javascript
  it('exposes flag keys that match the palette note-flag tokens', async () => {
    const { NODE_NOTE_FLAG_KEYS } = await import('./nodeNotes');
    const { DARK_TOKENS, LIGHT_TOKENS } = await import('../theme/palette');

    expect([...NODE_NOTE_FLAG_KEYS].sort()).toEqual(
      Object.keys(DARK_TOKENS.graph.noteFlag).sort()
    );
    expect([...NODE_NOTE_FLAG_KEYS].sort()).toEqual(
      Object.keys(LIGHT_TOKENS.graph.noteFlag).sort()
    );
  });

  it('persists the flag name rather than a colour, so themes can remap freely', () => {
    const updated = setNodeNote(
      graph,
      'company-a',
      { text: 'Check this', flag: 'amber' },
      '2026-07-31T00:00:00.000Z'
    );
    expect(updated.nodes[0].userNote.flag).toBe('amber');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/nodeNotes.test.js`
Expected: FAIL — `NODE_NOTE_FLAG_KEYS` is undefined.

- [ ] **Step 3: Export the keys**

In `src/utils/nodeNotes.js`, immediately after the `NODE_NOTE_FLAGS` definition (which ends at line 11), add:

```javascript
// Flag NAMES are the persistence contract — a saved note stores 'amber', never a
// hex value — which is what lets each theme map flags to its own colours.
// Colours live in src/theme/palette.js under graph.noteFlag.
export const NODE_NOTE_FLAG_KEYS = Object.freeze(Object.keys(NODE_NOTE_FLAGS));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/nodeNotes.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/nodeNotes.js src/utils/nodeNotes.test.js
git -c commit.gpgsign=false commit -m "refactor: expose node-note flag keys separately from their colours"
```

---

## Task 8: Graph canvas reads the palette

The task that makes the graph itself theme-aware.

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — lines `1681-1691`, `1700`, `6391-6651`, `6653-6800`, `8631`

**Interfaces:**
- Consumes: `theme.palette.graph` (shape defined in Task 3)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Pull the palette into the component**

Add `useTheme` to the existing `@mui/material` import at the top of the file, then inside the component body, immediately above the `nodeColors` memo at line 1681:

```jsx
  const theme = useTheme();
  const graphPalette = theme.palette.graph;
```

- [ ] **Step 2: Replace the node colour constants**

Replace lines 1681-1691:

```jsx
  const nodeColors = React.useMemo(
    () => ({
      company: '#33bdad',
      officer_individual: '#cd87c0',
      officer_company: '#8a86d4',
      expanded: '#56b387',
      selected: '#e26d9a',
      searchOrigin: '#5fd6c6',
    }),
    []
  );
```

with:

```jsx
  // Snake_case keys are kept: they are matched against node type strings
  // elsewhere in this file. Only the colour source changes.
  const nodeColors = React.useMemo(
    () => ({
      company: graphPalette.node.company,
      officer_individual: graphPalette.node.officerIndividual,
      officer_company: graphPalette.node.officerCompany,
      expanded: graphPalette.node.expanded,
      selected: graphPalette.node.selected,
      searchOrigin: graphPalette.node.searchOrigin,
    }),
    [graphPalette]
  );
```

Replace line 1700:

```jsx
  const PATH_HIGHLIGHT_COLOR = '#4dd0e1';
```

with:

```jsx
  const PATH_HIGHLIGHT_COLOR = graphPalette.link.pathHighlight;
```

- [ ] **Step 3: Replace the literals inside `nodeCanvasObject`**

Apply each substitution in the `nodeCanvasObject` callback (starts line 6391). Line numbers are pre-edit; work bottom-up or re-grep between edits.

| Line | From | To |
|---|---|---|
| 6458 | `ctx.fillStyle = '#0d1220';` | `ctx.fillStyle = graphPalette.surface.nodeFill;` |
| 6494 | `ctx.fillStyle = isFormer ? '#9ca3af' : '#f59e0b';` | `ctx.fillStyle = isFormer ? graphPalette.chip.former : graphPalette.chip.active;` |
| 6496 | `ctx.strokeStyle = '#fff';` | `ctx.strokeStyle = graphPalette.chip.outline;` |
| 6518 | `const bg = isUnified ? '#14b8a6' : '#f59e0b';` | `const bg = isUnified ? graphPalette.badge.unified : graphPalette.badge.cargo;` |
| 6539 | `ctx.strokeStyle = 'rgba(4, 18, 31, 0.9)';` | `ctx.strokeStyle = graphPalette.surface.badgeHalo;` |
| 6542 | `ctx.fillStyle = isUnified ? '#04121f' : '#1a1206';` | `ctx.fillStyle = isUnified ? graphPalette.badge.unifiedText : graphPalette.badge.cargoText;` |
| 6572 | `ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';` | `ctx.strokeStyle = graphPalette.surface.labelHalo;` |
| 6576 | `ctx.fillStyle = '#e0e0e0';` | `ctx.fillStyle = graphPalette.surface.label;` |
| 6590 | `ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';` | `ctx.strokeStyle = graphPalette.surface.labelHalo;` |
| 6593 | `ctx.fillStyle = 'rgba(180, 180, 180, 0.85)';` | `ctx.fillStyle = graphPalette.surface.labelSubtle;` |
| 6603 | `ctx.strokeStyle = '#7c4dff'; // distinct from status colors` | `ctx.strokeStyle = graphPalette.ring.investigation; // distinct from status colors` |
| 6617 | `ctx.strokeStyle = '#f59e0b'; // amber = user-created grouping` | `ctx.strokeStyle = graphPalette.ring.merged; // amber = user-created grouping` |
| 6629 | `const noteColor = NODE_NOTE_FLAGS[node.userNote.flag] \|\| NODE_NOTE_FLAGS.none;` | `const noteColor = graphPalette.noteFlag[node.userNote.flag] \|\| graphPalette.noteFlag.none;` |
| 6637 | `ctx.strokeStyle = '#f8fafc';` | `ctx.strokeStyle = graphPalette.marker.noteOutline;` |
| 6643 | `ctx.fillStyle = '#0f172a';` | `ctx.fillStyle = graphPalette.marker.noteGlyph;` |

Then add `graphPalette` to the dependency array at line 6651. Changing the callback identity is what makes react-force-graph repaint on toggle — without this the canvas keeps the old colours until some unrelated re-render:

```jsx
    [nodeSize, labelSize, showNodeLabels, nodeColors, filteredGraphData.nodes, pinnedNodeIds, officerDeputyMatches, pathfinderActive, shortestPathNodes, colorByCluster, getClusterColor, PATH_DIM_ALPHA, PATH_HIGHLIGHT_COLOR, sharedHighlightIds, investigationSet, graphPalette]
```

- [ ] **Step 4: Replace the literals inside `linkCanvasObject`**

In the callback starting line 6653:

| Line | From | To |
|---|---|---|
| 6686 | `? '#94a3b8' // Slate — previous (superseded) sole shareholder` | `? graphPalette.link.ownershipPrevious // Slate — previous (superseded) sole shareholder` |
| 6688 | `? '#c79a3a'` | `? graphPalette.link.ownershipLost` |
| 6689 | `: '#fbbf24'; // Amber — current sole shareholder` | `: graphPalette.link.ownership; // Amber — current sole shareholder` |
| 6691 | `linkColor = '#f87171'; // Red — officer link to a DISSOLVED company is not current` | `linkColor = graphPalette.link.dissolved; // Red — officer link to a DISSOLVED company is not current` |
| 6693 | `linkColor = '#34d399'; // Green — appointments and re-elections` | `linkColor = graphPalette.link.appointment; // Green — appointments and re-elections` |
| 6698 | `linkColor = '#f87171'; // Red — resignations and revocations` | `linkColor = graphPalette.link.cessation; // Red — resignations and revocations` |
| 6700 | `linkColor = '#64748b'; // Slate for unknown / company-company` | `linkColor = graphPalette.link.unknown; // Slate for unknown / company-company` |
| 6778 | `ctx.strokeStyle = '#0d1220';` | `ctx.strokeStyle = graphPalette.surface.arrowOutline;` |

Add `graphPalette` to this callback's dependency array too.

- [ ] **Step 5: Theme the canvas container**

Replace line 8631:

```jsx
        sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 200, bgcolor: '#0d1220' }}
```

with:

```jsx
        sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 200, bgcolor: 'graph.surface.canvas' }}
```

- [ ] **Step 6: Check for leftover literals in the two callbacks**

Run:

```bash
awk 'NR>=6391 && NR<=6800' src/components/SpanishCompanyNetworkGraph.jsx | grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\("
```

Expected: no output. Any hit is a literal Steps 3-4 missed — map it to a `graphPalette` token, adding one to `palette.js` (and its light counterpart) if none fits. A new token must clear the palette test's contrast floor.

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`, open `http://localhost:5174/app`, search a company (e.g. `ACCIONA`) and expand a node.

Expected in **light** mode:
- Canvas is off-white; nodes are white with coloured outlines.
- Labels are dark slate and legible; the halo is white.
- Link colours still read as green = appointment, red = cessation, amber = ownership.
- Badges show white text on darkened teal/amber fills.
- Toggling switches the canvas immediately, with no page reload and no need to re-search.

Expected in **dark** mode: pixel-identical to before this task.

- [ ] **Step 8: Run the suite and commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git -c commit.gpgsign=false commit -m "feat: draw the graph canvas from theme palette tokens"
```

---

## Task 9: Graph JSX chrome

The remaining ~90 literals in `SpanishCompanyNetworkGraph.jsx` are in JSX (toolbar, legend, panels, preview), not on the canvas.

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` — all remaining colour literals outside lines 6391-6800

**Interfaces:**
- Consumes: `graphPalette` (from Task 8, Step 1), standard MUI tokens, `NODE_NOTE_FLAG_KEYS` from Task 7
- Produces: nothing

- [ ] **Step 1: List what remains**

Run:

```bash
grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src/components/SpanishCompanyNetworkGraph.jsx \
  | awk -F: '$1 < 6391 || $1 > 6800'
```

- [ ] **Step 2: Replace each, by category**

Work down the list applying these rules:

- **A legend or status swatch mirroring a canvas colour** → the matching `graph.*` token via `sx`, e.g. `sx={{ bgcolor: 'graph.link.appointment' }}`. These MUST match the canvas or the legend lies.
- **Body text** → `'text.primary'`, `'text.secondary'` or `'text.disabled'`.
- **A panel or surface background** → `'background.paper'`.
- **A border or separator** → `'divider'`.
- **A translucent white overlay** (`rgba(255,255,255,0.0X)`) → `'action.hover'` or `'action.selected'`. These break hardest in light mode: white-on-white is invisible.
- **An accent or link colour** (e.g. `#90caf9` at line 8744) → `'primary.light'` or `'primary.main'`.
- **The note-flag swatch** at line 9831 (`bgcolor: NODE_NOTE_FLAGS[value]`) and the note colour reads at 9339, 9444, 9737 → `graphPalette.noteFlag[...]`, matching Task 8's canvas marker so the picker swatch and the drawn marker agree.

Once the last `NODE_NOTE_FLAGS` colour read is gone, change the import at line 143 to `NODE_NOTE_FLAG_KEYS` and use it for the validation at line 4945:

```jsx
      NODE_NOTE_FLAG_KEYS.includes(contextNode.userNote?.flag)
```

- [ ] **Step 3: Confirm nothing is left**

Run:

```bash
grep -cE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src/components/SpanishCompanyNetworkGraph.jsx
```

Expected: `0`.

If a literal genuinely must stay (a third-party widget needing a raw string), leave it with a one-line comment saying why, so the next reader does not treat it as an oversight.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open `/app` in light mode and exercise: the toolbar, the settings menu, the legend, the node context menu, the note dialog and its colour picker, the officer sidebar, the pathfinder panel, and the company preview.

Expected: no white-on-white text, no invisible borders, no panel that stayed dark. Legend swatches match the drawn colours exactly.

- [ ] **Step 5: Run the suite and commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git -c commit.gpgsign=false commit -m "feat: theme graph toolbar, legend and panels for light mode"
```

---

## Task 10: Dialogs, and the out-of-scope guard

The graph opens dialogs that live in other files. They render under the app's theme, so they must work in light mode too. This task also confirms the out-of-scope routes really did stay dark.

**Files:**
- Modify: `src/components/DDCheckoutDialog.jsx` (~35 literals), `src/components/AIInvestigationGate.jsx` (~11), `src/components/CurrencyConfirmationCard.jsx` (~10), plus any other dialog reachable from `/app`

**Interfaces:**
- Consumes: standard MUI tokens, `theme.palette.graph` where a colour mirrors the canvas
- Produces: nothing

- [ ] **Step 1: Find dialogs reachable from `/app`**

Run:

```bash
grep -nE "^import .* from '\./" src/components/SpanishCompanyNetworkGraph.jsx | grep -iE "dialog|modal|sidebar|card|gate"
```

- [ ] **Step 2: Replace literals in each, using Task 9's category rules**

Check each file with:

```bash
grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src/components/<File>.jsx
```

Leave `RelationshipReportModal.jsx`'s print-specific colours alone — the print stylesheet is explicitly out of scope and is always dark-on-white regardless of app theme.

- [ ] **Step 3: Verify the out-of-scope routes stayed dark**

Run: `npm run dev`. With light mode active on `/app`, visit each of:

`/`, `/es`, `/pricing`, `/due-diligence`, `/spanish-company-due-diligence`, `/spanish-company-register-search`, `/connect-claude`, `/order/cs_test_x`, `/admin`, `/dashboard`

Expected: every one renders dark, exactly as before. This is the guard on the highest-risk part of the design — `/due-diligence`, `/order/*` and `/admin` have no root background of their own and would have broken under a global flip.

- [ ] **Step 4: Verify the dialogs**

From `/app` in light mode, open: the due-diligence checkout, the AI investigation gate, a currency confirmation card, the node-note dialog, and the relationship report modal.

Expected: all legible. Save-as-PDF from the relationship report still prints dark-on-white.

- [ ] **Step 5: Run the suite and commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/components/
git -c commit.gpgsign=false commit -m "feat: theme app dialogs for light mode"
```

---

## Task 11: Final verification

**Files:** none modified unless a defect is found

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: PASS — 135 baseline tests plus roughly 50 added here, 0 failures.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds. This matters more than usual here: a past incident had `vite build` pass while the app rendered a blank page, so a green build is necessary but not sufficient.

- [ ] **Step 3: Confirm the prerenderer preserved the inline script**

`scripts/prerender.mjs` reads the built `dist/index.html` as a template and writes
a copy per route, so every production HTML file — not just the root one — must
still carry the pre-paint script. It rewrites meta tags by regex and does not
touch `theme-color`, but verify rather than assume:

```bash
grep -c "data-theme" dist/index.html dist/pricing/index.html dist/due-diligence/index.html
```

Expected: `1` for each. A `0` anywhere means the prerenderer stripped or mangled
the script and every user on that route would get a flash.

- [ ] **Step 4: Preview the built bundle**

Run: `npm run preview`, then exercise `/app` in both modes and `/` in the built output.

Expected: identical behaviour to dev. Confirm no dark flash on a hard reload of `/app` in light mode (`Cmd+Shift+R`).

- [ ] **Step 5: Check the no-flash path directly**

In the browser console on `/app`:

```javascript
localStorage.setItem('ms_theme_mode', 'light'); location.reload();
```

Expected: the page paints light immediately — no dark frame. Then navigate to `/` and confirm it paints dark immediately, with no light flash.

- [ ] **Step 6: Confirm storage failure degrades safely**

In the console, simulate storage being unavailable:

```javascript
Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
location.reload();
```

Expected: the app loads in dark mode and does not crash. (Restore by reopening the tab.)

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git -c commit.gpgsign=false commit -m "fix: address light mode verification findings"
```

---

## Definition of Done

- `npm test` passes; `npm run build` succeeds.
- `/app` toggles between light and dark; the choice survives a reload with no flash.
- The graph canvas, its chrome, and its dialogs are all legible in light mode.
- Every other route renders dark regardless of stored mode.
- `grep -cE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src/components/SpanishCompanyNetworkGraph.jsx` returns `0`, or every remaining literal carries a comment explaining why it must stay.
- No new dependency was added and no `.test.jsx` file exists.
