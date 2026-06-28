# In-App Currency Confirmation Surfacing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the currency-confirmation as a dark-theme card at the top of the in-app selected-company detail panel, so searchers in `/app` see it (today it only appears on the SEO `/empresa` pages).

**Architecture:** Reuse the existing decay logic and copy from `functions/empresa/_confirmation.js`; add a pure `confirmationViewModel` that both the existing HTML renderer and a new thin MUI component consume (so the two surfaces can never drift). The SPA imports the confirmation data and the view model directly at build time — no API or backend change.

**Tech Stack:** React + MUI (existing app), Cloudflare Pages Functions ESM (existing), Node.js built-in test runner (`node:test`), Vite build.

## Global Constraints

- **One source of truth for logic + copy:** `confirmationViewModel` is consumed by BOTH `renderConfirmationBlock` (SEO HTML) and the new React card. Decay thresholds stay `fresh ≤ 90d`, `aging 91–365d`, `stale > 365d` — unchanged.
- **No drift / no behavior change to shipped code:** the existing 12 confirmation tests, `test/resolve.test.mjs`, and `test/confirmation-render.test.mjs` MUST stay green after the refactor and the `nameToSlug` extraction.
- **Render only when a record exists:** the card returns `null` (and `confirmationViewModel` returns `null`) when there is no valid confirmation for the company — every other company's panel is byte-identical to today.
- **Bilingual:** the card uses the in-app `uiLanguage` (`'es'` | `'en'`).
- **Build-time data, no backend:** the SPA imports `CONFIRMATIONS` (`functions/empresa/_confirmations.js`), `confirmationViewModel` (`functions/empresa/_confirmation.js`), and `nameToSlug` (`functions/empresa/_slug.js`). No API/network/new data store.
- **Single shared slug helper:** `nameToSlug` lives in `functions/empresa/_slug.js`; `_lib.js` imports it (it has no external importers today). No duplicated slug logic.
- **Scope:** in-app **detail panel only** — no graph-node marker, no search-result marker, no new confirmation record/company.
- **No new test framework:** React rendering is verified with `npx vite build` (compiles the bundle, catching import/JSX errors, and skips the npm `prebuild` network gates) plus a manual in-app check. `node:test` covers the pure logic only.

---

## File Structure

- **Create** `functions/empresa/_slug.js` — the single `nameToSlug(name)` helper (moved out of `_lib.js` so the SPA can import it without dragging in the server renderer).
- **Create** `src/components/CurrencyConfirmationCard.jsx` — thin dark-theme MUI card; all logic via `confirmationViewModel`.
- **Create** `test/slug.test.mjs` — `nameToSlug` unit tests.
- **Modify** `functions/empresa/_confirmation.js` — export `CONFIRMATION_I18N`, add `confirmationViewModel`, rewire `renderConfirmationBlock` through it.
- **Modify** `functions/empresa/_lib.js` — drop the local `nameToSlug`, import it from `_slug.js`.
- **Modify** `src/components/SpanishCompanyNetworkGraph.jsx` — import the card + data + slug helper; render the card at the top of the company detail panel.
- **Modify** `test/confirmation.test.mjs` — add `confirmationViewModel` tests.

---

## Task 1: Extract `nameToSlug` into a shared `_slug.js`

The SPA needs `nameToSlug` to map a selected company's name to a confirmation slug. It currently lives in `_lib.js` (a 1,100-line server renderer that pulls in `SEED`/`resolveSlug`), which we don't want in the browser bundle. Move it to a tiny shared module. It has no external importers today, so this is behavior-preserving.

**Files:**
- Create: `functions/empresa/_slug.js`
- Create: `test/slug.test.mjs`
- Modify: `functions/empresa/_lib.js` (remove local def at lines 39–49; add an import)

**Interfaces:**
- Produces: `nameToSlug(name: string) → string` — identical behavior to the current `_lib.js` implementation.

- [ ] **Step 1: Write the failing test**

