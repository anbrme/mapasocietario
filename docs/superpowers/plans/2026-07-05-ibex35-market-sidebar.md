# IBEX 35 Market Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the graph's focused company is one of the IBEX 35, show a right-anchored sidebar with live price/market data and CNMV-sourced significant shareholders — no new backend.

**Architecture:** A pure matching utility identifies IBEX 35 companies against the existing curated `SEED` list by NIF; a small client fetches and caches the public `ibex35-api.ncdata.eu` companies list and looks up a row by NIF; a new sidebar component (modeled on the existing `ApoderadosSidebar.jsx`) does its own fetch-on-focus and renders the result; the main graph component wires focus-resolution + precedence against the existing Apoderados sidebar.

**Tech Stack:** React, MUI, Vitest (existing stack — no new dependencies).

## Global Constraints

- "Is this company IBEX 35?" is determined ONLY from the existing curated `SEED` / `V3_TO_SLUG` maps in `functions/empresa/_ibex35.js` — no new list, no duplication.
- Live price + shareholder data comes from `GET https://ibex35-api.ncdata.eu/api/companies` with header `Authorization: Bearer ibex35-public-access-2024` — called directly from the browser. No new backend or proxy is introduced.
- The cross-source match key is **NIF**, normalized (strip all non-alphanumeric characters, uppercase) on both sides — NOT ticker (SEED uses `BME:SAN`, the live API uses `SAN.MC`; verified live that NIFs match exactly across both sources for all 35 companies).
- The companies list fetched from the API is cached in module-level memory for 5 minutes to avoid re-fetching on every focus change within a session.
- `reportDate` on each shareholder is an Excel/Sheets serial date number (days since 1899-12-30) — convert via `new Date(Date.UTC(1899, 11, 30) + serial * 86400000)`. Different shareholders of the same company can have different `reportDate` values (verified live) — display per-shareholder, never one date for the whole section.
- Recent-news integration is explicitly OUT OF SCOPE for this plan (deferred; the existing `/api/news*` routes on that worker aren't populated, and the only working news proxy requires an authenticated, billed local-rag user).
- The main app (`package.json`) has no `@testing-library/react`/jsdom — do not add it. Cover component-visible behavior via pure, unit-tested functions (`buildIbexCardViewModel`); verify the component itself by running the app and opening an IBEX 35 company.
- The new sidebar (`Ibex35MarketSidebar.jsx`) is non-modal, fixed, right-anchored, 320px wide, no close button — it shows/hides automatically based on graph focus, never manually dismissed.
- Precedence: `ApoderadosSidebar` (explicit user action) always wins over the IBEX sidebar (automatic) when both would apply to the same moment.

---

## Task 1: `matchIbexSeed` — resolve a company name to its IBEX 35 SEED entry

**Files:**
- Create: `src/utils/ibex35Match.js`
- Test: `src/utils/ibex35Match.test.js`

**Interfaces:**
- Consumes: `SEED`, `V3_TO_SLUG` exported from `functions/empresa/_ibex35.js` (existing; `V3_TO_SLUG` maps each entry's exact uppercase `v3Name` string to its slug key in `SEED`).
- Produces: `matchIbexSeed(companyName: string | null | undefined): SEEDEntry | null` where `SEEDEntry` has at least `{ name, v3Name, nif, isin, ticker, hoja, sector, website }` (the existing `SEED` entry shape). Later tasks import this from `../utils/ibex35Match`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/ibex35Match.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { matchIbexSeed } from './ibex35Match';

describe('matchIbexSeed', () => {
  it('matches a company name regardless of surrounding whitespace and case', () => {
    const match = matchIbexSeed('  repsol sa  ');
    expect(match).not.toBeNull();
    expect(match.nif).toBe('A78374725');
  });

  it('matches the canonical uppercase v3Name directly', () => {
    const match = matchIbexSeed('REPSOL SA');
    expect(match.name).toBe('Repsol');
  });

  it('returns null for a company name that is not in the IBEX 35 seed', () => {
    expect(matchIbexSeed('ACME SL')).toBeNull();
  });

  it('returns null for empty, null, or undefined input', () => {
    expect(matchIbexSeed('')).toBeNull();
    expect(matchIbexSeed(null)).toBeNull();
    expect(matchIbexSeed(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/ibex35Match.test.js`
Expected: FAIL — `Failed to resolve import "./ibex35Match"` (file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/utils/ibex35Match.js`:

```js
import { SEED, V3_TO_SLUG } from '../../functions/empresa/_ibex35.js';

// Resolves a BORME/v3 company name to its IBEX 35 SEED entry, or null if the
// company is not one of the curated IBEX 35 seed entries. V3_TO_SLUG keys are
// the exact, already-uppercase v3Name strings verified against api.ncdata.eu.
export function matchIbexSeed(companyName) {
  if (!companyName) return null;
  const normalized = String(companyName).trim().toUpperCase();
  const slug = V3_TO_SLUG[normalized];
  if (!slug) return null;
  return SEED[slug] || null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/ibex35Match.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/ibex35Match.js src/utils/ibex35Match.test.js
git commit -m "feat: add matchIbexSeed to resolve IBEX 35 companies by name"
```

---

## Task 2: `buildIbexCardViewModel` — shape API data into displayable card fields

**Files:**
- Modify: `src/utils/ibex35Match.js` (append to the file created in Task 1)
- Modify: `src/utils/ibex35Match.test.js` (append to the file created in Task 1)

**Interfaces:**
- Consumes: a `SEEDEntry` (from Task 1, needs `.name`), and an `apiRow` object shaped like one entry of `GET https://ibex35-api.ncdata.eu/api/companies`'s `data` array: `{ ticker, current_price_eur, change_percent, market_cap_eur, volume, pe_ratio, eps, high_52, low_52, dividend_yield, shareholders: [{ name, percentage, reportDate }] }` (verified live shape; `dividend_yield`/`pe_ratio` may be `null`).
- Produces: `buildIbexCardViewModel(seedEntry, apiRow, lang = 'es'): ViewModel | null` where `ViewModel` is:
  ```
  {
    name: string,
    priceLabel: string | null,
    changeLabel: string | null,
    changePositive: boolean,
    marketCapLabel: string | null,
    volumeLabel: string | null,
    peRatioLabel: string | null,
    epsLabel: string | null,
    high52Label: string | null,
    low52Label: string | null,
    dividendYieldLabel: string | null,
    shareholders: Array<{ name: string, percentageLabel: string, asOfLabel: string | null }>,
  }
  ```
  Later tasks (`Ibex35MarketSidebar.jsx`) import this from `../utils/ibex35Match`.

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/ibex35Match.test.js`:

```js
import { buildIbexCardViewModel } from './ibex35Match';

describe('buildIbexCardViewModel', () => {
  const seedEntry = { name: 'Repsol', nif: 'A78374725', ticker: 'BME:REP' };
  const apiRow = {
    ticker: 'REP.MC',
    current_price_eur: 11.5,
    change_percent: -0.42,
    market_cap_eur: 15234567890,
    volume: 3456789,
    pe_ratio: 8.1,
    eps: 1.42,
    high_52: 13.2,
    low_52: 9.8,
    dividend_yield: 6.5,
    shareholders: [
      { name: 'Sacyr', type: 'strategic', percentage: 3.2, shares: 0, reportDate: 45842 },
      { name: 'BlackRock', type: 'institutional', percentage: 5.1, shares: 0, reportDate: 46177 },
    ],
  };

  it('returns null when there is no seed entry or no api row', () => {
    expect(buildIbexCardViewModel(null, apiRow, 'es')).toBeNull();
    expect(buildIbexCardViewModel(seedEntry, null, 'es')).toBeNull();
  });

  it('formats the market snapshot fields', () => {
    const vm = buildIbexCardViewModel(seedEntry, apiRow, 'en');
    expect(vm.name).toBe('Repsol');
    expect(vm.priceLabel).toContain('11.50');
    expect(vm.changeLabel).toBe('-0.42%');
    expect(vm.changePositive).toBe(false);
    expect(vm.dividendYieldLabel).toBe('6.50%');
  });

  it('sorts shareholders by percentage descending and formats their own as-of date', () => {
    const vm = buildIbexCardViewModel(seedEntry, apiRow, 'en');
    expect(vm.shareholders.map(s => s.name)).toEqual(['BlackRock', 'Sacyr']);
    expect(vm.shareholders[0].percentageLabel).toBe('5.10%');
    // reportDate 46177 -> 2026-06-04 (Excel serial date)
    expect(vm.shareholders[0].asOfLabel).toContain('2026');
    // reportDate 45842 -> 2025-07-04 (Excel serial date)
    expect(vm.shareholders[1].asOfLabel).toContain('2025');
  });

  it('omits dividend yield and P/E labels when the API returns null for them', () => {
    const vm = buildIbexCardViewModel(
      seedEntry,
      { ...apiRow, dividend_yield: null, pe_ratio: null },
      'en'
    );
    expect(vm.dividendYieldLabel).toBeNull();
    expect(vm.peRatioLabel).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/ibex35Match.test.js`
Expected: FAIL — `buildIbexCardViewModel is not a function` (not exported yet).

- [ ] **Step 3: Write the minimal implementation**

Append to `src/utils/ibex35Match.js`:

```js
// Excel/Google Sheets serial date (days since 1899-12-30) -> JS Date.
function excelSerialToDate(serial) {
  return new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000);
}

function formatDateForLang(date, lang) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatCurrency(value, lang) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactCurrency(value, lang) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

// API percent-ish fields (change_percent, dividend_yield, shareholder percentage)
// are already expressed as percent units (e.g. 6.5 means 6.5%), not fractions.
function formatPercentValue(value, lang, { showSign = false } = {}) {
  if (value === null || value === undefined) return null;
  const formatted = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: showSign ? 'exceptZero' : 'auto',
  }).format(Number(value));
  return `${formatted}%`;
}

function formatPlainNumber(value, lang) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES').format(value);
}

export function buildIbexCardViewModel(seedEntry, apiRow, lang = 'es') {
  if (!seedEntry || !apiRow) return null;

  const shareholders = (Array.isArray(apiRow.shareholders) ? apiRow.shareholders : [])
    .slice()
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    .map(s => ({
      name: s.name,
      percentageLabel: formatPercentValue(s.percentage, lang),
      asOfLabel: s.reportDate ? formatDateForLang(excelSerialToDate(s.reportDate), lang) : null,
    }));

  return {
    name: seedEntry.name,
    priceLabel: formatCurrency(apiRow.current_price_eur, lang),
    changeLabel: formatPercentValue(apiRow.change_percent, lang, { showSign: true }),
    changePositive: Number(apiRow.change_percent || 0) >= 0,
    marketCapLabel: formatCompactCurrency(apiRow.market_cap_eur, lang),
    volumeLabel: formatPlainNumber(apiRow.volume, lang),
    peRatioLabel: formatPlainNumber(apiRow.pe_ratio, lang),
    epsLabel: formatCurrency(apiRow.eps, lang),
    high52Label: formatCurrency(apiRow.high_52, lang),
    low52Label: formatCurrency(apiRow.low_52, lang),
    dividendYieldLabel: formatPercentValue(apiRow.dividend_yield, lang),
    shareholders,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/ibex35Match.test.js`
Expected: PASS (8 tests total: 4 from Task 1 + 4 from this task)

- [ ] **Step 5: Commit**

```bash
git add src/utils/ibex35Match.js src/utils/ibex35Match.test.js
git commit -m "feat: add buildIbexCardViewModel to format IBEX market/shareholder data"
```

---

## Task 3: `ibex35DashboardClient` — fetch and cache live company data, look up by NIF

**Files:**
- Create: `src/services/ibex35DashboardClient.js`
- Test: `src/services/ibex35DashboardClient.test.js`

**Interfaces:**
- Consumes: global `fetch` (mocked in tests).
- Produces:
  - `getIbexCompanyData(nif: string | null | undefined): Promise<ApiRow | null>` — the async lookup `Ibex35MarketSidebar.jsx` (Task 4) will call, passing a `SEEDEntry.nif` (Task 1).
  - `__resetIbex35Cache(): void` — test-only helper to reset the module-level cache between test cases.

- [ ] **Step 1: Write the failing tests**

Create `src/services/ibex35DashboardClient.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getIbexCompanyData, __resetIbex35Cache } from './ibex35DashboardClient';

const SAMPLE_RESPONSE = {
  success: true,
  data: [
    { nif: 'A78374725', ticker: 'REP.MC', name: 'Repsol', current_price_eur: 11.5 },
    { nif: 'A-39000013', ticker: 'SAN.MC', name: 'Santander', current_price_eur: 12.4 },
  ],
};

describe('getIbexCompanyData', () => {
  beforeEach(() => {
    __resetIbex35Cache();
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
  });

  it('calls the public companies endpoint with the public API key', async () => {
    await getIbexCompanyData('A78374725');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ibex35-api.ncdata.eu/api/companies',
      expect.objectContaining({
        headers: { Authorization: 'Bearer ibex35-public-access-2024' },
      })
    );
  });

  it('finds a company by NIF ignoring dash/case differences on the input side', async () => {
    const row = await getIbexCompanyData('a-78374725');
    expect(row.name).toBe('Repsol');
  });

  it('finds a company by NIF ignoring dash differences on the data side', async () => {
    const row = await getIbexCompanyData('A39000013');
    expect(row.name).toBe('Santander');
  });

  it('returns null when no company matches the NIF', async () => {
    const row = await getIbexCompanyData('X00000000');
    expect(row).toBeNull();
  });

  it('returns null for empty/null/undefined input without calling fetch', async () => {
    expect(await getIbexCompanyData('')).toBeNull();
    expect(await getIbexCompanyData(null)).toBeNull();
    expect(await getIbexCompanyData(undefined)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('caches the companies list across calls in the same window (fetches once)', async () => {
    await getIbexCompanyData('A78374725');
    await getIbexCompanyData('A-39000013');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null and does not throw when the request fails', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 }));
    const row = await getIbexCompanyData('A78374725');
    expect(row).toBeNull();
  });

  it('returns null and does not throw when fetch itself rejects', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const row = await getIbexCompanyData('A78374725');
    expect(row).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/services/ibex35DashboardClient.test.js`
Expected: FAIL — `Failed to resolve import "./ibex35DashboardClient"` (file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/services/ibex35DashboardClient.js`:

```js
const API_BASE = 'https://ibex35-api.ncdata.eu';
const PUBLIC_API_KEY = 'ibex35-public-access-2024';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = { rows: null, fetchedAt: 0 };

function normalizeNif(nif) {
  return String(nif || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

async function fetchCompanies() {
  const now = Date.now();
  if (cache.rows && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rows;
  }
  const res = await fetch(`${API_BASE}/api/companies`, {
    headers: { Authorization: `Bearer ${PUBLIC_API_KEY}` },
  });
  if (!res.ok) throw new Error(`ibex35-api responded with status ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json.data) ? json.data : [];
  cache = { rows, fetchedAt: now };
  return rows;
}

// Looks up one company's live price/market/shareholder data by NIF. Returns
// null (never throws) on no-match, network failure, or empty input — this is
// a bonus enrichment, not core app data, so callers should treat null as
// "don't show the card" rather than an error to surface to the user.
export async function getIbexCompanyData(nif) {
  if (!nif) return null;
  const target = normalizeNif(nif);
  try {
    const rows = await fetchCompanies();
    return rows.find(row => normalizeNif(row.nif) === target) || null;
  } catch (err) {
    console.warn('[Ibex35MarketSidebar] failed to fetch IBEX 35 market data:', err.message);
    return null;
  }
}

export function __resetIbex35Cache() {
  cache = { rows: null, fetchedAt: 0 };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/services/ibex35DashboardClient.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/ibex35DashboardClient.js src/services/ibex35DashboardClient.test.js
git commit -m "feat: add ibex35DashboardClient to fetch/cache live IBEX 35 company data"
```

---

## Task 4: `Ibex35MarketSidebar` component

**Files:**
- Create: `src/components/Ibex35MarketSidebar.jsx`

**Interfaces:**
- Consumes:
  - `getIbexCompanyData(nif)` from `../services/ibex35DashboardClient` (Task 3).
  - `buildIbexCardViewModel(seedEntry, apiRow, lang)` from `../utils/ibex35Match` (Task 2).
- Produces: default export `Ibex35MarketSidebar({ open: boolean, seedEntry: SEEDEntry | null, lang?: 'es' | 'en' })` — a React component. Task 5 renders `<Ibex35MarketSidebar open={...} seedEntry={...} lang={uiLanguage} />` inside `SpanishCompanyNetworkGraph.jsx`.

No automated test for this file per the Global Constraints (no component-rendering test infra in this app); verified manually in Task 5.

- [ ] **Step 1: Write the component**

Create `src/components/Ibex35MarketSidebar.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress, Divider, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { getIbexCompanyData } from '../services/ibex35DashboardClient';
import { buildIbexCardViewModel } from '../utils/ibex35Match';

const STRINGS = {
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
  },
};

// Non-modal, right-anchored, fixed sidebar mirroring ApoderadosSidebar.jsx's
// positioning. Fully automatic: shown/hidden entirely by the `open`/`seedEntry`
// props (no close button, no manual dismiss) — the caller (the graph
// component) owns visibility, keyed to the focused node and precedence
// against ApoderadosSidebar.
const Ibex35MarketSidebar = ({ open, seedEntry, lang = 'es' }) => {
  const t = STRINGS[lang === 'en' ? 'en' : 'es'];
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
      const apiRow = await getIbexCompanyData(seedEntry.nif);
      if (cancelled) return;
      setViewModel(buildIbexCardViewModel(seedEntry, apiRow, lang));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, seedEntry, lang]);

  if (!open || !seedEntry) return null;
  // Fetch finished with no data (not-found or network failure) — this is a
  // bonus enrichment, not core data, so a broken-looking card would be worse
  // than no card at all.
  if (!loading && !viewModel) return null;

  const rows = viewModel
    ? [
        [t.marketCap, viewModel.marketCapLabel],
        [t.volume, viewModel.volumeLabel],
        [t.peRatio, viewModel.peRatioLabel],
        [t.eps, viewModel.epsLabel],
        [t.high52, viewModel.high52Label],
        [t.low52, viewModel.low52Label],
        [t.dividendYield, viewModel.dividendYieldLabel],
      ].filter(([, value]) => value != null)
    : [];

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
        ) : (
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
        )}
      </Box>
    </Paper>
  );
};

export default Ibex35MarketSidebar;
```

- [ ] **Step 2: Verify the file builds**

Run: `npx esbuild src/components/Ibex35MarketSidebar.jsx --bundle=false --outfile=/dev/null`
Expected: no errors printed (esbuild reports the output size and "Done").

- [ ] **Step 3: Commit**

```bash
git add src/components/Ibex35MarketSidebar.jsx
git commit -m "feat: add Ibex35MarketSidebar component"
```

---

## Task 5: Wire the sidebar into the graph

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx:83-117` (imports)
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx:4034-4047` (focused-company resolution — read-only reference, no change, just where the new computed value is placed nearby)
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx:8045` (render, right after the existing `<ApoderadosSidebar ... />` element)

**Interfaces:**
- Consumes: `matchIbexSeed` (Task 1) from `../utils/ibex35Match`; `Ibex35MarketSidebar` (Task 4) from `./Ibex35MarketSidebar`; the existing `resolveFocusedCompany()`, `apoderadosSidebar` state, and `uiLanguage` already defined in this file.
- Produces: nothing new for other files — this is the integration point.

- [ ] **Step 1: Add the imports**

In `src/components/SpanishCompanyNetworkGraph.jsx`, find line 83:

```js
import ApoderadosSidebar from './ApoderadosSidebar';
```

Add immediately after it:

```js
import ApoderadosSidebar from './ApoderadosSidebar';
import Ibex35MarketSidebar from './Ibex35MarketSidebar';
```

And find line 117 (the last of the existing `functions/empresa` cross-imports):

```js
import { fullCompanyPageHref } from '../../functions/empresa/_page_href.js';
```

Add immediately after it:

```js
import { fullCompanyPageHref } from '../../functions/empresa/_page_href.js';
import { matchIbexSeed } from '../utils/ibex35Match';
```

- [ ] **Step 2: Compute the focused IBEX match**

Find the `resolveFocusedCompany` definition (around line 4034-4047):

```js
  const resolveFocusedCompany = useCallback(() => {
    const companyNodes = (graphData.nodes || []).filter(
      n => n.type === 'spanish-company-group' && n.name
    );
    if (companyNodes.length === 0) return null;
    if (primarySubject) {
      const match = companyNodes.find(
        n => n.name.toUpperCase() === primarySubject.toUpperCase()
      );
      if (match) return { name: match.name, groupKey: match.groupKey || null };
    }
    const first = companyNodes[0];
    return { name: first.name, groupKey: first.groupKey || null };
  }, [graphData.nodes, primarySubject]);
```

Add immediately after this block:

```js
  // The focused company's IBEX 35 SEED entry, or null. Recomputed on every
  // render (cheap: a map lookup against the ~35-entry SEED) whenever the
  // focused company changes.
  const focusedIbexSeed = (() => {
    const focused = resolveFocusedCompany();
    return focused ? matchIbexSeed(focused.name) : null;
  })();
```

- [ ] **Step 3: Render the sidebar**

Find the closing tag of `<ApoderadosSidebar ... />` (around line 8045):

```js
            addCompanyWithOfficersToGraph([entry]);
          }}
        />

        <Dialog
```

Change to:

```js
            addCompanyWithOfficersToGraph([entry]);
          }}
        />

        <Ibex35MarketSidebar
          open={Boolean(focusedIbexSeed) && !apoderadosSidebar.open}
          seedEntry={focusedIbexSeed}
          lang={uiLanguage}
        />

        <Dialog
```

- [ ] **Step 4: Verify the file builds**

Run: `npx esbuild src/components/SpanishCompanyNetworkGraph.jsx --bundle=false --outfile=/dev/null`
Expected: no errors printed (esbuild reports the output size and "Done").

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus the new tests from Tasks 1-3 pass, nothing broken.

- [ ] **Step 6: Manual verification in the running app**

Run: `npm run dev`, open the app in a browser, and:

1. Search for an IBEX 35 company, e.g. "Repsol" or "Banco Santander", and open it in the graph.
2. Confirm the "Market data"/"Datos de mercado" sidebar appears on the right with a price, change chip, market-data rows, and a "Significant shareholders"/"Accionistas significativos" section.
3. Search for a non-IBEX company (e.g. any small SL) and confirm the sidebar disappears.
4. With an IBEX company focused and the market sidebar showing, right-click the node and open "Apoderados" — confirm the market sidebar hides while Apoderados is open.
5. Close Apoderados — confirm the market sidebar reappears (since the focused company is still the same IBEX company).
6. Switch the UI language toggle (ES/EN) and confirm the sidebar's labels switch accordingly.

- [ ] **Step 7: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat: show IBEX 35 market sidebar for the focused company"
```

---

## Self-Review Notes

- **Spec coverage:** Data sourcing (SEED + live API, NIF match key) → Tasks 1-3. UI placement/precedence/no-close-button → Task 4-5. Card content (full snapshot + shareholders with per-row date) → Task 2 (view model) + Task 4 (render). Error handling (loading/loaded/render-nothing-on-failure) → Task 3 (`getIbexCompanyData` never throws) + Task 4 (render guards). Testing approach (pure-function tests, no new test infra) → Tasks 1-3 have full unit tests; Task 4/5 rely on manual verification, matching the spec's documented rationale.
- **Placeholder scan:** none found — every step has complete, runnable code.
- **Type/name consistency:** `matchIbexSeed`, `buildIbexCardViewModel`, `getIbexCompanyData`, `__resetIbex35Cache`, `Ibex35MarketSidebar`, `focusedIbexSeed` are spelled identically everywhere they're defined and consumed across tasks.
