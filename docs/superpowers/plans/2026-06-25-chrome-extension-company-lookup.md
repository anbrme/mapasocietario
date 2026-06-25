# Chrome Extension — Spanish Company Lookup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chrome MV3 extension that turns selected text on any page into a Spanish-company card + one-hop officer network graph in the side panel, read-only and anonymous.

**Architecture:** A self-contained Vite project under `chrome-extension/` in this repo. A **service worker** owns all network I/O (host_permissions for `api.ncdata.eu` → CORS bypassed, backend untouched). A **React side-panel app** is pure view + messaging: MatchList → CompanyCard → CompanyGraph. The card AND the graph are both built from the SAME `/bormes/v3/company` aggregate doc (which already carries `officers_active`/`officers_resigned`), so v1 makes exactly two backend calls: autocomplete (resolve) then one company fetch.

**Tech Stack:** Manifest V3, Chrome `sidePanel` + `contextMenus` APIs, Vite, React 18, `react-force-graph-2d`, Vitest + @testing-library/react, jsdom.

## Global Constraints

- **Read-only, anonymous.** Only GET these endpoints: `/bormes/companies/directory/autocomplete`, `/bormes/v3/search`, `/bormes/v3/company/<name>`. NEVER call enrichment, DD, corrections, or any authed/billed path.
- **No page reading, no tracking, no in-page UI injection** in v1. Triggers are the context menu + toolbar icon only. (Floating chip = v2.)
- **All `fetch` lives in the service worker**, never in the panel document. The panel talks to the worker via `chrome.runtime` messaging.
- **API base URL:** `https://api.ncdata.eu` (hard-coded constant; matches the web app's `API_URL`).
- **Officer caps:** request the capped company doc — do NOT send `full_officers=1`. Cap rendered officer nodes at **40** (board roles first) to avoid CaixaBank-style large-board freezes.
- **Group-key first:** autocomplete returns a stable `id` (group_key, e.g. `H:M-396846`). Always pass it to the company fetch via `?group_key=` to avoid fuzzy-name mismatches and the AIE name-leak.
- **Bilingual ES/EN** from `navigator.language` (`es*` → Spanish, else English). Static string table; no runtime translation.
- **Soft CTA only:** one `→ Ver perfil completo en mapasocietario.es` / `→ View full profile on mapasocietario.es` link per card. No DD upsell anywhere in the panel.
- **Node ≥ 20, npm.** Commit after every task. Conventional-commit messages.

---

## File Structure

```
chrome-extension/
  package.json                 # self-contained; not linked to the app's package.json
  vite.config.js               # multi-entry build (worker + panel) → dist/
  manifest.json                # MV3
  src/
    background.js              # service worker: context menu, messaging, API client
    api/client.js             # resolveCompany / getCompany (pure fetch + shaping)
    api/messages.js           # message-type constants shared by worker + panel
    panel/index.html
    panel/main.jsx            # React mount + chrome.runtime message listener
    panel/App.jsx             # state machine: idle → loading → matches → company → error
    panel/components/MatchList.jsx
    panel/components/CompanyCard.jsx
    panel/components/CompanyGraph.jsx
    panel/i18n.js             # ES/EN string table + pickLocale()
    panel/empresaUrl.js       # build mapasocietario.es/empresa link from a doc
    shared/officerStatus.js   # ported pure util: active vs ceased categorisation
  test/                        # Vitest specs mirror src/ paths
  public/icons/                # 16/48/128 png (placeholder ok for dev)
  PRIVACY.md                   # store privacy policy
```

---

### Task 1: Scaffold the extension project (loads unpacked, panel opens)

**Files:**
- Create: `chrome-extension/package.json`
- Create: `chrome-extension/vite.config.js`
- Create: `chrome-extension/manifest.json`
- Create: `chrome-extension/src/background.js`
- Create: `chrome-extension/src/panel/index.html`
- Create: `chrome-extension/src/panel/main.jsx`
- Create: `chrome-extension/src/panel/App.jsx`
- Create: `chrome-extension/public/icons/icon16.png`, `icon48.png`, `icon128.png` (any 1×1 png placeholder)

**Interfaces:**
- Produces: a `dist/` that loads as an unpacked extension; toolbar icon opens the side panel showing "Mapa Societario".

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mapasocietario-chrome",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-force-graph-2d": "^1.25.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`** (multi-entry: service worker + panel; flat output names so the manifest can reference them)

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.js'),
        panel: resolve(__dirname, 'src/panel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunk-[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
  },
});
```

- [ ] **Step 3: Create `test/setup.js`**

```js
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Mapa Societario — Spanish company lookup",
  "version": "0.1.0",
  "description": "Select a Spanish company name on any page to see its registry profile and officer network.",
  "permissions": ["contextMenus", "sidePanel"],
  "host_permissions": ["https://api.ncdata.eu/*"],
  "background": { "service_worker": "background.js", "type": "module" },
  "side_panel": { "default_path": "src/panel/index.html" },
  "action": { "default_title": "Mapa Societario" },
  "icons": { "16": "icon16.png", "48": "icon48.png", "128": "icon128.png" }
}
```

- [ ] **Step 5: Create `src/panel/index.html`**

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Mapa Societario</title></head>
  <body style="margin:0"><div id="root"></div><script type="module" src="./main.jsx"></script></body>
</html>
```

- [ ] **Step 6: Create `src/panel/App.jsx`** (placeholder; real state machine in Task 8)

```jsx
import React from 'react';
export default function App() {
  return <div style={{ padding: 16, fontFamily: 'system-ui' }}>Mapa Societario</div>;
}
```

