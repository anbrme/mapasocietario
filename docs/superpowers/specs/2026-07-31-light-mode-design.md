# Light mode for the company graph app

**Date:** 2026-07-31
**Status:** Approved, ready for implementation planning

## Problem

The app renders dark only. A single `darkTheme` is created in `src/main.jsx:169`, and
`src/index.css` hard-sets `background: #0a0e1a` on `html, body, #root`. Users working
in bright environments, reading long officer lists, or printing have no alternative.

## Scope

Light mode applies to `/app` only: the search screen, the network graph, the company
preview, and their dialogs.

Out of scope, and pinned dark by the route-scoping rule below:

- Marketing pages (landing, pricing, due-diligence, SEO, connect-Claude)
- Order status and admin tabs
- The print stylesheet in `index.css`

## Current state

Two categories of colour exist in the codebase:

- **~300 MUI theme-token references** (`text.secondary`, `primary.light`,
  `background.paper`). These flip for free when the palette mode changes.
- **472 hardcoded colour literals** that do not flip. Distribution:
  `SpanishCompanyNetworkGraph.jsx` 128, marketing pages ~100, dialogs ~46,
  admin tabs ~27, remainder scattered.

Within the graph, the literals split into two classes that must be treated
differently:

- **Surface/contrast colours** — node fill `#0d1220`, label `#e0e0e0`, badge text
  `#04121f`, marker glyph `#0f172a`. These must flip.
- **Semantic hues** — green = appointment, red = cessation/dissolved,
  amber = sole shareholder, slate = unknown, teal = company, pink = individual,
  violet = corporate officer. These carry meaning. They must keep their hue family
  across modes, but their dark-tuned values fail contrast on a light canvas and need
  contrast-adjusted light variants.

## Architecture

A new `src/theme/` module:

| File | Responsibility |
|---|---|
| `palette.js` | `DARK_TOKENS` / `LIGHT_TOKENS` — plain objects, single source of colour truth |
| `createAppTheme.js` | `createAppTheme(mode)` → MUI theme with standard palette plus a custom `palette.graph` branch |
| `themeMode.js` | Pure mode logic — `APP_ROUTE`, `STORAGE_KEY`, `THEME_MODES`, `DEFAULT_MODE`, `isAppRoute()`, `normalizeMode()`, `resolveThemeMode()`, `readStoredMode()`, `writeStoredMode()` |
| `contrast.js` | `contrastRatio()` — used by the palette test to enforce the 3:1 floor |
| `ThemeModeProvider.jsx` | Thin React wrapper over `themeMode.js`: context, `useThemeMode()`, `data-theme` and `theme-color` side effects |
| `ThemeModeToggle.jsx` | Sun/moon `IconButton` |

Plain JS objects rather than CSS custom properties: the canvas needs real values at
draw time, and CSS variables would require a `getComputedStyle` read-back on every
mode change plus a second, parallel definition for the MUI palette.

### Route scoping

`ThemeModeProvider` sits at the root in `main.jsx`. The **effective mode** is:

```
effectiveMode = isAppRoute ? userMode : 'dark'
```

Only `/app` can be light. This is load-bearing, not cosmetic: `DueDiligencePage`,
`OrderStatusPage` and `AdminPage` set no root background of their own and layer
`rgba(255,255,255,0.03)` panels over the global dark. A global flip would render
those panels invisible. (`LandingPage`, `PricingPage`, `ConnectClaudePage` and
`SpanishSeoPage` pin their own `#0a0e1a` and are already insulated, but they are
covered by the same rule for consistency.)

One place decides the mode, so no page can drift out of sync.

`document.documentElement.dataset.theme` follows the **effective** mode, keeping the
document background, overscroll rubber-band and scrollbar consistent with what React
renders. Dialogs are React portals and inherit the provider through context, so they
need no special handling.

### Avoiding the flash of wrong theme

An inline script in `index.html` stamps `data-theme` on `<html>` before first paint.
It must apply the **same** route rule as the provider, not just read storage:
a user whose stored mode is light, landing on `/`, must be stamped `dark` or the
marketing page flashes light before React corrects it. The script therefore reads
`localStorage` **and** tests `location.pathname` against the app route, mirroring
`effectiveMode` above.