Create `test/slug.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToSlug } from '../functions/empresa/_slug.js';

test('uppercase company name maps to the curated slug', () => {
  assert.equal(nameToSlug('NURNBERG CONSULTING SL'), 'nurnberg-consulting-sl');
});

test('accents and ñ are folded', () => {
  assert.equal(nameToSlug('Construcciones Peña S.A.'), 'construcciones-pena-s-a');
});

test('ampersand becomes y; runs of separators collapse', () => {
  assert.equal(nameToSlug('A & B   SL'), 'a-y-b-sl');
});

test('empty/nullish input is the empty string', () => {
  assert.equal(nameToSlug(''), '');
  assert.equal(nameToSlug(null), '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/slug.test.mjs`
Expected: FAIL — `Cannot find module '../functions/empresa/_slug.js'`.

- [ ] **Step 3: Create `_slug.js` (verbatim move of the existing implementation)**

Create `functions/empresa/_slug.js`:

```javascript
/**
 * The canonical company-name → URL-slug function, shared by the server page
 * renderer (_lib.js) and the SPA (which matches a selected company to a
 * curated confirmation by slug). Kept in its own tiny module so the browser
 * bundle does not import the whole _lib.js server renderer. The `_` prefix
 * means Cloudflare Pages does not route this file.
 */
export function nameToSlug(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/gi, 'n')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/slug.test.mjs`
Expected: PASS (4/4).

- [ ] **Step 5: Rewire `_lib.js` to import from `_slug.js`**

In `functions/empresa/_lib.js`, **delete** the local definition (the block beginning `export function nameToSlug(name) {` through its closing `}`, currently lines ~39–49). Then add, next to the existing imports at the top of the file (after `import { resolveSlug } from './_resolve.js';`):

```javascript
import { nameToSlug } from './_slug.js';
```

(No re-export is needed — `nameToSlug` has no importers outside `_lib.js`, and `_lib.js` uses it internally at the `renamedTo`/`companyUrl` call sites, which now resolve through the import.)

- [ ] **Step 6: Verify no regression across the whole suite**

Run: `node --test test/slug.test.mjs test/resolve.test.mjs test/confirmation.test.mjs test/confirmation-render.test.mjs`
Expected: PASS, 0 failures (the SEO renderer in `confirmation-render` exercises `nameToSlug` internally, proving the import works).

- [ ] **Step 7: Commit**

```bash
git add functions/empresa/_slug.js functions/empresa/_lib.js test/slug.test.mjs
git commit -m "refactor(empresa): extract nameToSlug into shared _slug.js"
```

---

## Task 2: `confirmationViewModel` + exported i18n; rewire `renderConfirmationBlock`

Add a pure view model so the React card carries no logic, and route the existing HTML renderer through it so the SEO page and the in-app card can never diverge.

**Files:**
- Modify: `functions/empresa/_confirmation.js`
- Modify: `test/confirmation.test.mjs`

**Interfaces:**
- Consumes: `confirmationStatus` (existing).
- Produces:
  - `CONFIRMATION_I18N` — the exported i18n table (was the private `I18N`).
  - `confirmationViewModel(rec, lang?: 'es'|'en', nowMs?: number) → { title, level: 'fresh'|'aging'|'stale', statusLine, asOf: string|null, facts: Array<{label, status:'current'|'none', chipLabel}>, disclaimer } | null`. Returns `null` for a missing/invalid record or unparseable date. Strings are **unescaped** (React escapes; the HTML renderer escapes at its sink).
  - `renderConfirmationBlock` — unchanged signature/output, now implemented via `confirmationViewModel`.

- [ ] **Step 1: Write the failing test**

Append to `test/confirmation.test.mjs`:

```javascript
import { confirmationViewModel } from '../functions/empresa/_confirmation.js';

const VM_REC = {
  confirmedAt: '2026-06-28',
  representative: 'Alessandro Nürnberg',
  role: 'Administrador único',
  affirms: [
    { label: 'Administrador único: Alessandro Nürnberg', status: 'current' },
    { label: 'Situación concursal', status: 'none' },
  ],
};
const atMs = (iso, days) => Date.parse(iso + 'T00:00:00Z') + days * 86_400_000;

test('viewModel: missing/invalid record returns null', () => {
  assert.equal(confirmationViewModel(null, 'es'), null);
  assert.equal(confirmationViewModel({ confirmedAt: 'x', representative: 'Bob' }, 'es'), null);
});

test('viewModel: fresh ES has level, named status line, mapped facts, disclaimer', () => {
  const vm = confirmationViewModel(VM_REC, 'es', atMs('2026-06-28', 3));
  assert.equal(vm.level, 'fresh');
  assert.match(vm.statusLine, /Confirmado actual por Alessandro Nürnberg/);
  assert.match(vm.statusLine, /hace 3 días/);
  assert.equal(vm.title, 'Confirmación de vigencia');
  assert.equal(vm.facts.length, 2);
  assert.deepEqual(
    vm.facts.map((f) => f.status),
    ['current', 'none'],
  );
  assert.equal(vm.facts[1].chipLabel, 'sin constancia');
  assert.match(vm.asOf, /a fecha 28\/06\/2026/);
  assert.match(vm.disclaimer, /verifica la autoridad del representante/);
});

test('viewModel: stale uses the aged line and has no asOf when no facts', () => {
  const vm = confirmationViewModel(
    { confirmedAt: '2026-06-28', representative: 'X', affirms: [] },
    'es',
    atMs('2026-06-28', 400),
  );
  assert.equal(vm.level, 'stale');
  assert.match(vm.statusLine, /Última confirmación hace 400 días/);
  assert.equal(vm.asOf, null);
  assert.equal(vm.facts.length, 0);
});

test('viewModel: EN copy', () => {
  const vm = confirmationViewModel(VM_REC, 'en', atMs('2026-06-28', 1));
  assert.equal(vm.title, 'Currency confirmation');
  assert.match(vm.statusLine, /1 day ago/);
  assert.equal(vm.facts[0].chipLabel, 'current');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/confirmation.test.mjs`
Expected: FAIL — `confirmationViewModel` is not exported.

- [ ] **Step 3: Export the i18n table and add `confirmationViewModel`**

In `functions/empresa/_confirmation.js`, change the i18n declaration from `const I18N = {` to:

```javascript
export const CONFIRMATION_I18N = {
```

(keep the object contents identical). Then add, immediately after the `CONFIRMATION_I18N` object:

```javascript
// Render-ready view model shared by the SEO HTML renderer and the in-app React
// card. Strings are UNESCAPED (React escapes; the HTML renderer escapes at its
// sink). null when there is nothing to show.
export function confirmationViewModel(rec, lang = 'es', nowMs = Date.now()) {
  if (!rec || !rec.confirmedAt || !rec.representative) return null;
  const st = confirmationStatus(rec.confirmedAt, nowMs);
  if (!st) return null;
  const t = CONFIRMATION_I18N[lang] || CONFIRMATION_I18N.es;

  const statusLine =
    st.level === 'fresh'
      ? t.fresh(rec.representative, rec.role || '', st.ageDays)
      : t.aged(st.ageDays);

  const facts = (rec.affirms || []).map((f) => ({
    label: f.label,
    status: f.status === 'none' ? 'none' : 'current',
    chipLabel: f.status === 'none' ? t.chipNone : t.chipCurrent,
  }));

  return {
    title: t.title,
    level: st.level,
    statusLine,
    asOf: facts.length ? t.asOf(fmtDate(rec.confirmedAt, lang)) : null,
    facts,
    disclaimer: t.disclaimer,
  };
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `node --test test/confirmation.test.mjs`
Expected: the four `viewModel:` tests PASS. (The 12 existing tests still pass — `renderConfirmationBlock` is unchanged so far.)

- [ ] **Step 5: Rewire `renderConfirmationBlock` through the view model**

In `functions/empresa/_confirmation.js`, replace the entire body of `renderConfirmationBlock` with:

```javascript
// Decaying, registry-anchored confirmation panel. '' when there is nothing to show.
export function renderConfirmationBlock(rec, lang = 'es', nowMs = Date.now()) {
  const vm = confirmationViewModel(rec, lang, nowMs);
  if (!vm) return '';

  const facts = vm.facts
    .map((f) => {
      const cls = f.status === 'none' ? 'cc-chip cc-none' : 'cc-chip cc-cur';
      return `<li>${esc(f.label)} <span class="${cls}">${esc(f.chipLabel)}</span></li>`;
    })
    .join('');

  return `<section class="cc cc-${vm.level}" aria-label="${esc(vm.title)}">
    <div class="cc-head"><span class="cc-dot"></span><strong>${esc(vm.title)}</strong></div>
    <p class="cc-line">${esc(vm.statusLine)}</p>
    ${vm.asOf ? `<p class="cc-asof">${esc(vm.asOf)}</p><ul class="cc-facts">${facts}</ul>` : ''}
    <p class="cc-prov">${esc(vm.disclaimer)}</p>
  </section>`;
}
```

(The `esc`, `fmtDate`, `confirmationStatus` helpers are unchanged and still used — `fmtDate` now only via the view model, `esc` here.)

- [ ] **Step 6: Verify the full confirmation suite stays green**

Run: `node --test test/confirmation.test.mjs test/confirmation-render.test.mjs`
Expected: PASS — all prior `renderConfirmationBlock` / integration assertions still hold (proves the rewire is output-identical), plus the new view-model tests.

- [ ] **Step 7: Commit**

```bash
git add functions/empresa/_confirmation.js test/confirmation.test.mjs
git commit -m "refactor(empresa): add confirmationViewModel; route HTML renderer through it"
```

---

## Task 3: `CurrencyConfirmationCard` + inject into the in-app company panel

Create the dark-theme MUI card and render it at the top of the selected-company detail panel in the graph component. (Component + injection are one task: an orphan component can't be build-verified — `vite build` only compiles reachable modules — so they ship together.)

**Files:**
- Create: `src/components/CurrencyConfirmationCard.jsx`
- Modify: `src/components/SpanishCompanyNetworkGraph.jsx` (imports near the top; one element in the detail panel at ~line 7863)

**Interfaces:**
- Consumes: `confirmationViewModel` (`functions/empresa/_confirmation.js`), `CONFIRMATIONS` (`functions/empresa/_confirmations.js`), `nameToSlug` (`functions/empresa/_slug.js`).
- Produces: `<CurrencyConfirmationCard rec={...} lang={...} />` — renders `null` when `rec` has no valid confirmation.

- [ ] **Step 1: Create the card component**

Create `src/components/CurrencyConfirmationCard.jsx`:

```jsx
import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import { confirmationViewModel } from '../../functions/empresa/_confirmation.js';

// Decay-level → dark-theme accent (tuned for the #0a0e1a app background).
const LEVEL_STYLE = {
  fresh: { border: '#2e7d32', bg: 'rgba(46,125,50,0.12)', dot: '#4caf50' },
  aging: { border: '#b88300', bg: 'rgba(184,131,0,0.14)', dot: '#ffb300' },
  stale: { border: '#5b6472', bg: 'rgba(91,100,114,0.14)', dot: '#90a4ae' },
};

/**
 * In-app currency-confirmation card. Mirrors the SEO-page panel but themed for
 * the dark canvas. All logic is in confirmationViewModel (shared with the HTML
 * renderer); this component only maps the view model to MUI. Renders nothing
 * when there is no valid confirmation for the company.
 */