- [ ] **Step 7: Create `src/panel/main.jsx`**

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
createRoot(document.getElementById('root')).render(<App />);
```

- [ ] **Step 8: Create `src/background.js`** (minimal: open panel on toolbar click)

```js
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
```

- [ ] **Step 9: Build and load**

Run: `cd chrome-extension && npm install && npm run build`
Expected: `dist/` contains `background.js`, `panel.html` (or `src/panel/index.html`), `panel.js`.
Then manually: Chrome → Extensions → Developer mode → Load unpacked → select `chrome-extension/dist`. Click the toolbar icon → side panel shows "Mapa Societario".

- [ ] **Step 10: Commit**

```bash
git add chrome-extension
git commit -m "feat(ext): scaffold MV3 extension, side panel opens"
```

---

### Task 2: API client — resolveCompany (autocomplete → match list)

**Files:**
- Create: `chrome-extension/src/api/client.js`
- Test: `chrome-extension/test/api/client.resolve.test.js`

**Interfaces:**
- Produces: `resolveCompany(query, { fetchImpl = fetch }) → Promise<Match[]>` where
  `Match = { id: string, name: string, location: string|null, nif: string|null, isAlias: boolean, formerName: string|null, newName: string|null }`.
  `id` is the stable group_key used by Task 3. Returns `[]` for queries < 2 chars or on any error.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { resolveCompany } from '../../src/api/client.js';

const fakeFetch = (payload) => async () =>
  ({ ok: true, json: async () => payload });

describe('resolveCompany', () => {
  it('maps suggestions to Match objects with stable id', async () => {
    const payload = { suggestions: [
      { id: 'H:M-396846', company_name: 'TELEFONICA SA', province: 'Madrid', nif: 'A28015865' },
    ]};
    const out = await resolveCompany('telefonica', { fetchImpl: fakeFetch(payload) });
    expect(out).toEqual([
      { id: 'H:M-396846', name: 'TELEFONICA SA', location: 'Madrid', nif: 'A28015865',
        isAlias: false, formerName: null, newName: null },
    ]);
  });

  it('surfaces alias rename info', async () => {
    const payload = { suggestions: [
      { id: 'H:M-1', company_name: 'NEW NAME SL', is_alias: true, original_name: 'OLD NAME SL' },
    ]};
    const out = await resolveCompany('old name', { fetchImpl: fakeFetch(payload) });
    expect(out[0].isAlias).toBe(true);
    expect(out[0].formerName).toBe('OLD NAME SL');
  });

  it('returns [] for short queries without calling fetch', async () => {
    let called = false;
    const spy = async () => { called = true; return { ok: true, json: async () => ({}) }; };
    expect(await resolveCompany('a', { fetchImpl: spy })).toEqual([]);
    expect(called).toBe(false);
  });

  it('returns [] on fetch error', async () => {
    const boom = async () => { throw new Error('network'); };
    expect(await resolveCompany('telefonica', { fetchImpl: boom })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd chrome-extension && npx vitest run test/api/client.resolve.test.js`
Expected: FAIL — `resolveCompany` not exported.

- [ ] **Step 3: Write minimal implementation**

```js
// chrome-extension/src/api/client.js
const API_BASE = 'https://api.ncdata.eu';

export async function resolveCompany(query, { fetchImpl = fetch } = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  try {
    const url = `${API_BASE}/bormes/companies/directory/autocomplete?q=${encodeURIComponent(q)}&limit=8`;
    const res = await fetchImpl(url, { method: 'GET' });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.suggestions || []).map((s) => ({
      id: s.id,
      name: s.company_name,
      location: s.province || s.city || null,
      nif: s.nif || null,
      isAlias: Boolean(s.is_alias),
      formerName: s.original_name || null,
      newName: s.new_company_name || null,
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd chrome-extension && npx vitest run test/api/client.resolve.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/api/client.js chrome-extension/test/api/client.resolve.test.js
git commit -m "feat(ext): resolveCompany maps autocomplete to match list"
```

---

### Task 3: API client — getCompany (group_key → card+graph doc)

**Files:**
- Modify: `chrome-extension/src/api/client.js`
- Test: `chrome-extension/test/api/client.company.test.js`

**Interfaces:**
- Consumes: `Match.id` (group_key) from Task 2.
- Produces: `getCompany(id, { fetchImpl = fetch }) → Promise<CompanyDoc|null>` where
  `CompanyDoc = { groupKey, name, nif, capital, address, status, identifiers: string[],
   officersActive: Officer[], officersResigned: Officer[], firstSeen, lastSeen }` and
  `Officer = { name, position, appointedDate, resignedDate }`.
  Uses `/bormes/v3/search?group_key=<id>&size=10` and selects the doc whose `_id|id|group_key` equals `id`. Returns `null` if not found / on error.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { getCompany } from '../../src/api/client.js';

const fetchReturning = (payload) => async () => ({ ok: true, json: async () => payload });

const doc = {
  _id: 'H:M-396846',
  company_name: 'TELEFONICA SA',
  nif: 'A28015865',
  capital: 5000000,
  enriched_address: 'Gran Via 28, Madrid',
  identifiers: ['M-396846'],
  first_seen: '2009-01-01', last_seen: '2026-06-01',
  officers_active: [
    { name: 'JANE DOE', position_normalized: 'Consejero', appointed_date: '2020-01-01' },
  ],
  officers_resigned: [
    { name: 'JOHN ROE', position_normalized: 'Administrador', resigned_date: '2018-05-05' },
  ],
};