The inline script cannot import the provider's `isAppRoute` helper — it runs before
the module graph exists — so the route check is necessarily duplicated. Rather than
pretend otherwise, the duplication is pinned by a test: `index.html` is read and
asserted to contain both the current app route and the current storage key, so
changing either in `src/theme/` without updating the inline script fails the suite.

`index.css` drives `html, body, #root` and the scrollbar from four CSS variables —
`--ms-app-bg`, `--ms-app-fg`, `--ms-scrollbar-thumb`, `--ms-scrollbar-thumb-hover` —
instead of literals.

This is a deliberate, bounded exception to the JS-token design: pre-paint HTML has no
access to the React theme. It covers four variables for raw document chrome only.
Everything else reads from the theme object.

`<meta name="theme-color">` (`index.html:15`, currently `#0a0e1a`) is updated on mode
change so mobile browser chrome matches.

## Token shape

`palette.graph` names the meanings already implicit in the canvas code:

```
graph: {
  surface: { canvas, nodeFill, label, labelSubtle, labelHalo, badgeHalo, arrowOutline,
             edgeLabelBg, edgeLabelText },
  node:    { company, officerIndividual, officerCompany, expanded, selected, searchOrigin },
  link:    { appointment, cessation, ownership, ownershipPrevious,
             ownershipLost, unknown, dissolved, pathHighlight },
  badge:   { unified, unifiedText, cargo, cargoText },
  chip:    { active, former, outline },
  ring:    { investigation, merged },
  marker:  { noteOutline, noteGlyph },
  noteFlag: { none, amber, red, blue, green },
}
```

`graph.surface.edgeLabelBg` / `edgeLabelText` were added mid-implementation to theme
the edge-label pill drawn on hover, which had been overlooked in the initial token
shape. Dark: `rgba(18, 24, 40, 0.75)` / `rgba(200, 200, 200, 0.9)`. Light:
`rgba(255, 255, 255, 0.85)` / `rgba(51, 65, 85, 0.9)`.

A second, top-level `accent` group sits alongside `graph` (not inside it) —
`{ primary, success, warning, info }`, mode-aware. Dark: `#2dd4bf` / `#81c784` /
`#ffb74d` / `#64b5f6`. Light: `#0f766e` / `#2e7d32` / `#b45309` / `#1d4ed8`.

It was added in final review, not in the original plan: components had been reading
MUI's own `theme.palette.{primary,success,warning,info}.light` for text/icon accents,
and those shades are tuned to sit on dark surfaces. Measured against white paper they
score 1.73–2.49:1 (warning.light lowest, `primary.light` highest) — nowhere near
readable, a Critical defect caught in the final whole-branch review gate. `accent.*`
replaces those reads across the `/app`-reachable components. It is checked in
`palette.test.js` against a **4.5:1 text-contrast floor** (WCAG 1.4.3) — stricter than
the 3:1 non-text floor the graph canvas colours are held to, because this group renders
as text and thin icon strokes, not as filled shapes on a canvas. Dark-mode `accent`
values are unchanged (same hex as the old `.light` shades); only light mode needed new,
darker values to clear 4.5:1 against `background.paper`.

Note that `success`/`warning`/`error`/`info` themselves are still MUI's stock palette
— nothing in `palette.js` or `createAppTheme.js` overrides them. `accent.*` is a
parallel, separately-named group; components that still reach for `color="success"` /
`color="warning"` etc. are relying on MUI's own light/dark defaults, unaudited by
`palette.test.js`.

### Note flags

`NODE_NOTE_FLAGS` in `src/utils/nodeNotes.js` remains a frozen module constant mapping
flag name → hex, and it still holds all five colour values — they did not move out of
the file. What changed is that the graph component no longer *reads* those hex values:
its canvas and JSX colour reads were repointed to `palette.graph.noteFlag[flag]`
instead. `nodeNotes.js` is now imported only for `NODE_NOTE_FLAG_KEYS` (`Object.keys`
of the same frozen object), used purely for flag-name validation — e.g. the context-menu
handler at `SpanishCompanyNetworkGraph.jsx:4952` checks
`NODE_NOTE_FLAG_KEYS.includes(...)` rather than the old
`Object.prototype.hasOwnProperty.call(NODE_NOTE_FLAGS, ...)`. The five hex values left
in `NODE_NOTE_FLAGS` are dead weight for rendering purposes but harmless: nothing
reads `NODE_NOTE_FLAGS`'s values anymore, only its keys.

