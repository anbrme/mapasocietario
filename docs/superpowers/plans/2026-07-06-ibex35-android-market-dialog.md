# IBEX 35 Android Market Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Android app only, replace the auto-shown IBEX market-data sidebar with a silent background prefetch + a context-menu entry point + a `Dialog`, so nothing ever auto-covers most of the screen or appears before data is confirmed available. Web is untouched.

**Architecture:** A pure `matchAllIbexNodes` helper identifies every IBEX 35 company node currently loaded in the graph; an Android-only effect prefetches and caches (by NIF) each one's data; the existing node context menu gains a conditional "Datos de mercado" item that only renders once the cache confirms data for that specific node; tapping it opens a new `Ibex35MarketDialog` with the already-resolved data. The price/stats/shareholders JSX is extracted into a shared `Ibex35MarketCardBody` consumed by both the existing sidebar (web) and the new dialog (Android).

**Tech Stack:** React, MUI, Vitest, Capacitor (`isAndroidNativeApp()`, already used elsewhere) — no new dependencies.

## Global Constraints

- Web behavior is completely unchanged: `Ibex35MarketSidebar` keeps auto-showing for the focused company exactly as it does today, including its loading spinner and "market data unavailable" fallback.
- All new Android-specific behavior is gated by `isAndroidNativeApp()` from `src/services/playBillingService.js` — no-op (and zero extra network calls) when false.
- The prefetch effect scans **every** `spanish-company-group` node in `graphData.nodes` (not just the focused one), matches each against the IBEX SEED via `matchIbexSeed`, and fetches any newly-discovered match's data via the existing `getIbexCompanyData(nif)` — deduplicated by NIF so a given company is never fetched twice.
- The "Datos de mercado" context-menu item follows the exact conditional pattern already used for "Ver apoderados" (`{contextNode && contextNode.type === 'spanish-company-group' && ...}`), with the added condition that the prefetch cache holds a **non-null** result for that node's NIF.
- `Ibex35MarketDialog` never fetches or shows a loading/unavailable state of its own — it only ever opens with already-resolved `seedEntry` + `apiRow`, since the menu item's existence already proves the data is ready.
- The shared `Ibex35MarketCardBody` component takes `{ viewModel, t }` and renders only the inner content (price header, change chip, stat rows, shareholders list) — no `Paper`/`Dialog` wrapper, no loading/unavailable state.
- No new test dependencies (still no `@testing-library/react`/jsdom). `matchAllIbexNodes` is pure and gets unit tests; the two new/changed components and the prefetch effect follow the existing "no component-rendering test infra, verified manually" convention from the original spec.

---

## Task 1: `matchAllIbexNodes` — find every IBEX 35 match among graph nodes

**Files:**
- Modify: `src/utils/ibex35Match.js` (append)
- Modify: `src/utils/ibex35Match.test.js` (append)

**Interfaces:**
- Consumes: `matchIbexSeed` (already defined in the same file).
- Produces: `matchAllIbexNodes(nodes: Array<{type, name}> | null | undefined): SEEDEntry[]` — a deduplicated (by NIF) array of IBEX SEED entries matched among `spanish-company-group` nodes. Task 5's prefetch effect imports this from `../utils/ibex35Match`.

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/ibex35Match.test.js`:

```js
import { matchAllIbexNodes } from './ibex35Match';

