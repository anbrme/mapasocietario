# Company Currency Confirmation — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a decaying, registry-anchored "currency confirmation" panel on the Nürnberg Consulting SL company page (`/empresa/nurnberg-consulting-sl` + `/en/company/...`), sourced from a hand-authored record, proving the concept on an audience of one.

**Architecture:** A curated slug-keyed `CONFIRMATIONS` map (mirroring the existing `_curated.js` pattern) holds one representative's dated confirmation. A small self-contained module `_confirmation.js` computes the confirmation's decaying status (fresh/aging/stale) and renders the panel HTML. `_lib.js` (the shared ES/EN page renderer) injects that panel **above** the registry data, never merging with it. A build-time gate validates that every confirmation's named representative is a *current officer in BORME* — the authority anchor, enforced mechanically.

**Tech Stack:** Cloudflare Pages Functions (ESM, `type: module`), Node.js built-in test runner (`node:test` + `node:assert/strict`), no framework. Live data from `https://api.ncdata.eu`.

## Global Constraints

- **Never overwrite the registry.** The confirmation panel renders as its own `<section>` ABOVE `Datos registrales`; BORME-derived fields are untouched. (Spec §3.4)
- **"The company asserts," never "the platform vouches."** Every panel carries the provenance disclaimer; we verify the representative's *authority*, not the *truth* of each claim. (Spec §3.4)
- **No confirmation → page unchanged.** `renderConfirmationBlock` returns `''` for any slug without a record; all other company pages render exactly as today. (Spec §6.2)
- **Bilingual.** Every user-facing string exists in both `es` and `en`. (Spec §6.2)
- **Decay thresholds:** `fresh` ≤ 90 days, `aging` 91–365 days, `stale` > 365 days, measured from `confirmedAt` to render time. (Spec §3.1, §9 Q1)
- **Authority anchor:** a confirmation's `representative` MUST match a name in the company's live `officers_active`. Enforced by `scripts/check-confirmations.mjs` in `prebuild`. (Spec §3.4, §6.4)
- **Phase 1 only:** no backend, no auth, no admin UI, no claim/onboarding flow, no viewer "request a confirmation" button, no monetization. Currency only — no completion/affirmation layers. (Spec §8)
- **Follow existing patterns:** `_`-prefixed un-routed modules under `functions/empresa/`, `node --test test/<name>.test.mjs`, build gates as `scripts/check-*.mjs` added to the `prebuild` npm script.

---

## File Structure

- **Create** `functions/empresa/_confirmation.js` — pure logic + render for the confirmation panel: `confirmationStatus`, `tokens`, `nameIsOfficer`, `renderConfirmationBlock`. Self-contained (own `esc`/i18n) to stay independently testable and avoid a circular import with `_lib.js`.
- **Create** `functions/empresa/_confirmations.js` — the curated `CONFIRMATIONS` data map (one entry: Nürnberg).
- **Create** `scripts/check-confirmations.mjs` — build gate (slug resolves + representative is a current officer).
- **Create** `test/confirmation.test.mjs` — unit tests for `_confirmation.js`.
- **Modify** `functions/empresa/_curated.js` — add the `nurnberg-consulting-sl` entry so the page resolves (200 instead of 404).
- **Modify** `functions/empresa/_lib.js` — import + inject `renderConfirmationBlock`; add panel CSS to `STYLE`.
- **Modify** `test/resolve.test.mjs` — assert the new curated slug resolves.
- **Modify** `package.json` — add the gate to `prebuild`.

---

## Task 1: Curated resolution for Nürnberg Consulting

Without this the page 404s (`resolveSlug` returns `notfound` for any slug outside `SEED`/`CURATED`). Real value confirmed against the live index: stored name is `NURNBERG CONSULTING SL`, slug is `nurnberg-consulting-sl`.

**Files:**
- Modify: `functions/empresa/_curated.js`
- Test: `test/resolve.test.mjs`

**Interfaces:**
- Consumes: `resolveSlug(slug)` from `_resolve.js` → `{kind:'seed'|'curated'|'notfound', entry}`.
- Produces: a `CURATED['nurnberg-consulting-sl']` entry `{ name, v3Name }` that later tasks (and the build gate) resolve against.

- [ ] **Step 1: Write the failing test**

Add to `test/resolve.test.mjs`:

```javascript
test('nurnberg consulting resolves as curated with its v3Name', () => {
  const r = resolveSlug('nurnberg-consulting-sl');
  assert.equal(r.kind, 'curated');
  assert.equal(r.entry.v3Name, 'NURNBERG CONSULTING SL');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/resolve.test.mjs`
Expected: FAIL — the new test reports `notfound`/`undefined` (entry is null).

- [ ] **Step 3: Add the curated entry**

In `functions/empresa/_curated.js`, add inside `CURATED`:

```javascript
  'nurnberg-consulting-sl':          { name: 'Nürnberg Consulting', v3Name: 'NURNBERG CONSULTING SL' },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/resolve.test.mjs`
Expected: PASS (all cases).

- [ ] **Step 5: Verify the entry resolves against the live index**

Run: `node scripts/check-curated.mjs`
Expected: a line `✓ nurnberg-consulting-sl → NURNBERG CONSULTING SL` and `All N curated entries resolve.` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add functions/empresa/_curated.js test/resolve.test.mjs
git commit -m "feat(empresa): curate Nürnberg Consulting so its page resolves"
```

---

## Task 2: `confirmationStatus` — decaying age/level (pure)

**Files:**
- Create: `functions/empresa/_confirmation.js`
- Test: `test/confirmation.test.mjs`

**Interfaces:**
- Produces: `confirmationStatus(confirmedAt: string /* 'YYYY-MM-DD' */, nowMs?: number) → { ageDays: number, level: 'fresh'|'aging'|'stale' } | null`. Returns `null` on an unparseable date.

- [ ] **Step 1: Write the failing test**

Create `test/confirmation.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationStatus } from '../functions/empresa/_confirmation.js';

const DAY = 86_400_000;
const at = (iso, days) => Date.parse(iso + 'T00:00:00Z') + days * DAY;

test('same-day confirmation is fresh, age 0', () => {
  const s = confirmationStatus('2026-06-28', at('2026-06-28', 0));
  assert.deepEqual(s, { ageDays: 0, level: 'fresh' });
});

test('90 days is still fresh, 91 days flips to aging', () => {
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 90)).level, 'fresh');
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 91)).level, 'aging');
});

test('365 days is aging, 366 days flips to stale', () => {
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 365)).level, 'aging');
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', 366)).level, 'stale');
});