This is safe for existing user data: `normalizeNodeNote` (`nodeNotes.js:52`)
persists the flag *name*, never the hex, so remapping colours per mode cannot
invalidate a saved note.

## Light palette

Contrast ratios are computed against each mode's own **graph canvas** (`#0d1220`
dark, `#f8fafc` light) and all clear the WCAG 1.4.11 3:1 non-text contrast floor.

Note the two distinct backgrounds: `#0a0e1a` is the *document* background
(`index.css`, non-app pages), while the graph canvas is `#0d1220` — the container
`Box` at `SpanishCompanyNetworkGraph.jsx:8631`, which shows through because
`ForceGraph2D` sets no `backgroundColor`. Graph contrast is measured against the
latter.

| Token | Dark | Light | Light ratio |
|---|---|---|---|
| `node.company` | `#33bdad` | `#0f766e` | 5.23 |
| `node.officerIndividual` | `#cd87c0` | `#a21caf` | 6.04 |
| `node.officerCompany` | `#8a86d4` | `#4f46e5` | 6.01 |
| `node.expanded` | `#56b387` | `#15803d` | 4.79 |
| `node.selected` | `#e26d9a` | `#be123c` | 6.01 |
| `node.searchOrigin` | `#5fd6c6` | `#0d9488` | 3.58 |
| `link.appointment` | `#34d399` | `#047857` | 5.24 |
| `link.cessation` | `#f87171` | `#dc2626` | 4.62 |
| `link.ownership` | `#fbbf24` | `#b45309` | 4.80 |
| `link.ownershipPrevious` | `#94a3b8` | `#475569` | 7.24 |
| `link.ownershipLost` | `#c79a3a` | `#92400e` | 6.78 |
| `link.unknown` | `#64748b` | `#475569` | 7.24 |
| `link.pathHighlight` | `#4dd0e1` | `#0891b2` | 3.52 |

Badges, chips, rings and note flags, same 3:1 floor:

| Token | Dark | Light | Light ratio |
|---|---|---|---|
| `badge.unified` | `#14b8a6` | `#0f766e` | 5.23 |
| `badge.cargo` | `#f59e0b` | `#b45309` | 4.80 |
| `chip.active` | `#f59e0b` | `#b45309` | 4.80 |
| `chip.former` | `#9ca3af` | `#64748b` | 4.55 |
| `ring.investigation` | `#7c4dff` | `#6d28d9` | 6.79 |
| `ring.merged` | `#f59e0b` | `#b45309` | 4.80 |
| `noteFlag.none` | `#94a3b8` | `#475569` | 7.24 |
| `noteFlag.amber` | `#f59e0b` | `#b45309` | 4.80 |
| `noteFlag.red` | `#ef4444` | `#dc2626` | 4.62 |
| `noteFlag.blue` | `#3b82f6` | `#1d4ed8` | 6.41 |
| `noteFlag.green` | `#22c55e` | `#15803d` | 4.79 |

Surfaces and non-measured tokens (halos and glyph fills sit *on* a coloured shape,
not on the canvas, so the 3:1-vs-canvas rule does not apply to them):

| Token | Dark | Light |
|---|---|---|
| `surface.canvas` | `#0d1220` | `#f8fafc` |
| `surface.nodeFill` | `#0d1220` | `#ffffff` |
| `surface.label` | `#e0e0e0` | `#1e293b` |
| `surface.labelSubtle` | `rgba(180,180,180,0.85)` | `rgba(51,65,85,0.85)` |
| `surface.labelHalo` | `rgba(0,0,0,0.7)` | `rgba(255,255,255,0.85)` |
| `surface.badgeHalo` | `rgba(4,18,31,0.9)` | `rgba(255,255,255,0.9)` |
| `surface.arrowOutline` | `#0d1220` | `#ffffff` |
| `surface.edgeLabelBg` | `rgba(18,24,40,0.75)` | `rgba(255,255,255,0.85)` |
| `surface.edgeLabelText` | `rgba(200,200,200,0.9)` | `rgba(51,65,85,0.9)` |
| `badge.unifiedText` | `#04121f` | `#ffffff` |
| `badge.cargoText` | `#1a1206` | `#ffffff` |
| `chip.outline` | `#ffffff` | `#ffffff` |
| `marker.noteOutline` | `#f8fafc` | `#1e293b` |
| `marker.noteGlyph` | `#0f172a` | `#ffffff` |

