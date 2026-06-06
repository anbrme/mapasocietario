# Curated Company Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/empresa/:slug` (and `/en/company/:slug`) resolve only to a curated set of verified companies via a direct exact-name lookup, returning 404 (never a guessed company) for anything else — removing the autocomplete-reconstruction path that 404s real companies and silently mis-resolves.

**Architecture:** Generalize the existing `SEED` pattern (clean slug → exact `v3Name`). Add a `CURATED` map for non-listed companies, a pure `resolveSlug()` classifier (SEED → curated → notfound), wire it into `handleCompany`, validate every curated entry against the live API, and emit the curated set into the sitemap. No backend changes.

**Tech Stack:** Cloudflare Pages Functions (ESM), Node `node:test` for unit tests, Node check scripts (existing `scripts/check-*.mjs` convention), Vite build.

---

### Task 1: Pure `resolveSlug` classifier + curated map + unit tests

**Files:**
- Create: `functions/empresa/_curated.js`
- Create: `functions/empresa/_resolve.js`
- Test: `test/resolve.test.mjs`

- [ ] **Step 1: Create the curated map with two real starter entries**

`functions/empresa/_curated.js`:
```js
/**
 * Curated NON-listed companies: clean SEO slug → the exact v3 doc to render.
 * Unlike SEED (IBEX 35), these render the standard profile (no CNMV/GLEIF).
 * Every entry MUST pass `node scripts/check-curated.mjs` (resolves to the
 * intended company). Grow this set from real search demand (GSC) + submitted
 * statements. The `_` prefix means Cloudflare Pages does not route this file.
 */
export const CURATED = {
  'aldesa-energias-renovables-sl':   { name: 'Aldesa Energías Renovables', v3Name: 'ALDESA ENERGIAS RENOVABLES SL' },
  'aldesa-agrupacion-empresarial-sa':{ name: 'Aldesa Agrupación Empresarial', v3Name: 'ALDESA AGRUPACION EMPRESARIAL SA' },
};
```

- [ ] **Step 2: Write the failing test**

`test/resolve.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSlug } from '../functions/empresa/_resolve.js';

test('seed slug resolves as seed with its v3Name', () => {
  const r = resolveSlug('acciona');
  assert.equal(r.kind, 'seed');
  assert.equal(r.entry.v3Name, 'ACCIONA SA');
});

test('curated slug resolves as curated', () => {
  const r = resolveSlug('aldesa-agrupacion-empresarial-sa');
  assert.equal(r.kind, 'curated');
  assert.equal(r.entry.v3Name, 'ALDESA AGRUPACION EMPRESARIAL SA');
});

test('unknown slug resolves as notfound', () => {
  assert.equal(resolveSlug('this-company-does-not-exist-xyz').kind, 'notfound');
});

test('resolution is case-insensitive', () => {
  assert.equal(resolveSlug('ACCIONA').kind, 'seed');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/resolve.test.mjs`
Expected: FAIL — cannot import `resolveSlug` (module `_resolve.js` not found).

- [ ] **Step 4: Implement `resolveSlug`**

`functions/empresa/_resolve.js`:
```js
import { SEED } from './_ibex35.js';
import { CURATED } from './_curated.js';

/**
 * Classify a company slug against the curated maps. Pure (no network).
 * @returns {{kind:'seed'|'curated'|'notfound', entry:object|null}}
 */
export function resolveSlug(slug) {
  const key = String(slug || '').toLowerCase();
  if (SEED[key])    return { kind: 'seed',    entry: SEED[key] };
  if (CURATED[key]) return { kind: 'curated', entry: CURATED[key] };
  return { kind: 'notfound', entry: null };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/resolve.test.mjs`
Expected: PASS — 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add functions/empresa/_curated.js functions/empresa/_resolve.js test/resolve.test.mjs
git commit -m "feat(empresa): curated slug classifier (seed/curated/notfound)"
```

---

### Task 2: Wire `resolveSlug` into `handleCompany`; remove the autocomplete path

**Files:**
- Modify: `functions/empresa/_lib.js` (`handleCompany` ~839–910; `renderCompanyPage` canonicalSlug ~549; delete `resolveCompanyName` ~108–117)

- [ ] **Step 1: Replace the resolution block in `handleCompany`**

In `functions/empresa/_lib.js`, replace the opening of `handleCompany` (from `const slug = ...` through the `if (seed) { … } else { … resolveCompanyName … 301 … }` block) with:

```js
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
```

Leave everything from `// BOE mentions match by company name + NIF` onward unchanged (the `seed ?` gates already skip CNMV/GLEIF/chart for curated companies). The closing `catch`/`finally` stay as-is.

- [ ] **Step 2: Add the import at the top of `_lib.js`**

Below `import { SEED } from './_ibex35.js';` add:
```js
import { resolveSlug } from './_resolve.js';
```

- [ ] **Step 3: Make the canonical slug always the served slug**

In `renderCompanyPage`, change line ~549 from:
```js
  const canonicalSlug = seed ? slug : nameToSlug(name);
```
to:
```js
  const canonicalSlug = slug;
```

- [ ] **Step 4: Delete the now-dead `resolveCompanyName` function**

Remove the entire `async function resolveCompanyName(slug, signal) { … }` (~lines 108–117). Keep `slugToQuery` (still used by `notFoundPage`).

- [ ] **Step 5: Verify the module imports and no dead reference remains**

The Cloudflare Functions in `functions/` are NOT compiled by `vite build` (it only builds the SPA), so validate the module directly:
```bash
node --input-type=module -e "import('./functions/empresa/_lib.js').then(()=>console.log('IMPORT OK')).catch(e=>{console.error(e);process.exit(1)})"
grep -n "resolveCompanyName" functions/empresa/_lib.js
```
Expected: prints `IMPORT OK`; the `grep` returns **no matches** (the dead function and its call sites are gone).

