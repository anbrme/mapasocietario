# In-App "Full Company Page" Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the in-app company detail panel, show a "View full profile →" link to the company's `/empresa` SEO page — but only when that page actually resolves (curated + IBEX), never a 404.

**Architecture:** A pure `fullCompanyPageHref(name, lang)` reverse-indexes the curated + IBEX maps by `nameToSlug(v3Name) → slug` and returns the `/empresa` path (or `null`). The React panel renders a gated link from it. No backend/API/data change.

**Tech Stack:** React + MUI (existing app), Cloudflare Pages Functions ESM, Node.js built-in test runner, Vite build.

## Global Constraints

- **Never a 404:** the link renders only when `fullCompanyPageHref(...)` is non-null; non-resolving companies show no link and the panel is byte-identical to today.
- **Covers curated AND IBEX:** gate via a reverse index over `{ ...SEED, ...CURATED }` keyed by `nameToSlug(entry.v3Name)`. `resolveSlug(nameToSlug(name))` is WRONG (misses IBEX short slugs like `acciona`) — do not use it.
- **Pure, browser-safe imports:** the helper imports only `SEED` (`_ibex35.js`), `CURATED` (`_curated.js`), `nameToSlug` (`_slug.js`) — never `_lib.js`, no network.
- **Paths:** `lang === 'en' → '/en/company/' + slug`, else `'/empresa/' + slug` (relative).
- **Bilingual** via the in-app `uiLanguage` ('es'|'en'); link label "Ver ficha completa" (es) / "View full profile" (en); opens in a new tab (`target="_blank" rel="noopener"`).
- **Placement:** end of the Overview/"Resumen" section (immediately after its `</Paper>`).
- **Scope:** this link only — no universal `/empresa` coverage (the separate url-stability project), no connector change, no node/search-result links.
- **No new test framework:** `node:test` for the helper; the React link is verified with `npx vite build` + a manual in-app check.

---

## File Structure

- **Create** `functions/empresa/_page_href.js` — `fullCompanyPageHref(name, lang)` (reverse-lookup gate + path).
- **Create** `test/page-href.test.mjs` — helper unit tests.
- **Modify** `src/components/SpanishCompanyNetworkGraph.jsx` — import the helper + `OpenInNewIcon`; render the gated link after the Overview `</Paper>`.

---

## Task 1: `fullCompanyPageHref` helper

**Files:**
- Create: `functions/empresa/_page_href.js`
- Create: `test/page-href.test.mjs`

**Interfaces:**
- Consumes: `SEED` (`./_ibex35.js`), `CURATED` (`./_curated.js`), `nameToSlug` (`./_slug.js`).
- Produces: `fullCompanyPageHref(name: string, lang?: 'es'|'en') → string | null` — the `/empresa` (es) or `/en/company` (en) path for a curated/IBEX company, else `null`.

- [ ] **Step 1: Write the failing test**

Create `test/page-href.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fullCompanyPageHref } from '../functions/empresa/_page_href.js';

test('curated company resolves to its /empresa path (es + en)', () => {
  assert.equal(fullCompanyPageHref('NURNBERG CONSULTING SL', 'es'), '/empresa/nurnberg-consulting-sl');
  assert.equal(fullCompanyPageHref('NURNBERG CONSULTING SL', 'en'), '/en/company/nurnberg-consulting-sl');
});

test('IBEX seed company resolves to its short seed slug via reverse lookup', () => {
  assert.equal(fullCompanyPageHref('ACCIONA SA', 'es'), '/empresa/acciona');
});

test('non-curated company has no page → null', () => {
  assert.equal(fullCompanyPageHref('Surya Consulting SL', 'es'), null);
});

test('empty/nullish name → null', () => {
  assert.equal(fullCompanyPageHref('', 'es'), null);
  assert.equal(fullCompanyPageHref(null, 'es'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/page-href.test.mjs`
Expected: FAIL — `Cannot find module '../functions/empresa/_page_href.js'`.

- [ ] **Step 3: Write the helper**

Create `functions/empresa/_page_href.js`:

```javascript
/**
 * Resolve an in-app company name to its public /empresa page path, or null if
 * no such page exists. The /empresa route only serves curated (CURATED) and
 * IBEX (SEED) companies; everything else 404s. CURATED keys equal
 * nameToSlug(name), but SEED keys are short hand-chosen slugs (e.g. 'acciona'),
 * so we reverse-index BOTH maps by nameToSlug(v3Name) -> slug and look the
 * company up there. Pure; safe to import into the SPA bundle (no _lib.js, no
 * network). The `_` prefix means Cloudflare Pages does not route this file.
 */
import { SEED } from './_ibex35.js';
import { CURATED } from './_curated.js';
import { nameToSlug } from './_slug.js';

// nameToSlug(v3Name) -> public slug, for every company that has an /empresa page.
const SLUG_BY_NAME = (() => {
  const index = {};
  for (const [slug, entry] of Object.entries({ ...SEED, ...CURATED })) {
    if (entry && entry.v3Name) index[nameToSlug(entry.v3Name)] = slug;
  }
  return index;
})();

export function fullCompanyPageHref(name, lang = 'es') {
  const key = nameToSlug(name);
  if (!key) return null;
  const slug = SLUG_BY_NAME[key];
  if (!slug) return null;
  return lang === 'en' ? `/en/company/${slug}` : `/empresa/${slug}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/page-href.test.mjs`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add functions/empresa/_page_href.js test/page-href.test.mjs
git commit -m "feat(empresa): fullCompanyPageHref — gated /empresa path by company name"
```

---

## Task 2: Render the gated link in the in-app panel

**Files:**
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` (two imports near the top; one `const` + one JSX block in the company detail panel)

**Interfaces:**
- Consumes: `fullCompanyPageHref` (Task 1); `previewData.name` and `uiLanguage` (already in scope in the detail panel render).

- [ ] **Step 1: Add the imports**

In `src/components/SpanishCompanyNetworkGraph.jsx`:
- Add to the individual `@mui/icons-material` imports (the group around lines 75–84):

```javascript
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
```

- Add next to the existing `functions/empresa` imports (the `CONFIRMATIONS` / `nameToSlug` lines, ~108–109):

```javascript
import { fullCompanyPageHref } from '../../functions/empresa/_page_href.js';
```

- [ ] **Step 2: Compute the href in the panel render scope**

The company detail panel's overview render returns a `<Box>` (the line `return (` immediately followed by `<Box>` and `{/* Overview section */}`, ~line 7862). On the line immediately **above** that `return (`, add:

```javascript
                  const fullHref = fullCompanyPageHref(previewData.name, uiLanguage);
```

(`previewData` and `uiLanguage` are already used inside this render, so they are in scope.)

- [ ] **Step 3: Render the gated link after the Overview Paper**

The Overview section is a `<Paper variant="outlined" sx={{ p: 2, mb: 3 }}>` (opens ~line 7876) that closes with `</Paper>` (~line 7993). Immediately **after** that `</Paper>`, insert:

```jsx
                  {fullHref && (
                    <Typography
                      component="a"
                      href={fullHref}
                      target="_blank"
                      rel="noopener"
                      variant="body2"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mb: 3,
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {uiLanguage === 'en' ? 'View full profile' : 'Ver ficha completa'}
                      <OpenInNewIcon sx={{ fontSize: 16 }} />
                    </Typography>
                  )}
```

Make ONLY these changes (two imports, one `const`, one JSX block). Do not alter any other logic in the file.

- [ ] **Step 4: Verify the bundle compiles**

Run: `npx vite build`
Expected: build completes with no errors and no unresolved import for `_page_href.js`. (`npx vite build` bypasses the npm `prebuild` network gates.)

- [ ] **Step 5: Commit**

```bash
git add src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat(app): link from in-app company panel to its full /empresa page"
```

- [ ] **Step 6: Manual in-app verification (record result; not a code gate)**

Run the app (`npm run dev` or a preview deploy). Search the seeded company (Nürnberg), open its detail panel: a "Ver ficha completa →" link appears at the end of the Overview section and opens `/empresa/nurnberg-consulting-sl` in a new tab. Switch the UI to English → "View full profile". Open an IBEX company (e.g. Acciona) → link present, opens `/empresa/acciona`. Open a non-curated company → no link. Note the outcome in the report.

---

## Self-Review

**Spec coverage:**
- §2 behavior (gated link, end of Overview, new tab, bilingual) → Task 2.
- §3 reverse-lookup helper (covers curated + IBEX; pure imports) → Task 1.
- §5 tests (helper node:test incl. the IBEX case; manual React check) → Tasks 1–2.
- §6 out of scope → nothing else touched.

**Placeholder scan:** none — every step has complete code or an exact command.

**Type consistency:** `fullCompanyPageHref(name, lang) → string|null` defined in Task 1, consumed in Task 2 Step 2/3. `previewData.name` / `uiLanguage` are the confirmed in-scope panel variables. The IBEX expectation (`'ACCIONA SA' → '/empresa/acciona'`) and the reverse-index construction match the verified SEED data (`SEED.acciona.v3Name === 'ACCIONA SA'`).