describe('matchAllIbexNodes', () => {
  it('returns an empty array for empty, null, or undefined input', () => {
    expect(matchAllIbexNodes([])).toEqual([]);
    expect(matchAllIbexNodes(null)).toEqual([]);
    expect(matchAllIbexNodes(undefined)).toEqual([]);
  });

  it('ignores non-company nodes and nodes without a name', () => {
    const nodes = [
      { type: 'officer', name: 'REPSOL SA' },
      { type: 'spanish-company-group', name: '' },
      { type: 'spanish-company-group' },
    ];
    expect(matchAllIbexNodes(nodes)).toEqual([]);
  });

  it('matches IBEX company nodes and ignores non-IBEX company nodes', () => {
    const nodes = [
      { type: 'spanish-company-group', name: 'REPSOL SA' },
      { type: 'spanish-company-group', name: 'ACME SL' },
    ];
    const matches = matchAllIbexNodes(nodes);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Repsol');
  });

  it('deduplicates multiple nodes matching the same IBEX company by NIF', () => {
    const nodes = [
      { type: 'spanish-company-group', name: 'REPSOL SA' },
      { type: 'spanish-company-group', name: 'REPSOL SA' },
      { type: 'spanish-company-group', name: 'BANCO SANTANDER, S.A.' },
    ];
    const matches = matchAllIbexNodes(nodes);
    expect(matches).toHaveLength(2);
    expect(matches.map(m => m.name).sort()).toEqual(['Banco Santander', 'Repsol']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/ibex35Match.test.js`
Expected: FAIL — `matchAllIbexNodes is not a function` (not exported yet).

- [ ] **Step 3: Write the minimal implementation**

Append to `src/utils/ibex35Match.js`:

```js
// Matches every spanish-company-group node against the IBEX 35 SEED,
// deduplicated by NIF. Used by the Android prefetch effect in
// SpanishCompanyNetworkGraph.jsx to discover which currently-loaded nodes
// are worth fetching market data for.
export function matchAllIbexNodes(nodes) {
  const seen = new Set();
  const matches = [];
  (Array.isArray(nodes) ? nodes : []).forEach(n => {
    if (!n || n.type !== 'spanish-company-group' || !n.name) return;
    const match = matchIbexSeed(n.name);
    if (match && !seen.has(match.nif)) {
      seen.add(match.nif);
      matches.push(match);
    }
  });
  return matches;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/ibex35Match.test.js`
Expected: PASS (13 tests: 9 existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add src/utils/ibex35Match.js src/utils/ibex35Match.test.js
git commit -m "feat: add matchAllIbexNodes to find every IBEX 35 match in the graph"
```

---

## Task 2: `Ibex35MarketCardBody` — shared presentational content

**Files:**
- Create: `src/components/Ibex35MarketCardBody.jsx`

**Interfaces:**
- Consumes: a `ViewModel` (the object returned by `buildIbexCardViewModel` in `src/utils/ibex35Match.js` — `{ name, priceLabel, changeLabel, changePositive, marketCapLabel, volumeLabel, peRatioLabel, epsLabel, high52Label, low52Label, dividendYieldLabel, shareholders: [{ name, percentageLabel, asOfLabel }] }`), and a strings object `t` (one language's entry from the `IBEX_STRINGS` object this task also defines).
- Produces: default export `Ibex35MarketCardBody({ viewModel, t })` — pure presentational component, and named export `IBEX_STRINGS` (`{ es: {...}, en: {...} }`, including a `close` key for the dialog's close button). Task 3 (`Ibex35MarketSidebar.jsx`) and Task 4 (`Ibex35MarketDialog.jsx`) both import `Ibex35MarketCardBody` (default) and `IBEX_STRINGS` (named) from `./Ibex35MarketCardBody`.

No automated test for this file, per the Global Constraints (no component-rendering test infra in this app) — verified visually in Task 5's manual verification step, since it's exercised by both the sidebar (unchanged web flow, already manually verified in the original feature) and the new dialog.

- [ ] **Step 1: Write the component**

Create `src/components/Ibex35MarketCardBody.jsx`:

```jsx
import React from 'react';
import { Box, Typography, Chip, Divider } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

export const IBEX_STRINGS = {
  es: {
    title: 'Datos de mercado',
    marketCap: 'Capitalización',
    volume: 'Volumen',
    peRatio: 'PER',
    eps: 'BPA',
    high52: 'Máx. 52 sem.',
    low52: 'Mín. 52 sem.',
    dividendYield: 'Rentabilidad por dividendo',
    shareholders: 'Accionistas significativos',
    asOf: fecha => `a fecha de ${fecha}`,
    loading: 'Cargando datos de mercado…',
    unavailable: 'Datos de mercado no disponibles (temporalmente).',
    close: 'Cerrar',
  },
  en: {
    title: 'Market data',
    marketCap: 'Market cap',
    volume: 'Volume',
    peRatio: 'P/E ratio',
    eps: 'EPS',
    high52: '52w high',
    low52: '52w low',
    dividendYield: 'Dividend yield',
    shareholders: 'Significant shareholders',
    asOf: date => `as of ${date}`,
    loading: 'Loading market data…',
    unavailable: 'Market data unavailable (temporarily).',
    close: 'Close',
  },
};

// Pure presentational content shared by Ibex35MarketSidebar (web, wraps
// this in its fixed Paper) and Ibex35MarketDialog (Android, wraps this in
// a MUI Dialog) — price/change header, market-data stat rows, and the
// significant-shareholders list. No wrapper chrome, no loading/unavailable
// state — callers own those.
const Ibex35MarketCardBody = ({ viewModel, t }) => {
  const rows = [
    [t.marketCap, viewModel.marketCapLabel],
    [t.volume, viewModel.volumeLabel],
    [t.peRatio, viewModel.peRatioLabel],
    [t.eps, viewModel.epsLabel],
    [t.high52, viewModel.high52Label],
    [t.low52, viewModel.low52Label],
    [t.dividendYield, viewModel.dividendYieldLabel],
  ].filter(([, value]) => value != null);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="h5">{viewModel.priceLabel}</Typography>
        {viewModel.changeLabel && (
          <Chip
            size="small"
            icon={viewModel.changePositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
            label={viewModel.changeLabel}
            color={viewModel.changePositive ? 'success' : 'error'}
            variant="outlined"
          />
        )}
      </Box>

      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2">{value}</Typography>
        </Box>
      ))}

      {viewModel.shareholders.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t.shareholders}
          </Typography>
          {viewModel.shareholders.map(s => (
            <Box key={s.name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Box>
                <Typography variant="body2">{s.name}</Typography>
                {s.asOfLabel && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {t.asOf(s.asOfLabel)}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {s.percentageLabel}
              </Typography>
            </Box>
          ))}
        </>
      )}
    </>
  );
};

export default Ibex35MarketCardBody;
```

- [ ] **Step 2: Verify the file builds**

Run: `npx esbuild src/components/Ibex35MarketCardBody.jsx --bundle=false --outfile=/dev/null`
Expected: no errors printed (esbuild reports the output size and "Done").

- [ ] **Step 3: Commit**

```bash
git add src/components/Ibex35MarketCardBody.jsx
git commit -m "feat: extract Ibex35MarketCardBody shared presentational component"
```

---

## Task 3: Refactor `Ibex35MarketSidebar` to consume the shared body

**Files:**
- Modify: `src/components/Ibex35MarketSidebar.jsx` (full rewrite — same behavior, less code)

**Interfaces:**
- Consumes: `Ibex35MarketCardBody` (default) and `IBEX_STRINGS` (named) from `./Ibex35MarketCardBody` (Task 2).
- Produces: unchanged public interface — default export `Ibex35MarketSidebar({ open, seedEntry, lang })`. No consumer of this component changes.

No automated test — this is a pure refactor of an already-manually-verified component; behavior must be identical to before.

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `src/components/Ibex35MarketSidebar.jsx` with:

```jsx
import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Divider } from '@mui/material';
import { getIbexCompanyData } from '../services/ibex35DashboardClient';
import { buildIbexCardViewModel } from '../utils/ibex35Match';
import Ibex35MarketCardBody, { IBEX_STRINGS } from './Ibex35MarketCardBody';

// Non-modal, right-anchored, fixed sidebar mirroring ApoderadosSidebar.jsx's
// positioning. Fully automatic: shown/hidden entirely by the `open`/`seedEntry`
// props (no close button, no manual dismiss) — the caller (the graph
// component) owns visibility, keyed to the focused node and precedence
// against ApoderadosSidebar. Web only — see Ibex35MarketDialog for the
// Android context-menu-triggered equivalent.
const Ibex35MarketSidebar = ({ open, seedEntry, lang = 'es' }) => {
  const t = IBEX_STRINGS[lang === 'en' ? 'en' : 'es'];
  const [loading, setLoading] = useState(false);
  const [viewModel, setViewModel] = useState(null);

  useEffect(() => {
    if (!open || !seedEntry) {
      setViewModel(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setViewModel(null);
    (async () => {
      // Any failure here (network error, malformed upstream data, an
      // unexpected throw while building the view model) must still resolve
      // `loading` — otherwise the sidebar hangs on the spinner forever
      // instead of falling back to the "unavailable" message below.
      try {
        const apiRow = await getIbexCompanyData(seedEntry.nif);
        if (cancelled) return;
        setViewModel(buildIbexCardViewModel(seedEntry, apiRow, lang));
      } catch (err) {
        if (!cancelled) {
          console.warn('[Ibex35MarketSidebar] failed to build market data view:', err.message);
          setViewModel(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, seedEntry, lang]);

  if (!open || !seedEntry) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        maxWidth: '100vw',
        zIndex: theme => theme.zIndex.drawer + 1,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid',
        borderColor: 'divider',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
      }}
    >
      <Box sx={{ p: 2, pb: 1.5 }}>
        <Typography variant="h6">{t.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {seedEntry.name}
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, py: 6 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              {t.loading}
            </Typography>
          </Box>
        ) : !viewModel ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t.unavailable}
            </Typography>
          </Box>
        ) : (
          <Ibex35MarketCardBody viewModel={viewModel} t={t} />
        )}
      </Box>
    </Paper>
  );
};

export default Ibex35MarketSidebar;
```

- [ ] **Step 2: Verify the file builds and the full suite still passes**

Run: `npx esbuild src/components/Ibex35MarketSidebar.jsx --bundle=false --outfile=/dev/null`
Expected: no errors printed.

Run: `npm test`
Expected: PASS — same test count as before this task (this file has no direct tests; nothing else should regress).

- [ ] **Step 3: Commit**

```bash
git add src/components/Ibex35MarketSidebar.jsx
git commit -m "refactor: Ibex35MarketSidebar consumes shared Ibex35MarketCardBody"
```

---

## Task 4: `Ibex35MarketDialog` — Android entry point

**Files:**
- Create: `src/components/Ibex35MarketDialog.jsx`

**Interfaces:**
- Consumes: `buildIbexCardViewModel` from `../utils/ibex35Match` (existing); `Ibex35MarketCardBody`/`IBEX_STRINGS` from `./Ibex35MarketCardBody` (Task 2).
- Produces: default export `Ibex35MarketDialog({ open, onClose, seedEntry, apiRow, lang })` — a React component. Task 5 renders `<Ibex35MarketDialog open={...} onClose={...} seedEntry={...} apiRow={...} lang={uiLanguage} />` inside `SpanishCompanyNetworkGraph.jsx`.

No automated test — verified manually in Task 5.

- [ ] **Step 1: Write the component**

Create `src/components/Ibex35MarketDialog.jsx`:

```jsx
import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { buildIbexCardViewModel } from '../utils/ibex35Match';
import Ibex35MarketCardBody, { IBEX_STRINGS } from './Ibex35MarketCardBody';

// Android entry point for IBEX 35 market data: opened from the node
// context menu only once a background prefetch (in
// SpanishCompanyNetworkGraph.jsx) has already confirmed data exists for
// this company. Unlike Ibex35MarketSidebar, this never fetches and never
// shows a loading or unavailable state — it only ever opens with
// already-resolved data.
const Ibex35MarketDialog = ({ open, onClose, seedEntry, apiRow, lang = 'es' }) => {
  const t = IBEX_STRINGS[lang === 'en' ? 'en' : 'es'];
  if (!seedEntry || !apiRow) return null;
  const viewModel = buildIbexCardViewModel(seedEntry, apiRow, lang);
  if (!viewModel) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" component="div">
            {t.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {seedEntry.name}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label={t.close}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Ibex35MarketCardBody viewModel={viewModel} t={t} />
      </DialogContent>
    </Dialog>
  );
};

export default Ibex35MarketDialog;
```

- [ ] **Step 2: Verify the file builds**

Run: `npx esbuild src/components/Ibex35MarketDialog.jsx --bundle=false --outfile=/dev/null`
Expected: no errors printed.

- [ ] **Step 3: Commit**

```bash
git add src/components/Ibex35MarketDialog.jsx
git commit -m "feat: add Ibex35MarketDialog Android entry point"
```

---

## Task 5: Wire the Android prefetch + context-menu item + dialog into the graph

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` (imports; new state; new effect; new context-menu item; new dialog render)

**Interfaces:**
- Consumes: `matchIbexSeed`, `matchAllIbexNodes` from `../utils/ibex35Match`; `getIbexCompanyData` from `../services/ibex35DashboardClient`; `isAndroidNativeApp` from `../services/playBillingService`; `Ibex35MarketDialog` (Task 4) from `./Ibex35MarketDialog`; the existing `contextNode`, `closeNodeContextMenu`, `graphData.nodes`, `uiLanguage`, `text` (STRINGS), and `focusedIbexSeed` already defined in this file.
- Produces: nothing new for other files — this is the integration point.

- [ ] **Step 1: Add the imports**

Find (around line 76):

```js
import PersonIcon from '@mui/icons-material/Person';
```

Add immediately after it:

```js
import PersonIcon from '@mui/icons-material/Person';
import ShowChartIcon from '@mui/icons-material/ShowChart';
```

Find (around line 84):

```js
import Ibex35MarketSidebar from './Ibex35MarketSidebar';
```

Add immediately after it:

```js
import Ibex35MarketSidebar from './Ibex35MarketSidebar';
import Ibex35MarketDialog from './Ibex35MarketDialog';
```

Find (around line 119):

```js
import { matchIbexSeed } from '../utils/ibex35Match';
```

Replace with:

```js
import { matchIbexSeed, matchAllIbexNodes } from '../utils/ibex35Match';
import { getIbexCompanyData } from '../services/ibex35DashboardClient';
import { isAndroidNativeApp } from '../services/playBillingService';
```

- [ ] **Step 2: Add the "Market data" i18n strings**

Find the English strings block (around line 195):

```js
    showApoderados: 'Show apoderados',
```

Add immediately after it:

```js
    showApoderados: 'Show apoderados',
    marketData: 'Market data',
```

Find the Spanish strings block (around line 443):

```js
    showApoderados: 'Ver apoderados',
```

Add immediately after it:

```js
    showApoderados: 'Ver apoderados',
    marketData: 'Datos de mercado',
```

- [ ] **Step 3: Add the Android prefetch state and effect**

Find the `focusedIbexSeed` computed block (around line 4051-4057):

```js
  // The focused company's IBEX 35 SEED entry, or null. Recomputed on every
  // render (cheap: a map lookup against the ~35-entry SEED) whenever the
  // focused company changes.
  const focusedIbexSeed = (() => {
    const focused = resolveFocusedCompany();
    return focused ? matchIbexSeed(focused.name) : null;
  })();
```

Add immediately after it:

```js
  // Android-only: NIF -> apiRow|null cache for every IBEX 35 company node
  // currently loaded in the graph, populated by the background prefetch
  // effect below. Lets the node context menu decide, per right-clicked
  // node, whether "Datos de mercado" has real data to show, without
  // blocking the menu on an async check. No-op (and no extra network
  // calls) on web.
  const [androidIbexDataCache, setAndroidIbexDataCache] = useState({});
  const androidIbexCheckedRef = useRef(new Set());
  const [ibexMarketDialog, setIbexMarketDialog] = useState({
    open: false,
    seedEntry: null,
    apiRow: null,
  });

  useEffect(() => {
    if (!isAndroidNativeApp()) return undefined;
    const matches = matchAllIbexNodes(graphData.nodes);
    const toFetch = matches.filter(m => !androidIbexCheckedRef.current.has(m.nif));
    if (toFetch.length === 0) return undefined;
    toFetch.forEach(m => androidIbexCheckedRef.current.add(m.nif));
    let cancelled = false;
    toFetch.forEach(seedEntry => {
      getIbexCompanyData(seedEntry.nif).then(apiRow => {
        if (!cancelled) {
          setAndroidIbexDataCache(prev => ({ ...prev, [seedEntry.nif]: apiRow }));
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [graphData.nodes]);
```

- [ ] **Step 4: Add the "Datos de mercado" context-menu item**

Find the "Ver apoderados" `MenuItem` block (around line 7987-7999):

```jsx
          {contextNode && contextNode.type === 'spanish-company-group' && (
            <MenuItem
              onClick={() => {
                const n = contextNode;
                closeNodeContextMenu();
                if (n) setApoderadosSidebar({ open: true, company: { name: n.name, groupKey: n.groupKey || null } });
              }}
            >
              <ListItemIcon>
                <PersonIcon fontSize="small" color="action" />
              </ListItemIcon>
              <ListItemText>{text.showApoderados}</ListItemText>
            </MenuItem>
          )}
```

Add immediately after it (before the `hideNodeFromMenu` `MenuItem`):

```jsx
          {contextNode && contextNode.type === 'spanish-company-group' && isAndroidNativeApp() && (() => {
            const ibexSeed = matchIbexSeed(contextNode.name);
            const ibexData = ibexSeed ? androidIbexDataCache[ibexSeed.nif] : null;
            if (!ibexSeed || !ibexData) return null;
            return (
              <MenuItem
                onClick={() => {
                  closeNodeContextMenu();
                  setIbexMarketDialog({ open: true, seedEntry: ibexSeed, apiRow: ibexData });
                }}
              >
                <ListItemIcon>
                  <ShowChartIcon fontSize="small" color="action" />
                </ListItemIcon>
                <ListItemText>{text.marketData}</ListItemText>
              </MenuItem>
            );
          })()}
```

- [ ] **Step 5: Render `Ibex35MarketDialog`**

Find the `<Ibex35MarketSidebar ... />` render (around line 8057-8061):

```jsx
        <Ibex35MarketSidebar
          open={Boolean(focusedIbexSeed) && !apoderadosSidebar.open}
          seedEntry={focusedIbexSeed}
          lang={uiLanguage}
        />
```

Add immediately after it:

```jsx
        <Ibex35MarketDialog
          open={ibexMarketDialog.open}
          onClose={() => setIbexMarketDialog({ open: false, seedEntry: null, apiRow: null })}
          seedEntry={ibexMarketDialog.seedEntry}
          apiRow={ibexMarketDialog.apiRow}
          lang={uiLanguage}
        />
```

- [ ] **Step 6: Verify the file builds**

Run: `npx esbuild src/components/SpanishCompanyNetworkGraph.jsx --bundle=false --outfile=/dev/null`
Expected: no errors printed.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus Task 1's 4 new tests pass, nothing broken.

- [ ] **Step 8: Manual verification**

This environment has no Android emulator/device, so device-level testing isn't possible here. Verify what's feasible:

1. In a running `npm run dev` session (browser), open the DevTools console and confirm `matchAllIbexNodes` behaves correctly against live data:
   ```js
   const { matchAllIbexNodes } = await import('/src/utils/ibex35Match.js');
   matchAllIbexNodes([
     { type: 'spanish-company-group', name: 'REPSOL SA' },
     { type: 'spanish-company-group', name: 'ACME SL' },
   ]);
   // Expect: one match, name "Repsol"
   ```
2. Confirm `isAndroidNativeApp()` returns `false` in this browser session (`Capacitor.isNativePlatform()` is `false` outside the native shell) — this means the new prefetch effect and context-menu item are inert in the browser by design, so web behavior (the auto-shown sidebar, verified when the original feature shipped) is unaffected. Confirm by right-clicking an IBEX company node in the browser and checking the "Datos de mercado" item does **not** appear (only "Ver apoderados" etc. — the web path).
3. Flag to the user that the Android-specific path (prefetch effect running, context-menu item appearing, dialog opening) needs verification on an actual Android build/emulator, which is outside this session's reach — recommend a quick manual pass on-device before considering this feature complete.

- [ ] **Step 9: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat: add Android IBEX market-data context-menu entry point"
```

---

## Self-Review Notes

- **Spec coverage:** Android detection/scope (web untouched) → Task 5 (all new code gated by `isAndroidNativeApp()`, existing sidebar untouched). Background prefetch across all IBEX nodes → Task 1 (`matchAllIbexNodes`) + Task 5 (effect + cache). Context-menu integration → Task 5 Step 4. Dialog with no loading/unavailable state → Task 4. Shared presentational content → Task 2 + Tasks 3/4 consuming it. Testing approach → Task 1 has full unit tests; Tasks 2-5 follow the established no-component-test convention, with Task 5 including the feasible subset of manual verification given this environment has no Android device/emulator.
- **Placeholder scan:** none found — every step has complete, runnable code.
- **Type/name consistency:** `matchAllIbexNodes`, `Ibex35MarketCardBody`, `IBEX_STRINGS`, `Ibex35MarketDialog`, `androidIbexDataCache`, `ibexMarketDialog` are spelled identically everywhere they're defined and consumed across tasks.