export default function CurrencyConfirmationCard({ rec, lang = 'es' }) {
  const vm = confirmationViewModel(rec, lang);
  if (!vm) return null;
  const s = LEVEL_STYLE[vm.level] || LEVEL_STYLE.fresh;

  return (
    <Box
      sx={{
        border: `1px solid ${s.border}`,
        bgcolor: s.bg,
        borderRadius: 2,
        p: 1.5,
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <VerifiedIcon sx={{ fontSize: 18, color: s.dot }} />
        <Typography
          variant="caption"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}
        >
          {vm.title}
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {vm.statusLine}
      </Typography>

      {vm.asOf && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 0.5 }}>
            {vm.asOf}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {vm.facts.map((f, i) => (
              <Chip
                key={i}
                size="small"
                label={`${f.label} · ${f.chipLabel}`}
                color={f.status === 'none' ? 'default' : 'success'}
                variant={f.status === 'none' ? 'outlined' : 'filled'}
              />
            ))}
          </Box>
        </>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {vm.disclaimer}
      </Typography>
    </Box>
  );
}
```

- [ ] **Step 2: Add imports to the graph component**

In `src/components/SpanishCompanyNetworkGraph.jsx`, add to the import block at the top of the file:

```javascript
import CurrencyConfirmationCard from './CurrencyConfirmationCard.jsx';
import { CONFIRMATIONS } from '../../functions/empresa/_confirmations.js';
import { nameToSlug } from '../../functions/empresa/_slug.js';
```

- [ ] **Step 3: Inject the card at the top of the detail panel**

In `src/components/SpanishCompanyNetworkGraph.jsx`, the company detail panel returns a `<Box>` immediately followed by the Overview section (currently ~lines 7862–7868):

```jsx
              return (
                <Box>
                  {/* Overview section */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
```

Insert the card as the first child of that `<Box>`, before the `{/* Overview section */}` comment:

```jsx
              return (
                <Box>
                  <CurrencyConfirmationCard
                    rec={CONFIRMATIONS[nameToSlug(previewData.name)]}
                    lang={uiLanguage}
                  />
                  {/* Overview section */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
```

(`previewData.name` is the company's display name used in this panel; `uiLanguage` is the in-app `'es'|'en'` value — both are already in scope here. The card self-suppresses when `CONFIRMATIONS[...]` is `undefined`, so the lookup is unconditional and every non-seeded company is unaffected.)

- [ ] **Step 4: Verify the bundle compiles (catches import/JSX errors, skips network gates)**

Run: `npx vite build`
Expected: build completes with no errors. (`npx vite build` invokes Vite directly, bypassing the npm `prebuild` hook, so the live API gates do not run.) Confirm the build output mentions no unresolved imports for `_confirmations.js`, `_confirmation.js`, or `_slug.js`.

- [ ] **Step 5: Commit**

```bash
git add src/components/CurrencyConfirmationCard.jsx src/components/SpanishCompanyNetworkGraph.jsx
git commit -m "feat(app): surface currency-confirmation card in the in-app company panel"
```

- [ ] **Step 6: Manual in-app verification (record result; not a code gate)**

Run the app (`npm run dev`, or a preview deploy) and open the search canvas. Search the seeded company, open its detail panel, and confirm: a green confirmation card sits at the top of the panel (above the "Resumen"/Overview section), with the verified icon, the "Confirmado actual por …" line, the affirmed-fact chips, and the provenance disclaimer. Switch the UI to English and confirm the card reads in English. Open a different company and confirm **no** card appears. Note the outcome in the task report.

---

## Self-Review

**Spec coverage:**
- §2 reuse-logic/re-skin → Task 2 (`confirmationViewModel` shared) + Task 3 (MUI card).
- §3 data flow (build-time import, slug lookup, gating) → Task 3 Step 3; slug helper → Task 1.
- §4.1 `confirmationViewModel` + exported `CONFIRMATION_I18N` + renderer rewired through it → Task 2.
- §4.2 `CurrencyConfirmationCard.jsx` (icon, status line, chips, disclaimer, dark theme) → Task 3 Step 1.
- §4.3 injection above the facts at ~7890 → Task 3 Step 3 (top of the panel `<Box>`, above the Overview/facts).
- §5 testing (viewModel node:test; existing tests stay green; manual React) → Tasks 1–3.
- §6 out of scope → nothing built beyond the detail-panel card.
- §7 Q1 (the name field) → resolved: `previewData.name`.

**Placeholder scan:** none — every step carries complete code or an exact command.

**Type consistency:** `confirmationViewModel` returns `{title, level, statusLine, asOf, facts:[{label,status,chipLabel}], disclaimer}` in Task 2 and is consumed identically by the HTML renderer (Task 2 Step 5) and the card (Task 3 Step 1). `nameToSlug(name)→string` (Task 1) is consumed in Task 3 Step 3. `CONFIRMATIONS[slug]` shape matches the Phase-1 record. `previewData.name` / `uiLanguage` are the confirmed in-scope panel variables.
