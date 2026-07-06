# IBEX 35 market data on Android — context-menu dialog design spec

## Context

The IBEX 35 market-data sidebar (`docs/superpowers/specs/2026-07-05-ibex35-market-sidebar-design.md`)
auto-shows a fixed, right-anchored sidebar whenever the graph's focused
company is one of the IBEX 35. This works well on web, but has two problems
specific to the Android app (a Capacitor WebView wrapper around the same
React bundle):

1. **Infinite-loading bug** (already fixed separately, commit `cf3a100`): a
   malformed shareholder `reportDate` used to throw mid-render, leaving the
   sidebar stuck on its spinner forever. On a narrow Android viewport this
   read as the whole screen being taken over by a broken loading state,
   much more jarring than on web where the 320px sidebar is a minor corner
   of a wide screen.
2. **Auto-popup UX**: even with the loading bug fixed, automatically
   covering most of a phone screen with a sidebar the instant an IBEX
   company is focused is unwelcome on Android — worse when the company
   turns out to have no market data available, since the user sees an
   auto-triggered near-empty screen for no payoff.

This spec covers an Android-only alternate path: instead of auto-showing,
silently prefetch market data for every IBEX 35 company node present in the
graph, and only offer access to it — via a new item in the existing node
context menu — when data is confirmed available for that specific node.

**Web is entirely unaffected by this spec.** `Ibex35MarketSidebar` continues
to auto-show for the focused company exactly as it does today.

## Architecture

**Android detection:** `isAndroidNativeApp()` from
`src/services/playBillingService.js` (`Capacitor.isNativePlatform() &&
Capacitor.getPlatform() === 'android'`) — already used elsewhere in this
codebase (`DDCheckoutDialog.jsx`, `PricingPage.jsx`, `OrderStatusPage.jsx`)
to branch Android-specific behavior.

**Background prefetch, not per-focus fetch:** because the entry point is now
a context-menu item on *any* right-clicked/long-pressed company node (not
just the single "focused"/searched company), the app needs to know in
advance whether data exists for every IBEX node currently loaded in the
graph — a menu can't stay open awaiting an async check. So, gated by
`isAndroidNativeApp()`, a new effect scans `graphData.nodes` whenever it
changes, matches each `spanish-company-group` node against the IBEX SEED,
and prefetches (and caches, keyed by NIF) any newly-discovered match's data.
This is bounded and cheap: at most 35 possible matches exist, and
`ibex35DashboardClient.js`'s existing 5-minute list-level cache means
looking up many NIFs costs at most one shared network call.

**Context-menu integration:** the existing right-click/long-press menu
already has a company-only conditional item ("Ver apoderados" /
`text.showApoderados`, `SpanishCompanyNetworkGraph.jsx:7987-7999`). A new
"Datos de mercado" item follows the identical pattern
(`{contextNode && contextNode.type === 'spanish-company-group' && (...)}`),
with an additional condition: only render when `isAndroidNativeApp()`,
`matchIbexSeed(contextNode.name)` matches, and the prefetch cache holds a
non-null result for that NIF. Tapping it opens `Ibex35MarketDialog` with the
already-resolved `seedEntry` and `apiRow` — no fetch of its own, no loading
state, since the menu item's existence already proves the data is ready.

**Shared presentational content:** the price/stats/shareholders JSX
currently inline in `Ibex35MarketSidebar` moves into a new
`Ibex35MarketCardBody` component (viewModel + strings in, JSX out, no
wrapper chrome). Both `Ibex35MarketSidebar` (wraps it in its fixed `Paper`)
and the new `Ibex35MarketDialog` (wraps it in a MUI `Dialog`) consume it,
avoiding ~50 lines of duplicated stat-row/shareholder JSX. The `STRINGS`
i18n object moves alongside it as an exported `IBEX_STRINGS`, gaining a
`close` string for the dialog's close button.

## File structure

- **New** `src/components/Ibex35MarketCardBody.jsx` — pure presentational
  component (`{ viewModel, t }` in, JSX out) plus exported `IBEX_STRINGS`.
- **New** `src/components/Ibex35MarketDialog.jsx` — `Dialog` (`maxWidth="sm"
  fullWidth`, matching the existing convention used by
  `OfficerTimelineDialog.jsx` and the edit-node dialog elsewhere in
  `SpanishCompanyNetworkGraph.jsx`) with a close (X) icon button in the
  title, wrapping `Ibex35MarketCardBody`. Props: `open`, `onClose`,
  `seedEntry`, `apiRow`, `lang`. Builds the view model synchronously via
  `buildIbexCardViewModel` — no internal fetch/loading state.
- **Modify** `src/components/Ibex35MarketSidebar.jsx` — imports
  `Ibex35MarketCardBody`/`IBEX_STRINGS` instead of defining its own; keeps
  its own loading/unavailable states wrapping the shared body (unchanged
  web behavior, including the "market data unavailable" fallback already
  shipped).
- **Modify** `src/utils/ibex35Match.js` — add
  `matchAllIbexNodes(nodes)`: given the graph's node array, returns the
  IBEX SEED matches among `spanish-company-group` nodes, deduplicated by
  NIF. Pure and unit-testable in isolation from the async
  fetch/cache orchestration around it.
- **Modify** `src/components/SpanishCompanyNetworkGraph.jsx`:
  - New state: `androidIbexDataCache` (`{ [nif]: apiRow | null }`) and
    `ibexMarketDialog` (`{ open, seedEntry, apiRow }`).
  - New effect (deps: `[graphData.nodes]`, no-op unless
    `isAndroidNativeApp()`): calls `matchAllIbexNodes`, and for any NIF not
    yet tracked (deduped across repeated effect runs via a `useRef` `Set`,
    since the graph grows incrementally as nodes are added), calls
    `getIbexCompanyData(nif)` and stores the result in
    `androidIbexDataCache`.
  - New context-menu `MenuItem`, conditioned as described above, opening
    `ibexMarketDialog`.
  - Renders `<Ibex35MarketDialog open={ibexMarketDialog.open}
    onClose={...} seedEntry={...} apiRow={...} lang={uiLanguage} />`.

## Error handling

Because the menu item only renders once data is confirmed present in the
cache, `Ibex35MarketDialog` never needs a loading or unavailable state of
its own — those concerns stay in `Ibex35MarketSidebar` (web) and in the
prefetch effect (which simply never populates a cache entry, and thus never
shows the menu item, for a company whose fetch failed or returned no
match). The prefetch effect's `getIbexCompanyData` call already never
throws (existing contract from the original spec); failures resolve to
`null`, which the menu-item condition already excludes.

## Testing

`matchAllIbexNodes` gets unit tests in `ibex35Match.test.js`: dedup by NIF
across nodes sharing the same company, ignores non-`spanish-company-group`
nodes and nodes without a `name`, returns an empty array for empty/absent
input. Everything else in this spec — the prefetch effect's async
orchestration, the context-menu condition, and the two new components'
rendering — follows the same "no component-rendering test infra, verified
manually" convention already established and approved for this feature
(`docs/superpowers/specs/2026-07-05-ibex35-market-sidebar-design.md`'s
Testing section), since it is thin composition around already-tested pure
logic.
