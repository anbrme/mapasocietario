# Curated Company Resolution — Design (v4)

**Date:** 2026-06-06
**Status:** Draft for review (v4 — scoped down to a curated near-term fix; full identity system deferred)
**Repos touched:** `mapasocietario` (frontend) — **no backend changes** (uses the existing name-keyed `v3/company` endpoint with exact names from a committed map).

> **Decision (Option 3 + decoupling):** Fix the visible 404 / mis-resolution for a *curated* set now; **defer** the full hoja-keyed entity-resolution system (preserved below) until the representative-statement pilot + data reports prove demand. The representative-content pilot is a **separate feature** with its own record — it does **not** depend on this or the identity system. See [[project_acquisition_strategy]].

## Problem

`/empresa/:slug` resolves by reconstructing a name from the slug and gambling it through autocomplete (`functions/empresa/_lib.js` → `resolveCompanyName`, ~line 108). Verified 2026-06-06: real punctuated-name companies **404** (`CONSTRUCTORA JFR 26 S.L.`, `COPTTRABA S.L.`, `CORTADORES A CUCHILLO S.R.L.`); clean names resolve; the `suggestions[0]` fallback can **silently mis-resolve** to the wrong company.

## Scope decision — why curated, not the full system

Building a 2.9M-company hoja-entity identity system to serve a ~40-visits/day curated play is premature. The near-term acquisition plan exposes only **~100–500 excellent, curated pages** anyway (the long-tail mass currently gets **0 impressions**). So: make the pages that matter resolve **deterministically and correctly**, and **404 everything else** rather than ever guess. Correct for a curated set (each entry verified), zero mis-resolution, no backend work.

## Goals

1. Every page in a **curated set** resolves to the **exact intended company**, deterministically.
2. **No guessing, ever** — outside the curated set, `/empresa/<slug>` returns **404**, never a guessed company.
3. Eliminate the `suggestions[0]` mis-resolution path entirely.
4. Site **search stays complete** (the `/app` autocomplete still finds every company — curation governs only the SSR SEO pages, not findability).

## Design

### Curated map (committed data)
A repo-committed map (generalizes the existing `_ibex35.js` `SEED` pattern):
```
CURATED = { "<slug>": { v3Name: "<exact v3 _id / canonical name>", … }, … }
```
- ~100–500 hand-curated entries. Selection priority: companies with **actual search demand** (GSC queries), **substantial profiles**, **listed companies** (the 35 seed), and **companies that submit a statement**.
- A **validation script** asserts every entry resolves 200 and the rendered `<h1>`/name matches the intended company (run in CI / pre-deploy).

### Resolution change (`functions/empresa/_lib.js`, `handleCompany`)
1. `slug` in `SEED` → existing seed path (unchanged).
2. else `slug` in `CURATED` → fetch `v3/company/<exact v3Name>` **directly** (no autocomplete) → render.
3. else → **404** (`notFound`, `noindex,follow`).
- **Delete** the `resolveCompanyName` autocomplete-reconstruction + `suggestions[0]` fallback path.
- EN mirror (`/en/company/:slug`) identical.

### Sitemap
Emit **exactly the curated set** (replaces the current 35-only sitemap), so Google sees only curated quality pages.

## Integrity / search completeness

- `/app` search remains complete — finds every company. Curation governs only direct `/empresa` SSR URLs.
- **Open integration check:** how does the `/app` SPA link to a company today? If it links to `/empresa/<slug>` for *non-curated* companies, those links will now 404 — the SPA must either link only to curated pages or render non-curated company data inline (its existing in-app view). **Verify before shipping.**

## Backward compatibility

- The 35 IBEX seed are in the curated set; their slugs are unchanged.
- Non-curated companies that currently resolve will start returning 404 — acceptable: they have ~0 search traffic and weren't indexed; the gain is zero mis-resolution.

## Non-goals (this spec)

- Stable immutable IDs / mass entity resolution (deferred — see below).
- Company claims/statements (separate pilot spec; decoupled).
- The province→A-Z directory (later — `2026-06-06-seo-directory-internal-linking-design.md`).

## Testing

- Every curated slug → 200 with correct `<h1>` (validation script).
- A representative non-curated real company → **404** (not a guessed company).
- No autocomplete-reconstruction path remains in the code.
- Sitemap == curated set.
- `/app` company links don't 404 (integration check).

---

## DEFERRED — Mass hoja-keyed entity resolution (build only after the pilot proves demand)

Preserved design for when the long-tail mass and self-service claims justify the investment (a multi-week `ncdata-bormes` project):

- **Durable key = hoja registral**, parsed from each BORME entry's `Datos registrales` (`S 8 , H B 657985, I/A 1` → hoja `B-657985`; province letter(s) included). Composite key: `registry_office + section + hoja_number`.
- **Build entities per-hoja from the raw event stream**, not from the name-grouped v3 doc (a name-doc can span multiple hojas). `company-by-id` must **aggregate displayed data by mapped hojas**.
- **Hoja observations + errata lineage** (BORME corrects hoja numbers, e.g. 650166→650669); recover the province from BORME document metadata when the prefix is absent (`H 232050`).
- **Name excluded from identity** — stored only as observed-name-at-date + evidence + slug/alias history.
- **Minted, opaque, persisted `public_id`**, mapped from hoja via `company_entity_sources(source_system, stable_source_key, public_id, first_seen, last_seen)`; `company_slug_aliases(slug, public_id, alias_type, created_at)` with ambiguity *derived* from multiple rows.
- **Transfers** stay separate until explicit linking evidence (RRM Art. 19); **merges** via `merged_into_public_id` → retired id 301s to survivor.
- **URLs** `/empresa/<public_id>/<slug>` via `functions/empresa/[token].js` (branches id vs legacy slug) + `[id]/[slug].js`.
- **Fallback promotion:** an `unverified-key` record acquiring a hoja either retains its id (new hoja) or merges into the existing one; claims never attach to fallback identities.

## Related — Representative-Statement Pilot (separate spec, decoupled)

Each statement is its **own record** (`company_statements`, UUID identity), manually verified (NIF + hoja + representative identity as evidence) and manually associated with a curated company page for display — so it needs **only curated resolution**, not the deferred identity system. v1 is a manual editorial pilot; named natural-person shareholders excluded pending a consent workflow. Full design: [[project_company_context_layer]] → its own spec next.