describe('getCompany', () => {
  it('shapes the v3 search doc into a CompanyDoc', async () => {
    const out = await getCompany('H:M-396846', { fetchImpl: fetchReturning({ results: [doc] }) });
    expect(out.groupKey).toBe('H:M-396846');
    expect(out.name).toBe('TELEFONICA SA');
    expect(out.nif).toBe('A28015865');
    expect(out.address).toBe('Gran Via 28, Madrid');
    expect(out.officersActive).toEqual([
      { name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01', resignedDate: null },
    ]);
    expect(out.officersResigned[0].name).toBe('JOHN ROE');
  });

  it('returns null when no doc matches the group_key', async () => {
    const out = await getCompany('H:M-999', { fetchImpl: fetchReturning({ results: [doc] }) });
    expect(out).toBeNull();
  });

  it('returns null on error', async () => {
    const out = await getCompany('H:M-1', { fetchImpl: async () => { throw new Error('x'); } });
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd chrome-extension && npx vitest run test/api/client.company.test.js`
Expected: FAIL — `getCompany` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `client.js`)

```js
function shapeOfficer(o) {
  return {
    name: o.name || o.name_normalized || '',
    position: o.position_normalized || o.position || '',
    appointedDate: o.appointed_date || null,
    resignedDate: o.resigned_date || null,
  };
}

export async function getCompany(id, { fetchImpl = fetch } = {}) {
  const key = (id || '').trim();
  if (!key) return null;
  try {
    const url = `${API_BASE}/bormes/v3/search?group_key=${encodeURIComponent(key)}&size=10`;
    const res = await fetchImpl(url, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    const doc = (data.results || []).find(
      (r) => (r._id || r.id || r.group_key || '').trim() === key
    );
    if (!doc) return null;
    return {
      groupKey: key,
      name: doc.company_name || doc.company_name_normalized || '',
      nif: doc.nif || doc.enriched_nif || null,
      capital: doc.capital ?? doc.enriched_capital ?? null,
      address: doc.enriched_address || doc.address || null,
      status: doc.status || (doc.has_dissolution ? 'dissolved' : 'active'),
      identifiers: doc.identifiers || [],
      officersActive: (doc.officers_active || []).map(shapeOfficer),
      officersResigned: (doc.officers_resigned || []).map(shapeOfficer),
      firstSeen: doc.first_seen || null,
      lastSeen: doc.last_seen || null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd chrome-extension && npx vitest run test/api/client.company.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/api/client.js chrome-extension/test/api/client.company.test.js
git commit -m "feat(ext): getCompany shapes v3 doc into card+graph model"
```

---

### Task 4: Service worker — context menu + message routing

**Files:**
- Create: `chrome-extension/src/api/messages.js`
- Modify: `chrome-extension/src/background.js`
- Test: `chrome-extension/test/background.test.js`

**Interfaces:**
- Consumes: `resolveCompany`, `getCompany` from Tasks 2–3.
- Produces: message protocol constants in `messages.js`:
  `MSG = { SELECTION: 'selection', RESOLVE: 'resolve', GET_COMPANY: 'getCompany' }`.
  Exports a testable `handleMessage(msg, { resolveImpl, getImpl }) → Promise<Response>` where
  `Response` is `{ type: 'matches', matches } | { type: 'company', company } | { type: 'error', error }`.

- [ ] **Step 1: Create `src/api/messages.js`**

```js
export const MSG = { SELECTION: 'selection', RESOLVE: 'resolve', GET_COMPANY: 'getCompany' };
```

- [ ] **Step 2: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { handleMessage } from '../src/background.js';
import { MSG } from '../src/api/messages.js';

describe('handleMessage', () => {
  it('RESOLVE returns matches', async () => {
    const out = await handleMessage(
      { type: MSG.RESOLVE, query: 'telefonica' },
      { resolveImpl: async () => [{ id: 'H:M-1', name: 'X' }], getImpl: async () => null }
    );
    expect(out).toEqual({ type: 'matches', matches: [{ id: 'H:M-1', name: 'X' }] });
  });

  it('GET_COMPANY returns company', async () => {
    const out = await handleMessage(
      { type: MSG.GET_COMPANY, id: 'H:M-1' },
      { resolveImpl: async () => [], getImpl: async () => ({ name: 'X' }) }
    );
    expect(out).toEqual({ type: 'company', company: { name: 'X' } });
  });

  it('GET_COMPANY with no doc returns error', async () => {
    const out = await handleMessage(
      { type: MSG.GET_COMPANY, id: 'H:M-1' },
      { resolveImpl: async () => [], getImpl: async () => null }
    );
    expect(out.type).toBe('error');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd chrome-extension && npx vitest run test/background.test.js`
Expected: FAIL — `handleMessage` not exported.

- [ ] **Step 4: Implement `src/background.js`**

```js
import { resolveCompany, getCompany } from './api/client.js';
import { MSG } from './api/messages.js';

export async function handleMessage(msg, { resolveImpl = resolveCompany, getImpl = getCompany } = {}) {
  try {
    if (msg.type === MSG.RESOLVE) {
      return { type: 'matches', matches: await resolveImpl(msg.query) };
    }
    if (msg.type === MSG.GET_COMPANY) {
      const company = await getImpl(msg.id);
      return company ? { type: 'company', company } : { type: 'error', error: 'not_found' };
    }
    return { type: 'error', error: 'unknown_message' };
  } catch (e) {
    return { type: 'error', error: String(e?.message || e) };
  }
}

// --- Chrome wiring (not exercised by unit tests) ---
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});

  chrome.runtime.onInstalled?.addListener(() => {
    chrome.contextMenus.create({
      id: 'lookup-company',
      title: 'Look up Spanish company: "%s"',
      contexts: ['selection'],
    });
  });

  chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'lookup-company' || !info.selectionText) return;
    await chrome.sidePanel.open({ tabId: tab.id });
    // Panel may still be mounting; retry the broadcast briefly.
    const payload = { type: MSG.SELECTION, query: info.selectionText.trim() };
    for (let i = 0; i < 10; i++) {
      try { await chrome.runtime.sendMessage(payload); break; }
      catch { await new Promise((r) => setTimeout(r, 150)); }
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    handleMessage(msg).then(sendResponse);
    return true; // async response
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd chrome-extension && npx vitest run test/background.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add chrome-extension/src/background.js chrome-extension/src/api/messages.js chrome-extension/test/background.test.js
git commit -m "feat(ext): context menu trigger + worker message routing"
```

---

### Task 5: i18n + empresa URL helpers

**Files:**
- Create: `chrome-extension/src/panel/i18n.js`
- Create: `chrome-extension/src/panel/empresaUrl.js`
- Test: `chrome-extension/test/panel/i18n.test.js`
- Test: `chrome-extension/test/panel/empresaUrl.test.js`

**Interfaces:**
- Produces: `pickLocale(navLang) → 'es'|'en'` and `t(locale, key) → string` over a fixed key set:
  `matchesHeading, noMatches, loading, error, capital, address, status, activeOfficers, formerOfficers, viewProfile, statusActive, statusDissolved`.
- Produces: `empresaUrl(company) → string` building `https://mapasocietario.es/empresa/<slug>` where
  `<slug>` is the company name lowercased, accents stripped, non-alphanumerics → `-`, collapsed, trimmed.

- [ ] **Step 1: Write the failing i18n test**

```js
import { describe, it, expect } from 'vitest';
import { pickLocale, t } from '../../src/panel/i18n.js';

describe('i18n', () => {
  it('maps es* to es, everything else to en', () => {
    expect(pickLocale('es-ES')).toBe('es');
    expect(pickLocale('en-US')).toBe('en');
    expect(pickLocale(undefined)).toBe('en');
  });
  it('returns localized strings', () => {
    expect(t('es', 'viewProfile')).toMatch(/perfil/i);
    expect(t('en', 'viewProfile')).toMatch(/profile/i);
  });
  it('falls back to the key when missing', () => {
    expect(t('en', 'nope')).toBe('nope');
  });
});
```

- [ ] **Step 2: Run it; expect FAIL**

Run: `cd chrome-extension && npx vitest run test/panel/i18n.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/panel/i18n.js`**

```js
const STRINGS = {
  en: {
    matchesHeading: 'Matches', noMatches: 'No Spanish company found for this selection.',
    loading: 'Loading…', error: 'Something went wrong. Try again.',
    capital: 'Capital', address: 'Address', status: 'Status',
    activeOfficers: 'Active officers', formerOfficers: 'Former officers',
    viewProfile: 'View full profile on mapasocietario.es',
    statusActive: 'Active', statusDissolved: 'Dissolved',
  },
  es: {
    matchesHeading: 'Coincidencias', noMatches: 'No se encontró ninguna empresa española para esta selección.',
    loading: 'Cargando…', error: 'Algo salió mal. Inténtalo de nuevo.',
    capital: 'Capital', address: 'Domicilio', status: 'Estado',
    activeOfficers: 'Cargos activos', formerOfficers: 'Cargos anteriores',
    viewProfile: 'Ver perfil completo en mapasocietario.es',
    statusActive: 'Activa', statusDissolved: 'Disuelta',
  },
};

export function pickLocale(navLang) {
  return (navLang || '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function t(locale, key) {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
}
```

- [ ] **Step 4: Run it; expect PASS**

Run: `cd chrome-extension && npx vitest run test/panel/i18n.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing empresaUrl test**

```js
import { describe, it, expect } from 'vitest';
import { empresaUrl } from '../../src/panel/empresaUrl.js';

describe('empresaUrl', () => {
  it('slugifies the company name', () => {
    expect(empresaUrl({ name: 'TELEFÓNICA SA' }))
      .toBe('https://mapasocietario.es/empresa/telefonica-sa');
  });
  it('collapses punctuation and spaces', () => {
    expect(empresaUrl({ name: 'AENA S.M.E., S.A.' }))
      .toBe('https://mapasocietario.es/empresa/aena-s-m-e-s-a');
  });
});
```

- [ ] **Step 6: Run it; expect FAIL, then implement `src/panel/empresaUrl.js`**

```js
export function empresaUrl(company) {
  const slug = (company?.name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `https://mapasocietario.es/empresa/${slug}`;
}
```

Run: `cd chrome-extension && npx vitest run test/panel/empresaUrl.test.js`
Expected: PASS.

> NOTE (from [[project_empresa_url_stability]]): slug reconstruction can 404 for heavily punctuated names. v1 accepts this for the soft link; v2 should pass the stable `groupKey` to a direct-lookup `/empresa` route once it exists.

- [ ] **Step 7: Commit**

```bash
git add chrome-extension/src/panel/i18n.js chrome-extension/src/panel/empresaUrl.js chrome-extension/test/panel
git commit -m "feat(ext): i18n table + empresa URL builder"
```

---

### Task 6: MatchList component

**Files:**
- Create: `chrome-extension/src/panel/components/MatchList.jsx`
- Test: `chrome-extension/test/panel/MatchList.test.jsx`

**Interfaces:**
- Consumes: `Match[]` from Task 2, `locale` from Task 5.
- Produces: `<MatchList matches locale onPick />`; renders one button per match (name · location · NIF), shows alias hint when `isAlias`, calls `onPick(match)` on click. Empty array → localized "no matches".

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MatchList from '../../src/panel/components/MatchList.jsx';

const matches = [
  { id: 'H:M-1', name: 'TELEFONICA SA', location: 'Madrid', nif: 'A28015865', isAlias: false },
  { id: 'H:M-2', name: 'NEW SL', location: null, nif: null, isAlias: true, formerName: 'OLD SL' },
];

describe('MatchList', () => {
  it('renders a button per match and fires onPick', () => {
    const onPick = vi.fn();
    render(<MatchList matches={matches} locale="en" onPick={onPick} />);
    fireEvent.click(screen.getByText('TELEFONICA SA'));
    expect(onPick).toHaveBeenCalledWith(matches[0]);
  });
  it('shows the former-name hint for aliases', () => {
    render(<MatchList matches={matches} locale="en" onPick={() => {}} />);
    expect(screen.getByText(/OLD SL/)).toBeInTheDocument();
  });
  it('shows no-matches message for empty list', () => {
    render(<MatchList matches={[]} locale="en" onPick={() => {}} />);
    expect(screen.getByText(/No Spanish company found/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it; expect FAIL**

Run: `cd chrome-extension && npx vitest run test/panel/MatchList.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/panel/components/MatchList.jsx`**

```jsx
import React from 'react';
import { t } from '../i18n.js';

export default function MatchList({ matches, locale, onPick }) {
  if (!matches || matches.length === 0) {
    return <p style={{ padding: 12, color: '#555' }}>{t(locale, 'noMatches')}</p>;
  }
  return (
    <div>
      <h3 style={{ padding: '8px 12px', margin: 0, fontSize: 13, color: '#555' }}>
        {t(locale, 'matchesHeading')}
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {matches.map((m) => (
          <li key={m.id}>
            <button
              onClick={() => onPick(m)}
              style={{ display: 'block', width: '100%', textAlign: 'left',
                       padding: '10px 12px', border: 'none', borderBottom: '1px solid #eee',
                       background: '#fff', cursor: 'pointer' }}
            >
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: '#777' }}>
                {[m.location, m.nif].filter(Boolean).join(' · ')}
                {m.isAlias && m.formerName ? ` · (antes: ${m.formerName})` : ''}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run it; expect PASS**

Run: `cd chrome-extension && npx vitest run test/panel/MatchList.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/panel/components/MatchList.jsx chrome-extension/test/panel/MatchList.test.jsx
git commit -m "feat(ext): MatchList component"
```

---

### Task 7: CompanyCard component

**Files:**
- Create: `chrome-extension/src/panel/components/CompanyCard.jsx`
- Test: `chrome-extension/test/panel/CompanyCard.test.jsx`

**Interfaces:**
- Consumes: `CompanyDoc` from Task 3, `locale` from Task 5, `empresaUrl` from Task 5.
- Produces: `<CompanyCard company locale />`; renders name, NIF, capital (localized number), address, status (localized), active/former officer counts, and the soft `viewProfile` link to `empresaUrl(company)` with `target="_blank" rel="noopener noreferrer"`.

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompanyCard from '../../src/panel/components/CompanyCard.jsx';

const company = {
  groupKey: 'H:M-1', name: 'TELEFONICA SA', nif: 'A28015865', capital: 5000000,
  address: 'Gran Via 28, Madrid', status: 'active',
  officersActive: [{ name: 'JANE DOE', position: 'Consejero' }],
  officersResigned: [{ name: 'JOHN ROE', position: 'Administrador' }],
};

describe('CompanyCard', () => {
  it('renders core fields and the soft profile link', () => {
    render(<CompanyCard company={company} locale="en" />);
    expect(screen.getByText('TELEFONICA SA')).toBeInTheDocument();
    expect(screen.getByText('A28015865')).toBeInTheDocument();
    expect(screen.getByText(/Active officers/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /View full profile/i });
    expect(link).toHaveAttribute('href', 'https://mapasocietario.es/empresa/telefonica-sa');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
```

- [ ] **Step 2: Run it; expect FAIL**

Run: `cd chrome-extension && npx vitest run test/panel/CompanyCard.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/panel/components/CompanyCard.jsx`**

```jsx
import React from 'react';
import { t } from '../i18n.js';
import { empresaUrl } from '../empresaUrl.js';

function fmtCapital(value, locale) {
  if (value == null) return null;
  try { return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-GB',
    { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value); }
  catch { return String(value); }
}

function Row({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div style={{ display: 'flex', gap: 8, padding: '2px 0', fontSize: 13 }}>
      <span style={{ color: '#888', minWidth: 80 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default function CompanyCard({ company, locale }) {
  const statusLabel = company.status === 'dissolved' || company.status === 'disuelta'
    ? t(locale, 'statusDissolved') : t(locale, 'statusActive');
  return (
    <div style={{ padding: 12, fontFamily: 'system-ui' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>{company.name}</h2>
      <Row label="NIF">{company.nif}</Row>
      <Row label={t(locale, 'capital')}>{fmtCapital(company.capital, locale)}</Row>
      <Row label={t(locale, 'address')}>{company.address}</Row>
      <Row label={t(locale, 'status')}>{statusLabel}</Row>
      <Row label={t(locale, 'activeOfficers')}>{company.officersActive.length}</Row>
      <Row label={t(locale, 'formerOfficers')}>{company.officersResigned.length}</Row>
      <a href={empresaUrl(company)} target="_blank" rel="noopener noreferrer"
         style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: '#1a5fb4' }}>
        → {t(locale, 'viewProfile')}
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Run it; expect PASS**

Run: `cd chrome-extension && npx vitest run test/panel/CompanyCard.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/panel/components/CompanyCard.jsx chrome-extension/test/panel/CompanyCard.test.jsx
git commit -m "feat(ext): CompanyCard with soft profile link"
```

---

### Task 8: Graph data builder (pure) — company doc → nodes/links

**Files:**
- Create: `chrome-extension/src/shared/buildGraph.js`
- Test: `chrome-extension/test/shared/buildGraph.test.js`

**Interfaces:**
- Consumes: `CompanyDoc` from Task 3.
- Produces: `buildGraph(company, { maxOfficers = 40 }) → { nodes, links }` where
  `nodes = [{ id, label, type: 'company'|'officer' }]` and
  `links = [{ source, target, status: 'active'|'ceased', role, date }]`.
  The company is the center node (`id = groupKey`). Active officers first; total officer nodes capped at `maxOfficers` (board roles prioritized via `isBoardRole`). De-duplicates officers by normalized name, merging active+ceased into one node whose link is `active` if ANY active seat exists.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/shared/buildGraph.js';

const company = {
  groupKey: 'H:M-1', name: 'ACME SA',
  officersActive: [
    { name: 'JANE DOE', position: 'Consejero', appointedDate: '2020-01-01', resignedDate: null },
  ],
  officersResigned: [
    { name: 'JOHN ROE', position: 'Apoderado', appointedDate: null, resignedDate: '2018-05-05' },
    { name: 'JANE DOE', position: 'Apoderado', appointedDate: null, resignedDate: '2017-01-01' },
  ],
};

describe('buildGraph', () => {
  it('puts the company at the center', () => {
    const { nodes } = buildGraph(company);
    expect(nodes[0]).toEqual({ id: 'H:M-1', label: 'ACME SA', type: 'company' });
  });
  it('creates one officer node per distinct person', () => {
    const { nodes } = buildGraph(company);
    const officers = nodes.filter((n) => n.type === 'officer');
    expect(officers.map((o) => o.label).sort()).toEqual(['JANE DOE', 'JOHN ROE']);
  });
  it('marks a person active if ANY seat is active', () => {
    const { links } = buildGraph(company);
    const jane = links.find((l) => l.target.endsWith('JANE DOE'));
    expect(jane.status).toBe('active');
    const john = links.find((l) => l.target.endsWith('JOHN ROE'));
    expect(john.status).toBe('ceased');
  });
  it('caps officer nodes at maxOfficers, board roles first', () => {
    const many = { groupKey: 'H:M-2', name: 'BIG SA', officersActive: [], officersResigned:
      Array.from({ length: 100 }, (_, i) => ({ name: `P${i}`,
        position: i < 3 ? 'Consejero' : 'Apoderado', resignedDate: '2020-01-01' })) };
    const { nodes } = buildGraph(many, { maxOfficers: 5 });
    const officers = nodes.filter((n) => n.type === 'officer');
    expect(officers.length).toBe(5);
    expect(officers.slice(0, 3).map((o) => o.label)).toEqual(['P0', 'P1', 'P2']);
  });
});
```

- [ ] **Step 2: Run it; expect FAIL**

Run: `cd chrome-extension && npx vitest run test/shared/buildGraph.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/shared/buildGraph.js`**

```js
const BOARD_ROLES = ['consejero', 'administrador', 'presidente', 'secretario',
  'vicepresidente', 'consejero delegado', 'liquidador'];

function isBoardRole(position) {
  const p = (position || '').toLowerCase();
  return BOARD_ROLES.some((r) => p.includes(r));
}

function normName(name) {
  return (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

export function buildGraph(company, { maxOfficers = 40 } = {}) {
  const center = { id: company.groupKey, label: company.name, type: 'company' };

  // Merge by person; an active seat wins over a ceased one.
  const people = new Map(); // normName -> { label, status, role, date, board }
  const add = (o, status) => {
    const key = normName(o.name);
    if (!key) return;
    const existing = people.get(key);
    const board = isBoardRole(o.position);
    const date = status === 'active' ? o.appointedDate : o.resignedDate;
    if (!existing) {
      people.set(key, { label: o.name, status, role: o.position || '', date: date || null, board });
    } else if (status === 'active' && existing.status !== 'active') {
      people.set(key, { label: existing.label, status: 'active', role: o.position || existing.role,
        date: date || existing.date, board: existing.board || board });
    } else {
      existing.board = existing.board || board;
    }
  };
  (company.officersActive || []).forEach((o) => add(o, 'active'));
  (company.officersResigned || []).forEach((o) => add(o, 'ceased'));

  // Order: active first, then board roles, then the rest; cap.
  const ordered = [...people.entries()].sort(([, a], [, b]) => {
    if ((b.status === 'active') - (a.status === 'active')) return (b.status === 'active') - (a.status === 'active');
    return (b.board === true) - (a.board === true);
  }).slice(0, maxOfficers);

  const nodes = [center];
  const links = [];
  for (const [key, p] of ordered) {
    const id = `officer:${key}`;
    nodes.push({ id, label: p.label, type: 'officer' });
    links.push({ source: center.id, target: id, status: p.status, role: p.role, date: p.date });
  }
  return { nodes, links };
}
```

- [ ] **Step 4: Run it; expect PASS**

Run: `cd chrome-extension && npx vitest run test/shared/buildGraph.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/shared/buildGraph.js chrome-extension/test/shared/buildGraph.test.js
git commit -m "feat(ext): pure company→officer graph builder with active-wins merge + cap"
```

---

### Task 9: CompanyGraph component (ForceGraph2D render)

**Files:**
- Create: `chrome-extension/src/panel/components/CompanyGraph.jsx`
- Test: `chrome-extension/test/panel/CompanyGraph.test.jsx`

**Interfaces:**
- Consumes: `CompanyDoc` (Task 3) + `buildGraph` (Task 8).
- Produces: `<CompanyGraph company />`; computes `{nodes, links}` via `buildGraph` and renders `react-force-graph-2d`. Active links green, ceased links grey. Because `ForceGraph2D` uses canvas (no accessible DOM), the test mocks the library and asserts it receives the built `graphData`.

- [ ] **Step 1: Write the failing test** (mock the canvas library; assert graphData shape)

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

let captured = null;
vi.mock('react-force-graph-2d', () => ({
  default: (props) => { captured = props.graphData; return null; },
}));

import CompanyGraph from '../../src/panel/components/CompanyGraph.jsx';

describe('CompanyGraph', () => {
  it('passes built nodes/links to ForceGraph2D', () => {
    const company = {
      groupKey: 'H:M-1', name: 'ACME SA',
      officersActive: [{ name: 'JANE DOE', position: 'Consejero' }],
      officersResigned: [],
    };
    render(<CompanyGraph company={company} />);
    expect(captured.nodes.find((n) => n.type === 'company').label).toBe('ACME SA');
    expect(captured.links.length).toBe(1);
    expect(captured.links[0].status).toBe('active');
  });
});
```

- [ ] **Step 2: Run it; expect FAIL**

Run: `cd chrome-extension && npx vitest run test/panel/CompanyGraph.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/panel/components/CompanyGraph.jsx`**

```jsx
import React, { useMemo, useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { buildGraph } from '../../shared/buildGraph.js';

const ACTIVE = '#2ca02c';
const CEASED = '#bbbbbb';

export default function CompanyGraph({ company }) {
  const graphData = useMemo(() => buildGraph(company), [company]);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ height: 320, borderTop: '1px solid #eee' }}>
      <ForceGraph2D
        graphData={graphData}
        width={width}
        height={320}
        nodeLabel="label"
        nodeColor={(n) => (n.type === 'company' ? '#1a5fb4' : '#444')}
        nodeRelSize={5}
        linkColor={(l) => (l.status === 'active' ? ACTIVE : CEASED)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={80}
      />
    </div>
  );
}
```

> NOTE: `react-force-graph-2d` honors `linkDirectionalArrow*` only while no custom `linkCanvasObject` is set ([[project_forcegraph_arrows]]). v1 uses no custom link renderer, so the built-in arrows work. If a custom node renderer is added later, draw arrows manually.

- [ ] **Step 4: Run it; expect PASS**

Run: `cd chrome-extension && npx vitest run test/panel/CompanyGraph.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/panel/components/CompanyGraph.jsx chrome-extension/test/panel/CompanyGraph.test.jsx
git commit -m "feat(ext): CompanyGraph renders one-hop officer network"
```

---

### Task 10: App state machine + wiring (the full flow)

**Files:**
- Modify: `chrome-extension/src/panel/App.jsx`
- Create: `chrome-extension/src/panel/sendToWorker.js`
- Test: `chrome-extension/test/panel/App.test.jsx`

**Interfaces:**
- Consumes: MatchList, CompanyCard, CompanyGraph, i18n, `MSG`.
- Produces: `sendToWorker(message) → Promise<Response>` (thin `chrome.runtime.sendMessage` wrapper, injectable for tests). `App` accepts an optional `sendImpl` prop (defaults to `sendToWorker`) and an optional `initialSelection` prop for tests. States: `idle → loading → matches → company → error`. On a `SELECTION` runtime message it resolves; picking a match fetches the company.

- [ ] **Step 1: Write `src/panel/sendToWorker.js`**

```js
export function sendToWorker(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (resp) => resolve(resp));
  });
}
```

- [ ] **Step 2: Write the failing App test**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MSG } from '../../src/api/messages.js';
import App from '../../src/panel/App.jsx';

const company = {
  groupKey: 'H:M-1', name: 'TELEFONICA SA', nif: 'A1', capital: null, address: null,
  status: 'active', officersActive: [], officersResigned: [],
};

function sendImpl(msg) {
  if (msg.type === MSG.RESOLVE) return Promise.resolve({ type: 'matches',
    matches: [{ id: 'H:M-1', name: 'TELEFONICA SA', location: 'Madrid', nif: 'A1', isAlias: false }] });
  if (msg.type === MSG.GET_COMPANY) return Promise.resolve({ type: 'company', company });
  return Promise.resolve({ type: 'error', error: 'x' });
}

describe('App flow', () => {
  it('selection → matches → pick → company card', async () => {
    render(<App sendImpl={sendImpl} initialSelection="telefonica" />);
    await waitFor(() => screen.getByText('TELEFONICA SA'));
    fireEvent.click(screen.getByText('TELEFONICA SA'));
    await waitFor(() => screen.getByText('A1'));
    expect(screen.getByRole('link', { name: /perfil|profile/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it; expect FAIL**

Run: `cd chrome-extension && npx vitest run test/panel/App.test.jsx`
Expected: FAIL — App has no flow yet.

- [ ] **Step 4: Implement `src/panel/App.jsx`**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { MSG } from '../api/messages.js';
import { pickLocale, t } from './i18n.js';
import { sendToWorker } from './sendToWorker.js';
import MatchList from './components/MatchList.jsx';
import CompanyCard from './components/CompanyCard.jsx';
import CompanyGraph from './components/CompanyGraph.jsx';

export default function App({ sendImpl = sendToWorker, initialSelection = null }) {
  const locale = pickLocale(typeof navigator !== 'undefined' ? navigator.language : 'en');
  const [view, setView] = useState({ state: 'idle' });

  const resolve = useCallback(async (query) => {
    setView({ state: 'loading' });
    const resp = await sendImpl({ type: MSG.RESOLVE, query });
    if (resp?.type === 'matches') setView({ state: 'matches', matches: resp.matches });
    else setView({ state: 'error' });
  }, [sendImpl]);

  const pick = useCallback(async (match) => {
    setView({ state: 'loading' });
    const resp = await sendImpl({ type: MSG.GET_COMPANY, id: match.id });
    if (resp?.type === 'company') setView({ state: 'company', company: resp.company });
    else setView({ state: 'error' });
  }, [sendImpl]);

  // React to selections broadcast by the service worker.
  useEffect(() => {
    if (initialSelection) resolve(initialSelection);
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    const listener = (msg) => { if (msg?.type === MSG.SELECTION) resolve(msg.query); };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [initialSelection, resolve]);

  return (
    <div style={{ fontFamily: 'system-ui', fontSize: 14 }}>
      {view.state === 'idle' && (
        <p style={{ padding: 12, color: '#555' }}>
          {locale === 'es'
            ? 'Selecciona el nombre de una empresa española y usa el clic derecho → "Look up Spanish company".'
            : 'Select a Spanish company name, then right-click → "Look up Spanish company".'}
        </p>
      )}
      {view.state === 'loading' && <p style={{ padding: 12 }}>{t(locale, 'loading')}</p>}
      {view.state === 'error' && <p style={{ padding: 12, color: '#b00' }}>{t(locale, 'error')}</p>}
      {view.state === 'matches' && (
        <MatchList matches={view.matches} locale={locale} onPick={pick} />
      )}
      {view.state === 'company' && (
        <>
          <CompanyCard company={view.company} locale={locale} />
          <CompanyGraph company={view.company} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run it; expect PASS** (CompanyGraph's canvas lib is fine in jsdom because App renders it only after pick; if it errors, the test already mocks it via the Task 9 setup — add the same `vi.mock('react-force-graph-2d', …)` at the top of this test file returning `null`).

Run: `cd chrome-extension && npx vitest run test/panel/App.test.jsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `cd chrome-extension && npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add chrome-extension/src/panel/App.jsx chrome-extension/src/panel/sendToWorker.js chrome-extension/test/panel/App.test.jsx
git commit -m "feat(ext): wire selection → matches → company card + graph"
```

---

### Task 11: Manual end-to-end verification + privacy policy + store notes

**Files:**
- Create: `chrome-extension/PRIVACY.md`
- Create: `chrome-extension/README.md`

**Interfaces:** none (docs + manual verification).

- [ ] **Step 1: Build and reload**

Run: `cd chrome-extension && npm run build`
Then reload the unpacked extension in Chrome.

- [ ] **Step 2: Manual E2E (record results in README)**

Verify on three pages, selecting a company name and using right-click → "Look up Spanish company":
1. A news article mentioning a large company (e.g. "Telefónica") → match list → pick → card + graph.
2. A LinkedIn company page (select the company name) → resolves.
3. A page with a clearly non-company selection (e.g. "hello world") → localized "no matches", no crash.
Confirm: active officer links render green, ceased grey; the profile link opens `mapasocietario.es/empresa/...` in a new tab; no console errors; no UI injected into the page itself.

- [ ] **Step 3: Write `PRIVACY.md`**

```markdown
# Privacy Policy — Mapa Societario (Chrome extension)

This extension does not read the pages you visit and does not track you.

- It only runs when you explicitly select text and choose "Look up Spanish company"
  (or open the side panel).
- The text you select is sent to `https://api.ncdata.eu` solely to look up the matching
  Spanish company in public BORME (Registro Mercantil) data.
- No analytics, no cookies, no advertising identifiers, no data sold or shared.
- Company data shown is unofficial and provided as-is; see mapasocietario.es for the source
  and the official BORME.

Contact: anurnberg@nurnbergconsulting.com
```

- [ ] **Step 4: Write `README.md`** (build/load instructions + the E2E results table from Step 2)

```markdown
# Mapa Societario — Chrome extension

Select a Spanish company name on any page → right-click → "Look up Spanish company" →
side panel shows the registry card + officer network. Read-only, anonymous.

## Develop
    npm install
    npm run build        # outputs dist/
    npm test
Load `dist/` as an unpacked extension (chrome://extensions → Developer mode → Load unpacked).

## Manual E2E results
| Page | Selection | Result |
|------|-----------|--------|
| (fill in) | | |
```

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/PRIVACY.md chrome-extension/README.md
git commit -m "docs(ext): privacy policy, README, manual E2E results"
```

---

## Self-Review

**Spec coverage:**
- Selection-first trigger (context menu) → Task 4 ✓
- No in-page UI / chip deferred → manifest has no content script (Task 1), verified Task 11 ✓
- Match list disambiguation → Tasks 2, 6, 10 ✓
- Card + graph from same v3 doc → Tasks 3, 7, 8, 9 ✓
- Service-worker-owns-fetch / CORS bypass → Tasks 2–4, manifest host_permissions ✓
- Officer caps (40, board-first), group_key first → Tasks 3, 8 ✓
- Soft CTA, no DD upsell → Task 7 ✓
- ES/EN i18n → Task 5, used in 6/7/10 ✓
- Read-only/anonymous → only GET endpoints used; no auth headers anywhere ✓
- Privacy policy / store story → Task 11 ✓

**Deviations from spec (intentional, lower-risk):** The spec listed `/v3/expand-company` + `/v3/events` for the graph. Implementation instead builds the one-hop graph from `officers_active`/`officers_resigned` already present in the `/v3/company` doc — fewer calls, no component extraction, same result for v1. Multi-hop expansion (click an officer → expand) and event-date enrichment move to v2.

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `Match` (Task 2) `id` → `getCompany` arg (Task 3) → `MSG.GET_COMPANY.id` (Task 4) → `match.id` in App pick (Task 10) ✓. `CompanyDoc` shape consistent across Tasks 3/7/8/9. `buildGraph` output `{nodes, links}` consumed unchanged by Task 9 ✓.