test('future or unparseable dates: never negative age; null on garbage', () => {
  assert.equal(confirmationStatus('2026-06-28', at('2026-06-28', -5)).ageDays, 0);
  assert.equal(confirmationStatus('not-a-date', Date.now()), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/confirmation.test.mjs`
Expected: FAIL — `Cannot find module '../functions/empresa/_confirmation.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `functions/empresa/_confirmation.js`:

```javascript
/**
 * Currency-confirmation logic + rendering for the public company pages.
 * Self-contained (own esc/i18n) so it stays unit-testable and never imports
 * from _lib.js (which imports this — a cycle). The `_` prefix means Cloudflare
 * Pages does not route this file.
 */

const DAY_MS = 86_400_000;

// Age (whole days, never negative) of a 'YYYY-MM-DD' confirmation at nowMs,
// mapped to a decay level. null if the date can't be parsed.
export function confirmationStatus(confirmedAt, nowMs = Date.now()) {
  const t = Date.parse(`${confirmedAt}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  const ageDays = Math.max(0, Math.floor((nowMs - t) / DAY_MS));
  const level = ageDays <= 90 ? 'fresh' : ageDays <= 365 ? 'aging' : 'stale';
  return { ageDays, level };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/confirmation.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/empresa/_confirmation.js test/confirmation.test.mjs
git commit -m "feat(empresa): confirmationStatus decay (fresh/aging/stale)"
```

---

## Task 3: `nameIsOfficer` — registry-officer-match (pure)

The mechanical authority anchor. The build gate (Task 6) uses it to reject any confirmation whose representative is not a current BORME officer. Matching is accent/order/punctuation-insensitive and subset-based (the representative's tokens must all appear in an officer's name), so `Alessandro Nürnberg` matches `NURNBERG ALESSANDRO`.

**Files:**
- Modify: `functions/empresa/_confirmation.js`
- Test: `test/confirmation.test.mjs`

**Interfaces:**
- Produces: `tokens(name: string) → string[]` (normalized, accent-stripped, uppercased word tokens) and `nameIsOfficer(repName: string, officerNames: string[]) → boolean`.

- [ ] **Step 1: Write the failing test**

Append to `test/confirmation.test.mjs`:

```javascript
import { nameIsOfficer } from '../functions/empresa/_confirmation.js';

test('representative matches officer across order and accents', () => {
  assert.equal(nameIsOfficer('Alessandro Nürnberg', ['NURNBERG ALESSANDRO']), true);
});

test('representative is a subset of a longer officer name', () => {
  assert.equal(nameIsOfficer('Alessandro Nürnberg', ['NURNBERG ALESSANDRO GIOVANNI']), true);
});

test('non-officer and empty inputs do not match', () => {
  assert.equal(nameIsOfficer('María López', ['NURNBERG ALESSANDRO']), false);
  assert.equal(nameIsOfficer('', ['NURNBERG ALESSANDRO']), false);
  assert.equal(nameIsOfficer('Alessandro Nürnberg', []), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/confirmation.test.mjs`
Expected: FAIL — `nameIsOfficer` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `functions/empresa/_confirmation.js`:

```javascript
// Accent/punctuation-insensitive uppercase word tokens.
export function tokens(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// True if every token of repName appears in at least one officer's token set.
export function nameIsOfficer(repName, officerNames) {
  const rep = tokens(repName);
  if (!rep.length) return false;
  return (officerNames || []).some((o) => {
    const set = new Set(tokens(o));
    return rep.every((tk) => set.has(tk));
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/confirmation.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/empresa/_confirmation.js test/confirmation.test.mjs
git commit -m "feat(empresa): nameIsOfficer registry-officer-match helper"
```

---

## Task 4: `renderConfirmationBlock` — the panel HTML

**Files:**
- Modify: `functions/empresa/_confirmation.js`
- Test: `test/confirmation.test.mjs`

**Interfaces:**
- Consumes: `confirmationStatus` (Task 2).
- Produces: `renderConfirmationBlock(rec, lang?: 'es'|'en', nowMs?: number) → string`. `rec` shape: `{ confirmedAt, representative, role, affirms: Array<{label, status:'current'|'none'}> }`. Returns `''` when `rec` is missing/invalid. Emits a `<section class="cc cc-<level>">` whose markup the panel CSS (Task 5) targets.

- [ ] **Step 1: Write the failing test**

Append to `test/confirmation.test.mjs`:

```javascript
import { renderConfirmationBlock } from '../functions/empresa/_confirmation.js';

const REC = {
  confirmedAt: '2026-06-28',
  representative: 'Alessandro Nürnberg',
  role: 'Administrador único',
  affirms: [
    { label: 'Administrador único: Alessandro Nürnberg', status: 'current' },
    { label: 'Situación concursal', status: 'none' },
  ],
};
const at = (iso, days) => Date.parse(iso + 'T00:00:00Z') + days * 86_400_000;

test('missing or invalid record renders nothing', () => {
  assert.equal(renderConfirmationBlock(null, 'es'), '');
  assert.equal(renderConfirmationBlock({ confirmedAt: 'x' }, 'es'), '');
});

test('fresh ES panel names the representative and carries the disclaimer', () => {
  const html = renderConfirmationBlock(REC, 'es', at('2026-06-28', 3));
  assert.match(html, /cc cc-fresh/);
  assert.match(html, /Confirmación de vigencia/);
  assert.match(html, /Alessandro Nürnberg/);
  assert.match(html, /hace 3 días/);
  assert.match(html, /verifica la autoridad del representante/);
  assert.match(html, /cc-none/); // the "sin constancia" chip
});

test('stale panel uses the aged line, not the fresh "confirmed by" line', () => {
  const html = renderConfirmationBlock(REC, 'es', at('2026-06-28', 400));
  assert.match(html, /cc cc-stale/);
  assert.match(html, /Última confirmación hace 400 días/);
  assert.doesNotMatch(html, /Confirmado actual por/);
});

test('EN panel renders English chrome', () => {
  const html = renderConfirmationBlock(REC, 'en', at('2026-06-28', 1));
  assert.match(html, /Currency confirmation/);
  assert.match(html, /1 day ago/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/confirmation.test.mjs`
Expected: FAIL — `renderConfirmationBlock` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `functions/empresa/_confirmation.js`:

```javascript
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  if (!m) return d || '';
  const [, y, mo, day] = m;
  return lang === 'en' ? `${day} ${EN_MONTHS[parseInt(mo, 10) - 1]} ${y}` : `${day}/${mo}/${y}`;
}

const I18N = {
  es: {
    title: 'Confirmación de vigencia',
    fresh: (rep, role, n) =>
      `Confirmado actual por ${rep}${role ? `, ${role}` : ''} (verificado en el registro), hace ${n} ${n === 1 ? 'día' : 'días'}`,
    aged: (n) => `Última confirmación hace ${n} ${n === 1 ? 'día' : 'días'}`,
    asOf: (date) => `La empresa confirma, a fecha ${date}:`,
    chipCurrent: 'vigente',
    chipNone: 'sin constancia',
    disclaimer:
      'Declaración de un representante cuya autoridad ha sido verificada contra el registro público. Mapa Societario verifica la autoridad del representante, no la veracidad de cada afirmación.',
  },
  en: {
    title: 'Currency confirmation',
    fresh: (rep, role, n) =>
      `Confirmed current by ${rep}${role ? `, ${role}` : ''} (registry-verified), ${n} ${n === 1 ? 'day' : 'days'} ago`,
    aged: (n) => `Last confirmed ${n} ${n === 1 ? 'day' : 'days'} ago`,
    asOf: (date) => `As of ${date}, the company confirms:`,
    chipCurrent: 'current',
    chipNone: 'none on record',
    disclaimer:
      'Statement by a representative whose authority was verified against the public registry. Mapa Societario verifies the representative’s authority, not the truth of each statement.',
  },
};

// Decaying, registry-anchored confirmation panel. '' when there is nothing to show.
export function renderConfirmationBlock(rec, lang = 'es', nowMs = Date.now()) {
  if (!rec || !rec.confirmedAt || !rec.representative) return '';
  const st = confirmationStatus(rec.confirmedAt, nowMs);
  if (!st) return '';
  const t = I18N[lang] || I18N.es;

  const line =
    st.level === 'fresh'
      ? t.fresh(esc(rec.representative), esc(rec.role || ''), st.ageDays)
      : t.aged(st.ageDays);

  const facts = (rec.affirms || [])
    .map((f) => {
      const chip =
        f.status === 'none'
          ? `<span class="cc-chip cc-none">${t.chipNone}</span>`
          : `<span class="cc-chip cc-cur">${t.chipCurrent}</span>`;
      return `<li>${esc(f.label)} ${chip}</li>`;
    })
    .join('');

  return `<section class="cc cc-${st.level}" aria-label="${esc(t.title)}">
    <div class="cc-head"><span class="cc-dot"></span><strong>${esc(t.title)}</strong></div>
    <p class="cc-line">${line}</p>
    ${facts ? `<p class="cc-asof">${t.asOf(fmtDate(rec.confirmedAt, lang))}</p><ul class="cc-facts">${facts}</ul>` : ''}
    <p class="cc-prov">${esc(t.disclaimer)}</p>
  </section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/confirmation.test.mjs`
Expected: PASS (all confirmation tests).

- [ ] **Step 5: Commit**

```bash
git add functions/empresa/_confirmation.js test/confirmation.test.mjs
git commit -m "feat(empresa): renderConfirmationBlock decaying panel (ES/EN)"
```

---

## Task 5: Seed data, wire into the page, panel CSS

Adds the one real confirmation record and injects the panel above the registry data in the shared renderer, with styling. Integration-tested through the exported `renderCompanyPage`.

**Files:**
- Create: `functions/empresa/_confirmations.js`
- Modify: `functions/empresa/_lib.js` (imports near top; injection in `renderCompanyPage`; CSS in `STYLE`)
- Test: `test/confirmation-render.test.mjs`

**Interfaces:**
- Consumes: `renderConfirmationBlock` (Task 4); `CONFIRMATIONS` (this task); `renderCompanyPage(company, events, slug, seed, lang, ...)` exported from `_lib.js`.
- Produces: `CONFIRMATIONS` map keyed by slug; a panel injected into the page HTML strictly before the `Datos registrales` / `Registry data` heading.

- [ ] **Step 1: Write the failing test**

Create `test/confirmation-render.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

const company = {
  company_name: 'NURNBERG CONSULTING SL',
  company_type: 'SL',
  province: 'Madrid',
  current_capital: 3000,
  last_seen: '2014-03-27',
};

test('company with a confirmation shows the panel above the registry data', () => {
  const html = renderCompanyPage(company, [], 'nurnberg-consulting-sl', null, 'es');
  assert.match(html, /Confirmación de vigencia/);
  assert.match(html, /Alessandro Nürnberg/);
  assert.ok(
    html.indexOf('Confirmación de vigencia') < html.indexOf('Datos registrales'),
    'panel must render before the registry-data heading',
  );
});

test('company without a confirmation is unchanged (no panel)', () => {
  const html = renderCompanyPage(company, [], 'aldesa-energias-renovables-sl', null, 'es');
  assert.doesNotMatch(html, /Confirmación de vigencia/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/confirmation-render.test.mjs`
Expected: FAIL — no panel in output (and/or `CONFIRMATIONS` import missing once added).

- [ ] **Step 3: Create the confirmation data**

Create `functions/empresa/_confirmations.js`:

```javascript
/**
 * Phase-1 currency confirmations: slug → a representative's dated, registry-
 * anchored confirmation that the company record is current. Rendered as a
 * decaying panel ABOVE the registry data; it NEVER overwrites BORME fields.
 * Every entry MUST pass `node scripts/check-confirmations.mjs` (the slug
 * resolves AND the representative is a current officer in BORME). The `_`
 * prefix means Cloudflare Pages does not route this file.
 */
export const CONFIRMATIONS = {
  'nurnberg-consulting-sl': {
    confirmedAt: '2026-06-28',
    representative: 'Alessandro Nürnberg',
    role: 'Administrador único',
    verification: 'registry-officer-match',
    affirms: [
      { label: 'Administrador único: Alessandro Nürnberg', status: 'current' },
      { label: 'Domicilio social: C/ Arzobispo Cos 10, Madrid', status: 'current' },
      { label: 'Situación concursal', status: 'none' },
      { label: 'Sociedad activa y operativa', status: 'current' },
    ],
  },
};
```

- [ ] **Step 4: Wire imports into `_lib.js`**

In `functions/empresa/_lib.js`, after the existing imports (the `import { resolveSlug } from './_resolve.js';` line, ~line 15), add:

```javascript
import { renderConfirmationBlock } from './_confirmation.js';
import { CONFIRMATIONS } from './_confirmations.js';
```

- [ ] **Step 5: Inject the panel in `renderCompanyPage`**

In `renderCompanyPage`, the body currently contains (around line 811–814):

```javascript
  ${renameNotice}
  ${cotizadaBlock}

  <h2>${t.registryData}</h2>
```

Replace it with (compute the block just before `return`, then inject it):

```javascript
  ${renameNotice}
  ${cotizadaBlock}

  ${renderConfirmationBlock(CONFIRMATIONS[canonicalSlug], lang)}

  <h2>${t.registryData}</h2>
```

`canonicalSlug` is already defined earlier in `renderCompanyPage` (`const canonicalSlug = slug;`).

- [ ] **Step 6: Add panel CSS to `STYLE`**

In `functions/empresa/_lib.js`, inside the `STYLE` template (before its closing `</style>`), add:

```css
  .cc{border-radius:14px;padding:16px 18px;margin:0 0 18px;border:1px solid var(--line);background:#fff}
  .cc-head{display:flex;align-items:center;gap:8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
  .cc-dot{width:9px;height:9px;border-radius:50%}
  .cc-line{margin:8px 0 0;font-weight:600}
  .cc-asof{margin:12px 0 6px;font-size:13px;color:var(--mut)}
  .cc-facts{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;font-size:14px}
  .cc-chip{display:inline-block;font-size:11px;font-weight:600;border-radius:6px;padding:1px 7px;margin-left:6px}
  .cc-cur{background:#dcfce7;color:#166534}
  .cc-none{background:#f1f5f9;color:#475569}
  .cc-prov{margin:12px 0 0;font-size:12px;color:var(--mut)}
  .cc-fresh{border-color:#bbf7d0;background:#f0fdf4}
  .cc-fresh .cc-dot{background:#16a34a}
  .cc-aging{border-color:#fde68a;background:#fffbeb}
  .cc-aging .cc-dot{background:#d97706}
  .cc-stale{border-color:#e2e8f0;background:#f8fafc}
  .cc-stale .cc-dot{background:#94a3b8}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test test/confirmation-render.test.mjs test/confirmation.test.mjs`
Expected: PASS (both files).

- [ ] **Step 8: Commit**

```bash
git add functions/empresa/_confirmations.js functions/empresa/_lib.js test/confirmation-render.test.mjs
git commit -m "feat(empresa): render currency-confirmation panel above registry data"
```

---

## Task 6: Build gate — representative must be a current officer

Mechanically enforces the authority anchor and the freshness/revocation story (Spec §3.4, §6.4): the build fails if a confirmation's representative is not a current BORME officer (e.g. they later cease).

**Files:**
- Create: `scripts/check-confirmations.mjs`
- Modify: `package.json` (`prebuild`)

**Interfaces:**
- Consumes: `CONFIRMATIONS` (`_confirmations.js`), `resolveSlug` (`_resolve.js`), `nameIsOfficer` (`_confirmation.js`); live API `https://api.ncdata.eu/bormes/v3/company/{v3Name}`.
- Produces: a process exit (0 = all valid, 1 = any violation), wired into `prebuild`.

- [ ] **Step 1: Write the gate script**

Create `scripts/check-confirmations.mjs`:

```javascript
/**
 * Validates every CONFIRMATIONS entry: (1) its slug resolves to a real curated/
 * seed company, and (2) the named representative is a CURRENT officer of that
 * company in the live v3 index (registry-officer-match — the authority anchor).
 * Fails the build (exit 1) on any violation, so a confirmation can never ship
 * for someone the registry doesn't list as running the company.
 * Run: node scripts/check-confirmations.mjs
 */
import { CONFIRMATIONS } from '../functions/empresa/_confirmations.js';
import { resolveSlug } from '../functions/empresa/_resolve.js';
import { nameIsOfficer } from '../functions/empresa/_confirmation.js';

const API = 'https://api.ncdata.eu';
let failures = 0;

for (const [slug, rec] of Object.entries(CONFIRMATIONS)) {
  const resolved = resolveSlug(slug);
  if (resolved.kind === 'notfound') {
    console.error(`✗ ${slug}: slug does not resolve (add it to CURATED/SEED first)`);
    failures++;
    continue;
  }
  const name = resolved.entry.v3Name;
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10_000);
    const r = await fetch(`${API}/bormes/v3/company/${encodeURIComponent(name)}`, { signal: ac.signal });
    clearTimeout(timeout);
    const data = r.ok ? await r.json() : null;
    const company = data && data.company;
    if (!company) {
      console.error(`✗ ${slug}: '${name}' returned no company`);
      failures++;
      continue;
    }
    const officers = (company.officers_active || [])
      .map((o) => o.name || o.name_normalized)
      .filter(Boolean);
    if (!nameIsOfficer(rec.representative, officers)) {
      console.error(
        `✗ ${slug}: representative '${rec.representative}' is not a current officer (${officers.join('; ') || 'none on record'})`,
      );
      failures++;
      continue;
    }
    console.log(`✓ ${slug} → ${rec.representative} verified as a current officer of ${company.company_name}`);
  } catch (e) {
    console.error(`✗ ${slug}: fetch error ${e.message}`);
    failures++;
  }
}

if (failures) {
  console.error(`\n${failures} confirmation(s) failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${Object.keys(CONFIRMATIONS).length} confirmation(s) valid.`);
```

- [ ] **Step 2: Run the gate to verify it passes for Nürnberg**

Run: `node scripts/check-confirmations.mjs`
Expected: `✓ nurnberg-consulting-sl → Alessandro Nürnberg verified as a current officer of NURNBERG CONSULTING SL` and `All 1 confirmation(s) valid.` (exit 0).

- [ ] **Step 3: Verify the gate fails on a bad representative (manual negative check)**

Temporarily edit `functions/empresa/_confirmations.js`, change `representative` to `'Someone Notanofficer'`, then run:

Run: `node scripts/check-confirmations.mjs; echo "exit=$?"`
Expected: a `✗ nurnberg-consulting-sl: representative 'Someone Notanofficer' is not a current officer (...)` line and `exit=1`.

Then **revert** the edit:

```bash
git checkout functions/empresa/_confirmations.js
```

- [ ] **Step 4: Wire the gate into `prebuild`**

In `package.json`, change the `prebuild` script from:

```json
    "prebuild": "node scripts/check-gleif-render.mjs && node scripts/check-curated.mjs && node scripts/generate-empresa-sitemap.mjs && node scripts/generate-seo-files.mjs",
```

to (insert the gate right after `check-curated.mjs`):

```json
    "prebuild": "node scripts/check-gleif-render.mjs && node scripts/check-curated.mjs && node scripts/check-confirmations.mjs && node scripts/generate-empresa-sitemap.mjs && node scripts/generate-seo-files.mjs",
```

- [ ] **Step 5: Commit**

```bash
git add scripts/check-confirmations.mjs package.json
git commit -m "feat(empresa): build gate — confirmation representative must be a current officer"
```

---

## Task 7: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the whole confirmation test suite**

Run: `node --test test/confirmation.test.mjs test/confirmation-render.test.mjs test/resolve.test.mjs`
Expected: PASS, 0 failures.

- [ ] **Step 2: Run both build gates**

Run: `node scripts/check-curated.mjs && node scripts/check-confirmations.mjs`
Expected: both report all-valid, exit 0.

- [ ] **Step 3: Visually verify the page (local dev)**

Run: `npm run dev` then open `http://localhost:5174/empresa/nurnberg-consulting-sl` and `http://localhost:5174/en/company/nurnberg-consulting-sl`.
Expected: a green "Confirmación de vigencia / Currency confirmation" panel sits **above** "Datos registrales / Registry data", names Alessandro Nürnberg as administrador único, lists the affirmed facts with chips, shows the provenance disclaimer, and the registry footer still reads its 2014 last-updated date (proof the registry data is untouched and the panel closes the gap). Confirm a different company page (e.g. `/empresa/aldesa-energias-renovables-sl`) shows **no** panel.

> Note: `functions/` routes are Cloudflare Pages Functions. If `npm run dev` (Vite) does not execute them locally, verify with `npx wrangler pages dev` against the built output, or rely on Tasks 5–6 automated tests plus a preview deploy. The automated tests already assert the panel HTML and its position.

- [ ] **Step 4: Confirm no unintended changes**

Run: `git status` and `git log --oneline -7`
Expected: only the files listed across Tasks 1–6 changed; seven feature commits present.

---

## Self-Review

**Spec coverage:**
- §2/§3 borrowed authority, currency, anchored juxtaposition → realized by the panel rendering above (not merged with) registry data, with the provenance disclaimer (Tasks 4–5).
- §3.1 decaying signal (fresh/aging/stale) → Task 2 + CSS levels in Task 5.
- §3.2 confirm specific registry facts → `affirms` array + chips (Tasks 4–5).
- §3.4 anti-gaming invariant (never overwrite; "company asserts") → injection above registry data + disclaimer (Task 5); authority anchor gate (Task 6).
- §6.1 curated `_confirmations.js` map → Task 5. §6.2 render path + i18n + "no record → unchanged" → Tasks 4–5 (negative test included). §6.3 search marker → **deferred** (see below). §6.4 freshness/revocation → Task 6 gate enforces representative-is-current-officer.
- §8 out-of-scope items → none built.
- §9 Q1 freshness window (90d) → encoded in Task 2 thresholds.

**Deliberate scope note (not a gap):** Spec §6.3's search/surfacing marker is **not** in this plan. Phase 1's audience is one company on its own page; a result-list marker has nothing to rank among until Phase 2 brings ≥2 companies, and the spec itself defers sort/filter to "Phase 2+." The panel on the page already delivers the on-page trust signal. Surfacing in result lists should be its own task when Phase 2 lands.

**Placeholder scan:** none — every code step shows complete code; the only `…`-style content is the real seed record's actual values.

**Type consistency:** `confirmationStatus` returns `{ageDays, level}` (Task 2) and is consumed by `renderConfirmationBlock` (Task 4); `nameIsOfficer(repName, officerNames[])` (Task 3) is consumed by the gate (Task 6) with `officers_active` names mapped to strings; `CONFIRMATIONS[slug]` shape (`confirmedAt`/`representative`/`role`/`affirms[]`) is identical across `_confirmations.js`, the render call, and the gate. `canonicalSlug` is the existing `_lib.js` local used for lookup.