- [ ] **Step 6: (Optional) Verify resolution behaviour locally with wrangler**

Requires a `dist/` build and wrangler. If unavailable, skip — the post-deploy check below covers it.
```bash
npx vite build
npx wrangler pages dev dist --compatibility-date=2024-01-01 &
sleep 4
curl -s -o /dev/null -w "seed:    %{http_code}\n" http://localhost:8788/empresa/acciona
curl -s -o /dev/null -w "curated: %{http_code}\n" http://localhost:8788/empresa/aldesa-agrupacion-empresarial-sa
curl -s -o /dev/null -w "unknown: %{http_code}\n" http://localhost:8788/empresa/this-company-does-not-exist-xyz
kill %1
```
Expected: `seed: 200`, `curated: 200`, `unknown: 404`.

- [ ] **Step 7: Commit**

```bash
git add functions/empresa/_lib.js
git commit -m "feat(empresa): resolve only curated slugs, 404 otherwise (no autocomplete guessing)"
```

---

### Task 3: Live validation script for curated entries

**Files:**
- Create: `scripts/check-curated.mjs`
- Modify: `package.json` (`prebuild` script)

- [ ] **Step 1: Write the validation script**

`scripts/check-curated.mjs`:
```js
/**
 * Validates every CURATED entry resolves to a real company in the live v3 index.
 * Fails the build (exit 1) on any entry whose v3Name returns no company.
 * Run: node scripts/check-curated.mjs
 */
import { CURATED } from '../functions/empresa/_curated.js';

const API = 'https://api.ncdata.eu';
let failures = 0;

for (const [slug, entry] of Object.entries(CURATED)) {
  try {
    const r = await fetch(`${API}/bormes/v3/company/${encodeURIComponent(entry.v3Name)}`);
    const data = r.ok ? await r.json() : null;
    const company = data && data.company;
    if (!company) {
      console.error(`✗ ${slug}: v3Name '${entry.v3Name}' returned no company`);
      failures++;
    } else {
      console.log(`✓ ${slug} → ${company.company_name}`);
    }
  } catch (e) {
    console.error(`✗ ${slug}: fetch error ${e.message}`);
    failures++;
  }
}

if (failures) {
  console.error(`\n${failures} curated entr${failures === 1 ? 'y' : 'ies'} failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${Object.keys(CURATED).length} curated entries resolve.`);
```

- [ ] **Step 2: Run it**

Run: `node scripts/check-curated.mjs`
Expected: `✓` for each entry, then "All N curated entries resolve." If an entry fails, correct its `v3Name` in `_curated.js` (use `api.ncdata.eu/bormes/companies/directory/autocomplete?q=<words>` to find the exact `company_name`) and re-run.

- [ ] **Step 3: Wire into the build**

In `package.json`, change:
```json
"prebuild": "node scripts/check-gleif-render.mjs && node scripts/generate-seo-files.mjs",
```
to:
```json
"prebuild": "node scripts/check-gleif-render.mjs && node scripts/check-curated.mjs && node scripts/generate-seo-files.mjs",
```

- [ ] **Step 4: Commit**

```bash
git add scripts/check-curated.mjs package.json
git commit -m "feat(empresa): validate curated entries against the live index at build"
```

---

### Task 4: Emit the curated set into the sitemap

**Files:**
- Modify: `scripts/generate-empresa-sitemap.mjs`

- [ ] **Step 1: Import CURATED**

In `scripts/generate-empresa-sitemap.mjs`, below `import { SEED } from '../functions/empresa/_ibex35.js';` add:
```js
import { CURATED } from '../functions/empresa/_curated.js';
```

- [ ] **Step 2: Add curated company URL blocks after the SEED loop**

Immediately after the existing `for (const slug of Object.keys(SEED).sort()) { … }` loop, add:
```js
// Curated non-listed companies (ES + EN), lower priority than the IBEX seed.
for (const slug of Object.keys(CURATED).sort()) {
  blocks.push(urlBlock(esCompany(slug), esCompany(slug), enCompany(slug), '0.6', 'monthly'));
  blocks.push(urlBlock(enCompany(slug), esCompany(slug), enCompany(slug), '0.6', 'monthly'));
}
```

- [ ] **Step 3: Regenerate and verify**

Run:
```bash
node scripts/generate-empresa-sitemap.mjs
grep -c "aldesa" public/sitemap-empresas.xml
```
Expected: the script writes `public/sitemap-empresas.xml`; grep returns ≥ 4 (2 curated companies × ES+EN).

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-empresa-sitemap.mjs public/sitemap-empresas.xml
git commit -m "feat(empresa): include curated companies in the sitemap"
```

---

## After deploy (verification)

Once deployed to Cloudflare Pages, confirm the fix on the live site:
```bash
for s in acciona aldesa-agrupacion-empresarial-sa this-company-does-not-exist-xyz; do
  curl -s -o /dev/null -w "%{http_code}  $s\n" "https://mapasocietario.es/empresa/$s"
done
```
Expected: `200 acciona`, `200 aldesa-agrupacion-empresarial-sa`, `404 this-company-does-not-exist-xyz`. Then URL-inspect a curated page in Search Console.

## Notes / out of scope

- **`renamedTo` cross-link:** `renderCompanyPage` may emit a `/empresa/<slug>` link for a renamed company; if that target isn't curated it will 404. Acceptable for v1 (rare). Do not add special handling.
- **Curation content** (growing CURATED to ~100–500) is ongoing data work driven by GSC/search demand, not part of this code change.
- **Deferred:** the full hoja-keyed entity-resolution system and the representative-statement pilot are separate specs.
