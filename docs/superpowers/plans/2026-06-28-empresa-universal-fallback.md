# Universal /empresa Resolution (name-lookup fallback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/empresa/:slug` (and `/en/company/:slug`) resolve for *any* company — not just the curated/IBEX allowlist — by falling back to a name lookup, while keeping the new pages out of Google (`noindex`); then make the in-app "full profile" link universal.

**Architecture:** When a slug isn't curated, reconstruct the company name from it (`-`→space), query the existing case/punctuation-insensitive backend `/bormes/v3/company/{name}`, and serve the page **only if** `nameToSlug(returned_company_name) === slug` (an exact round-trip guard). Fallback pages render with `robots: noindex` so they don't flood search. The in-app link drops its curated gate and prefers the curated slug when one exists, else the name slug.

**Tech Stack:** Cloudflare Pages Functions (ESM), React + MUI (existing app), Node.js built-in test runner, Vite build. No backend/data change — the v3/company endpoint already resolves by name (verified: `surya consulting sl`, `dream ventures investments s l` both resolve, case- and punctuation-insensitive).

**No spec doc by agreement** — the design and the three decisions below were settled in conversation.

## Global Constraints

- **Fallback only when not curated:** the change applies only when `resolveSlug(slug).kind === 'notfound'`. Curated/IBEX resolution is untouched.
- **Exact round-trip guard:** a fallback page is served ONLY if `nameToSlug(company.company_name) === slug`; otherwise 404. This prevents wrong-entity/lossy matches.
- **Decision 1 — noindex:** every fallback (non-curated) page renders `<meta name="robots" content="noindex, follow">`. Curated + IBEX pages keep `index, follow`. (Protects SEO — no 3.2M thin indexed pages.)
- **Decision 2 — universal link:** `fullCompanyPageHref` drops the curated gate; it returns a path for ANY non-empty name (the curated/seed slug when known, else `nameToSlug(name)`), `null` only for an empty name.
- **Decision 3 — hoja tiebreaker deferred:** true slug-twins (two distinct names colliding only on `&`/`ñ`/punctuation, e.g. `A & B SL` vs `A Y B SL`) are NOT disambiguated in this version — the lookup returns one twin, the guard still passes, and serving one is acceptable for v1. No hoja suffix logic here.
- **No backend/data change:** read-only use of the existing `/bormes/v3/company/{name}` endpoint.
- **Existing tests stay green:** `resolve`, `confirmation`, `confirmation-render`, `page-href`, `slug` suites must all still pass.
- `nameToSlug` and `slugToQuery` already exist in scope in `functions/empresa/_lib.js` (imported / defined). Tests via `node --test`.

---

## File Structure

- **Modify** `functions/empresa/_lib.js` — (Task 1) add a `noindex` param to `renderCompanyPage`; (Task 2) add the name-lookup fallback + round-trip guard in `handleCompany`.
- **Modify** `functions/empresa/_page_href.js` — (Task 3) drop the curated gate so the link is universal.
- **Create** `test/empresa-robots.test.mjs` — (Task 1) robots-meta assertions.
- **Modify** `test/page-href.test.mjs` — (Task 3) update the non-curated expectation.

---

## Task 1: `noindex` param on `renderCompanyPage`

**Files:**
- Modify: `functions/empresa/_lib.js` (signature at line 590; robots meta at line 792)
- Test: `test/empresa-robots.test.mjs`

**Interfaces:**
- Produces: `renderCompanyPage(company, events, slug, seed, lang, cnmv, chartSvg, boe, gleif, noindex)` — new final boolean param `noindex` (default `false`). When `true`, the page's robots meta is `noindex, follow`; otherwise `index, follow` (unchanged default).

- [ ] **Step 1: Write the failing test**

Create `test/empresa-robots.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

const company = { company_name: 'SURYA CONSULTING SL', company_type: 'SL', province: 'Alicante' };

test('renderCompanyPage indexes by default', () => {
  const html = renderCompanyPage(company, [], 'surya-consulting-sl', null, 'es');
  assert.match(html, /<meta name="robots" content="index, follow">/);
});

test('renderCompanyPage with noindex=true emits noindex and not index', () => {
  const html = renderCompanyPage(company, [], 'surya-consulting-sl', null, 'es', null, null, null, null, true);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(html, /content="index, follow"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/empresa-robots.test.mjs`
Expected: FAIL — the second test fails (the page always emits `index, follow` today; the new param is ignored).

- [ ] **Step 3: Add the `noindex` param and use it in the robots meta**

In `functions/empresa/_lib.js`, change the `renderCompanyPage` signature (line 590) from:

```javascript
export function renderCompanyPage(company, events, slug, seed, lang = 'es', cnmv = null, chartSvg = null, boe = null, gleif = null) {
```

to:

```javascript
export function renderCompanyPage(company, events, slug, seed, lang = 'es', cnmv = null, chartSvg = null, boe = null, gleif = null, noindex = false) {
```

