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
| `ThemeModeProvider.jsx` | Context, localStorage persistence, `useThemeMode()`, `isAppRoute()`, and the `APP_ROUTE` / `STORAGE_KEY` constants |
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

`index.css` drives `html, body, #root` and the scrollbar from three CSS variables —
`--ms-app-bg`, `--ms-app-fg`, `--ms-scrollbar-thumb` — instead of literals.

This is a deliberate, bounded exception to the JS-token design: pre-paint HTML has no
access to the React theme. It covers three variables for raw document chrome only.
Everything else reads from the theme object.

`<meta name="theme-color">` (`index.html:15`, currently `#0a0e1a`) is updated on mode
change so mobile browser chrome matches.

## Token shape

`palette.graph` names the meanings already implicit in the canvas code:

```
graph: {
  surface: { canvas, nodeFill, label, labelHalo, badgeHalo, arrowOutline },
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

### Note flags

`NODE_NOTE_FLAGS` in `src/utils/nodeNotes.js:5` is a frozen module constant mapping
flag name → hex, read in seven places in the graph component. Its colours move to
`palette.graph.noteFlag`; `nodeNotes.js` keeps the flag **names** (as
`NODE_NOTE_FLAG_KEYS`) for validation.

This is safe for existing user data: `normalizeNodeNote` (`nodeNotes.js:52`)
persists the flag *name*, never the hex, so remapping colours per mode cannot
invalidate a saved note.

## Light palette

Contrast ratios are computed against each mode's own canvas (`#0a0e1a` dark,
`#f8fafc` light) and all clear the WCAG 1.4.11 3:1 non-text contrast floor.

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
| `surface.canvas` | `#0a0e1a` | `#f8fafc` |
| `surface.nodeFill` | `#0d1220` | `#ffffff` |
| `surface.label` | `#e0e0e0` | `#1e293b` |
| `surface.labelHalo` | `rgba(0,0,0,0.7)` | `rgba(255,255,255,0.85)` |
| `surface.badgeHalo` | `rgba(4,18,31,0.9)` | `rgba(255,255,255,0.9)` |
| `surface.arrowOutline` | `#0d1220` | `#ffffff` |
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
`nodeColors` memo (`:1681`) is replaced by `graph.node`, and `PATH_HIGHLIGHT_COLOR`
(`:1700`) by `graph.link.pathHighlight`. The ~40 canvas literals in
`nodeCanvasObject` (`:6391`) and `linkCanvasObject` (`:6653`) become token reads —
including the label halo (`:6572`, `:6590`), badge halo (`:6539`), chip outline
(`:6496`), investigation ring (`:6603`), merged ring (`:6617`), note marker
(`:6637`, `:6643`) and arrow outline (`:6778`).

The seven `NODE_NOTE_FLAGS` reads (`:143`, `:4945`, `:6629`, `:9339`, `:9444`,
`:9737`, `:9831`) move to `graph.noteFlag`, with the import narrowed to
`NODE_NOTE_FLAG_KEYS` for the validation call at `:4945`.

Adding `graph` to both callbacks' dependency arrays changes the callback identity on
mode change, which is what triggers react-force-graph to repaint. No imperative
redraw is required.

The remaining ~90 literals in that file are JSX chrome (toolbar, legend, panels) and
become MUI tokens or `graph.*` reads.

## Toggle

A sun/moon `IconButton` in the `/app` breadcrumb bar, next to the existing menu
button (`App.jsx:219`). That bar is already fully token-based
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

`ThemeModeProvider.test.jsx`:
- Defaults to dark when storage is empty.
- Persists a selected mode and restores it.
- Ignores a corrupt or unrecognised stored value, falling back to dark.
- Forces dark on non-`/app` routes regardless of stored mode.

`indexHtmlThemeScript.test.js`:
- `index.html` contains the inline script, and that script references the current
  `APP_ROUTE` and `STORAGE_KEY` values exported from `ThemeModeProvider.jsx`,
  pinning the unavoidable duplication described above.

## Known limitations

- The light palette is contrast-verified but not colourblind-verified. The
  amber/green/red link distinctions may need a second pass.
- `node.searchOrigin` (3.58) and `link.pathHighlight` (3.52) pass with the least
  headroom and are the first candidates to revisit if they read weakly on screen.