Badge and glyph text flips to white in light mode because the badge fills darken
(`#0f766e`, `#b45309`) — the contrast is carried by the fill, inverted from dark mode
where a bright fill carried near-black text.

`link.dissolved` shares `link.cessation`'s value in both modes, matching current
behaviour where both draw `#f87171`.

Every hue keeps its family, so the legend and the learned association of
green = appointment, red = cessation, amber = ownership survive the switch.

**Design note:** `node.expanded` and `link.appointment` both resolve to `#047857`
under a naive light mapping. `node.expanded` is therefore `#15803d` to keep them
distinguishable.

## Graph integration

`SpanishCompanyNetworkGraph.jsx` reads `palette.graph` from `useTheme()`. The
`nodeColors` memo (`:1688`) is **kept, not replaced** — it still supplies the
snake_case keys (`officer_individual`, `officer_company`, …) that are matched
against node `type`/`subtype` strings elsewhere in the file, so re-keying it away
would have meant touching every match site. Only its colour *source* changes: each
value now reads from `graphPalette.node.*` instead of a hex literal. Likewise
`PATH_HIGHLIGHT_COLOR` (`:1707`) is now `graphPalette.link.pathHighlight` rather than
a literal. The ~40 canvas literals in `nodeCanvasObject` and `linkCanvasObject`
become token reads — including the label halo, subtle subtitle, badge halo, chip
outline, investigation ring, merged ring, note marker and arrow outline.

The graph container `Box` (`bgcolor: '#0d1220'`) becomes `graph.surface.canvas`.

The `NODE_NOTE_FLAGS` hex reads throughout the graph component become
`graphPalette.noteFlag[flag]` reads (canvas marker fill, context-menu swatches, the
note-colour picker, the preview panel) and `graphPalette.marker.noteOutline` /
`noteGlyph` for the marker's outline and glyph. The one place that read
`NODE_NOTE_FLAGS` for its *keys* rather than its colours — the note-flag validation
in the context-menu handler (`:4952`) — now imports `NODE_NOTE_FLAG_KEYS` instead.

Adding `graph` to both callbacks' dependency arrays changes the callback identity on
mode change, which is what triggers react-force-graph to repaint. No imperative
redraw is required.

The remaining ~90 literals in that file are JSX chrome (toolbar, legend, panels).
All but 30 of them become MUI tokens or `graph.*` reads; the 30 that don't are the
floating "Datos" table card, left as intentionally theme-independent literals (see
Decisions, below).

## Toggle

A sun/moon `IconButton` in the `/app` breadcrumb bar, next to the existing menu
button (`App.jsx:229`). That bar is already fully token-based
(`background.paper`, `divider`, `text.secondary`, `primary.light`) and needs no
other change. Label and tooltip are bilingual, following the existing `copy` pattern
in that file.

Default is dark. The choice persists in `localStorage` under `ms_theme_mode`.
Existing users see no change until they opt in.

## Testing

Vitest, `*.test.js` beside source, following repo convention. Tests written first.

`palette.test.js`:
- Key parity — every leaf token present in `DARK_TOKENS` exists in `LIGHT_TOKENS`
  and vice versa, so a token added to one mode cannot silently miss the other.
- Every value is a valid hex or `rgba()` colour.
- Contrast — every value in `graph.node`, `graph.link`, `graph.badge` (fills),
  `graph.chip` (fills), `graph.ring` and `graph.noteFlag` scores ≥3:1 against its own
  mode's `graph.surface.canvas`. This makes the palette tables above an enforced
  invariant rather than a one-time measurement. `graph.surface`, the `*Text` badge
  tokens, `chip.outline` and `marker.*` are excluded: they render on top of a
  coloured shape rather than on the canvas, so canvas contrast is the wrong measure
  for them.

`themeMode.test.js`:
- Defaults to dark when storage is empty.
- Persists a selected mode and restores it.
- Ignores a corrupt or unrecognised stored value, falling back to dark.
- Forces dark on non-`/app` routes regardless of stored mode.

`vitest.config.js` is explicitly scoped to pure-logic tests — `environment: 'node'`,
`include: ['src/**/*.test.js', 'functions/**/*.test.js']`, and a comment stating no
jsdom and no component tests. The mode logic is therefore extracted into a **pure**
`themeMode.js` (`resolveThemeMode({ stored, pathname })`, `readStoredMode(storage)`,
`writeStoredMode(storage, mode)` — storage injected, never a global reference), and
`ThemeModeProvider.jsx` is a thin wrapper with no branching logic of its own.