And change the robots meta line (line 792) from:

```javascript
<meta name="robots" content="index, follow">
```

to:

```javascript
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
```

(Leave the `notFoundPage` robots line at ~874 and the hub line at ~1050 unchanged — those are separate.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/empresa-robots.test.mjs test/confirmation-render.test.mjs`
Expected: PASS (the new robots tests, and the existing render test which relies on the default `index, follow`).

- [ ] **Step 5: Commit**

```bash
git add functions/empresa/_lib.js test/empresa-robots.test.mjs
git commit -m "feat(empresa): noindex param on renderCompanyPage"
```

---

## Task 2: name-lookup fallback in `handleCompany`

**Files:**
- Modify: `functions/empresa/_lib.js` (`handleCompany`, lines ~888–957)

**Interfaces:**
- Consumes: `renderCompanyPage(..., noindex)` (Task 1); existing `resolveSlug`, `slugToQuery`, `nameToSlug` (all already in scope in `_lib.js`).
- Produces: `/empresa/:slug` resolves any company whose `nameToSlug(company_name)` round-trips to the requested slug; fallback pages are `noindex`. No new exported symbol.

This task has no unit harness (the function does network I/O — `_lib.js` has no `handleCompany` tests). Verification is: the full existing suite stays green (no regression to curated rendering), plus a manual `curl` check after a preview deploy. The logic is small and the round-trip guard is `nameToSlug(...) === slug`, whose `nameToSlug` half is already unit-tested.

- [ ] **Step 1: Replace the early-404 + name derivation**

In `functions/empresa/_lib.js`, the current top of `handleCompany` (lines ~888–898) is:

```javascript
export async function handleCompany({ params }, lang = 'es') {
  const slug = String(params.slug || '').toLowerCase();
  const resolved = resolveSlug(slug);
  if (resolved.kind === 'notfound') {
    return new Response(notFoundPage(slug, lang), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  const seed = resolved.kind === 'seed' ? resolved.entry : null;
  const name = resolved.entry.v3Name;
```

Replace it with (do not early-return on `notfound`; derive a fallback name instead):

```javascript
export async function handleCompany({ params }, lang = 'es') {
  const slug = String(params.slug || '').toLowerCase();
  const resolved = resolveSlug(slug);
  // Non-curated slugs fall back to a name lookup (served noindex). Curated/IBEX
  // resolve via their stored v3Name as before.
  const isFallback = resolved.kind === 'notfound';
  const seed = resolved.kind === 'seed' ? resolved.entry : null;
  const name = isFallback ? slugToQuery(slug) : resolved.entry.v3Name;
```

- [ ] **Step 2: Add the round-trip guard after the company is fetched**

Further down in `handleCompany`, the current no-company guard (lines ~917–925) is:

```javascript
    const company = profile && profile.company ? profile.company : null;
    if (!company) {
      return new Response(notFoundPage(slug, lang), {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
```

Immediately AFTER that block, add the fallback round-trip guard:

```javascript
    // Fallback pages must round-trip exactly: the canonical name's slug has to
    // equal the requested slug, or we'd serve the wrong (lossy-matched) entity.
    if (isFallback && nameToSlug(company.company_name) !== slug) {
      return new Response(notFoundPage(slug, lang), {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
```

- [ ] **Step 3: Pass `noindex` (= isFallback) to the render call**

The current render call (line ~946) is:

```javascript
    const html = renderCompanyPage(company, events, slug, seed, lang, cnmvResp, sanitizeSvg(chartSvg), boeResp, gleif);
```

Change it to pass the noindex flag (fallback pages are noindex):

```javascript
    const html = renderCompanyPage(company, events, slug, seed, lang, cnmvResp, sanitizeSvg(chartSvg), boeResp, gleif, isFallback);
```

- [ ] **Step 4: Verify no regression in the existing suite**

Run: `node --test test/*.test.mjs`
Expected: PASS, 0 failures. (No test drives `handleCompany` directly; this confirms `renderCompanyPage`, resolve, and the helpers are unaffected.)

- [ ] **Step 5: Verify the bundle still builds**

Run: `npx vite build`
Expected: build completes with no errors. (Confirms the `_lib.js` edits are syntactically sound; the route itself is a Pages Function, not in the SPA bundle, but the build still parses the module graph.)

- [ ] **Step 6: Commit**

```bash
git add functions/empresa/_lib.js
git commit -m "feat(empresa): name-lookup fallback resolves non-curated companies (noindex, round-trip guarded)"
```

- [ ] **Step 7: Manual route verification (record result; not a code gate)**

After a preview deploy (`npx wrangler pages dev` against the build, or a branch preview), check:
- `/empresa/surya-consulting-sl` → **200**, and the HTML contains `<meta name="robots" content="noindex, follow">`.
- `/empresa/nurnberg-consulting-sl` (curated) → **200** with `index, follow` (unchanged).
- `/empresa/zzzz-not-a-real-company-xyz` → **404**.
Note the outcomes in the task report.

---

## Task 3: make the in-app link universal

**Files:**
- Modify: `functions/empresa/_page_href.js`
- Test: `test/page-href.test.mjs`

**Interfaces:**
- Consumes: `nameToSlug`, the existing `SLUG_BY_NAME` reverse index.
- Produces: `fullCompanyPageHref(name, lang)` now returns a path for ANY non-empty name — the curated/seed slug when known, else `nameToSlug(name)`; `null` only for an empty/nullish name.

- [ ] **Step 1: Update the failing tests**

In `test/page-href.test.mjs`, replace the existing `'non-curated company has no page → null'` test with:

```javascript
test('non-curated company now resolves to its name-slug path (universal)', () => {
  assert.equal(fullCompanyPageHref('Surya Consulting SL', 'es'), '/empresa/surya-consulting-sl');
  assert.equal(fullCompanyPageHref('Surya Consulting SL', 'en'), '/en/company/surya-consulting-sl');
});
```

Leave the curated test (`'NURNBERG CONSULTING SL' → '/empresa/nurnberg-consulting-sl'`), the IBEX test (`'ACCIONA SA' → '/empresa/acciona'`), and the empty/nullish test (`→ null`) unchanged — the curated/IBEX cases must STILL prefer the short curated slug.

- [ ] **Step 2: Run tests to verify the updated case fails**

Run: `node --test test/page-href.test.mjs`
Expected: FAIL — `fullCompanyPageHref('Surya Consulting SL', 'es')` currently returns `null`, not the path.

- [ ] **Step 3: Drop the curated gate**

In `functions/empresa/_page_href.js`, the current `fullCompanyPageHref` body is:

```javascript
export function fullCompanyPageHref(name, lang = 'es') {
  const key = nameToSlug(name);
  if (!key) return null;
  const slug = SLUG_BY_NAME[key];
  if (!slug) return null;
  return lang === 'en' ? `/en/company/${slug}` : `/empresa/${slug}`;
}
```

Replace the two `slug` lines so it falls back to the name-slug (prefer the curated/seed slug when one exists, so IBEX still links to its short indexed URL):

```javascript
export function fullCompanyPageHref(name, lang = 'es') {
  const key = nameToSlug(name);
  if (!key) return null;
  // Prefer the curated/IBEX slug (a real indexed page); otherwise use the
  // name-slug, which the route now resolves via its name-lookup fallback.
  const slug = SLUG_BY_NAME[key] || key;
  return lang === 'en' ? `/en/company/${slug}` : `/empresa/${slug}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/page-href.test.mjs`
Expected: PASS (curated → short slug, IBEX → `acciona`, non-curated → name-slug path, empty → null).

- [ ] **Step 5: Commit**

```bash
git add functions/empresa/_page_href.js test/page-href.test.mjs
git commit -m "feat(app): in-app full-page link now universal (name-slug fallback)"
```

- [ ] **Step 6: Manual in-app check (record result; not a code gate)**

After deploy, open a NON-curated company in `/app` (e.g. search "Surya Consulting"): the "Ver ficha completa →" link now appears and opens `/empresa/surya-consulting-sl` (a 200 noindex page). A curated company (Nürnberg) still links to its `/empresa/nurnberg-consulting-sl`; an IBEX company still links to `/empresa/acciona`. Note the outcome.

---

## Self-Review

**Design coverage (the agreed 4-step + 3 decisions):**
- Route fallback (reconstruct → lookup → round-trip guard) → Task 2.
- noindex for non-curated → Task 1 (param) + Task 2 (passes `isFallback`).
- Universal in-app link → Task 3.
- Hoja tiebreaker deferred → explicitly out (Global Constraints, Decision 3).
- noindex scope (Decision 1), universal link (Decision 2) → Tasks 1–2, 3.

**Placeholder scan:** none — every step has complete code or an exact command.

**Type consistency:** `renderCompanyPage`'s new final param `noindex` (Task 1) is supplied as `isFallback` in Task 2's render call. `isFallback`/`seed`/`name` are derived once at the top of `handleCompany` (Task 2 Step 1) and used in the guard (Step 2) and render (Step 3). `fullCompanyPageHref(name, lang) → string|null` keeps its signature (Task 3); only the internal gate changes. The round-trip guard `nameToSlug(company.company_name) === slug` uses the same `nameToSlug` already imported in `_lib.js`.

**Note on verification asymmetry:** Tasks 1 and 3 are fully unit-tested; Task 2 (the route) is verified by no-regression + manual `curl`, because `handleCompany` does network I/O and the repo has no harness for it. The correctness-critical part (the round-trip guard) is `nameToSlug(...) === slug`, and `nameToSlug` is already unit-tested — so the untested surface is only the fetch/branch wiring, which the final review and the manual curl cover.