This keeps the decision logic under test without adding jsdom or
`@testing-library/react`, and matches how every other util in the repo is tested.
The provider and toggle are verified by running the app, per the same convention.

`indexHtml.test.js`:
- `index.html` contains the inline script, and that script references the current
  `APP_ROUTE` and `STORAGE_KEY` values exported from `themeMode.js`, pinning the
  unavoidable duplication described above.
- `src/index.css`'s `--ms-app-bg` and `--ms-app-fg` values, for both `:root` and
  `:root[data-theme='light']`, are asserted against `DARK_TOKENS`/`LIGHT_TOKENS`
  directly (`background.default` and `graph.surface.label`) rather than against a
  second hardcoded copy of the hex — so a palette change that isn't mirrored into
  `index.css` fails this suite instead of leaving the pre-paint background or
  scrollbar silently stale.

## Decisions made during implementation

- **The floating "Datos" table card stays theme-independent.** It was a white-on-dark
  card before light mode existed and remains white-on-either after — dense tabular
  data reads best on a light card regardless of app theme, like a spreadsheet embed.
  It retains 30 hardcoded colour literals (bgcolor, filter row, header/body text,
  in-table badges); only its teal drag-header and outer `divider` border are
  theme-aware. In light mode its separation from the canvas relies on `elevation={6}`
  plus the divider border rather than a colour contrast against the page.
- **`OfficerTimelineDialog`'s `CATEGORY_COLORS` legend (11 role colours) stays fixed.**
  It has no counterpart in `graph.node`/`graph.link` — the canvas only distinguishes
  company vs. officer, not specific role — so there was no existing token to map onto
  without inventing one. All 11 were spot-checked as legible on both a dark canvas and
  a white dialog paper and left as literals, pending a possible future
  `graph.role.*` token group.
- **Two dark-mode chip colours were deliberately realigned to mirror the canvas
  colours they represent**, in the toolbar/legend tokenization pass: the cargo-unify
  chip's fill/text moved off a hand-picked `#0d9488`/`#ecfeff` pair onto
  `graph.badge.unified`/`unifiedText` (`#14b8a6` / `#04121f`), which happens to
  improve text contrast from ≈3.6:1 to ≈7.6:1 against the fill; and the sole-shareholder
  outlined chips moved off ad hoc `#5eead4` (active) / `#9e9e9e`–`#616161` (previous)
  onto `graph.link.ownership` (amber) and `graph.link.ownershipPrevious` (slate) so the
  toggle chips match the ownership edges they control. User-approved, not a regression.
- **`success`/`warning`/`error`/`info` still come from MUI's own defaults**, not from
  `palette.js` — nothing in `createAppTheme.js` overrides them. This is the root cause
  of the `.light`-shade contrast defect that `accent.*` was added to fix (see Token
  shape), and is worth knowing before reaching for `color="success"` etc. in new
  `/app` UI: it inherits MUI's stock light/dark values, unaudited by `palette.test.js`.
- **The currency-confirmation "stale" state stays neutral (`text.secondary`), not
  red.** Old is not the same as wrong, so a stale confirmation is not styled as an
  error. `CurrencyConfirmationCard.jsx` and its server-rendered twin,
  `functions/empresa/_lib.js`'s `.cc-stale` rule, both render it neutral. User-decided
  (final review, finding 4); `text.secondary` was chosen there over `text.disabled`
  because brute-force compositing showed `text.disabled`'s alpha cannot reach 3:1
  against any neutral surface in light mode (max ≈2.68:1).
- **`graph.chip.outline` is `#ffffff` in dark but `#1e293b` in light.** It is the
  punch-out ring around the deputy chip badge, which sits partly over `nodeFill` and
  partly over bare canvas — a fixed white ring, correct against the `#0d1220` dark
  canvas, is effectively invisible against the `#f8fafc` light canvas, so light mode
  reuses `graph.marker.noteOutline`'s already-solved dark-ink-outline value instead.

## Known limitations

- The light palette is contrast-verified but not colourblind-verified. The
  amber/green/red link distinctions may need a second pass.
- `node.searchOrigin` (3.58) and `link.pathHighlight` (3.52) pass with the least
  headroom and are the first candidates to revisit if they read weakly on screen.
