# SEO Directory Pages + Breadcrumb Internal Linking — Design

**Date:** 2026-06-06
**Status:** Draft for review
**Repos touched:** `mapasocietario` (frontend, this repo) + `ncdata-bormes` (backend API — one new/extended endpoint)

## Problem

The programmatic `/empresa/:slug` company pages are **"Discovered – currently not indexed"** in Google Search Console. URL inspection shows **"Referring page: None detected"** — the pages are *orphaned*. A sitemap entry is the weakest possible crawl signal; with no internal links pointing at them and a brand-new low-authority domain, Google discovers the pages but declines to index them.

Over 28 days *and* 3 months, `/empresa/` pages have **0 impressions, 0 clicks**. Meanwhile the site already ranks page-2/3 for high-intent head terms ("spanish company search", etc.), so latent demand exists.

The fix is **internal linking**: give the company pages dense, crawlable inbound links from genuinely useful browsable pages, and link each company page back up into that structure.

## Why this approach (what we rejected and why)

- **Shareholder cross-linking (original "Plan A") — rejected for v1.** Empirically sparse fuel: only *unipersonal* companies have a `sole_shareholders` entry, and the holder must be a Spanish company with a real page (sample: 1 of 3; the other 2 were foreign — `REINHARD MOHN GMBH`, `ALPITOUR S.P.A`). A page linked from one shareholder relationship is barely less orphaned. Deferred to a later organic enrichment.
- **Sector/activity directories — not possible.** The `activity` field is unpopulated on general companies (`null`). No sector data to facet on.
- **Capital / date / subsidiary-count facets — wrong job.** Nobody Googles "companies with capital over X". These are *analytics groupings*; they belong to a separate **data-journalism / backlink** workstream (linkbait articles → domain authority), not to directory pages.
- **Province (geography) — the one search-relevant facet we have.** People search "empresas en Madrid". Province is populated on general companies. → **province → A-Z** directory hierarchy.

## Goals

1. Make general `/empresa/:slug` pages discoverable and indexable via dense internal links from browsable directory pages.
2. Keep directory pages **genuinely useful to humans** (real lists, real links) — never doorway pages.
3. **Never make a real company unreachable.** (See Integrity Guarantees.)

## Non-goals (v1)

- Shareholder cross-linking, sector directories, data-journalism articles, person/officer pages.
- Expanding the per-company sitemap to millions of URLs (directories handle discovery; sitemap expansion is separate).

## Integrity Guarantees (the core constraint)

The quality gate governs only **what we list in the browsable directory**. It must never affect whether a company's page exists or is findable.

- Every company's `/empresa/:slug` page **always resolves on demand**, gate or not (already true today).
- The site **search** (`/app` autocomplete) stays **complete** — finds every company. A person looking for a specific company finds it via search regardless of directory inclusion.
- The directory is a **browse + crawl aid**, not the index of record.
- The gate excludes **non-records** (foreign shells with no Spanish domicile, parse-fragment names), **never small real companies**. Principle: *when in doubt, include.*

## The Quality Gate

A company is **listed in the directory** iff:

- **Primary:** `province` is non-null (a Spanish registry domicile ⇒ a real Spanish record). This excludes foreign shells without touching small real companies.
- **Secondary (light):** company name is not an obvious parse fragment (e.g. lowercase sentence text). Tunable heuristic; bias toward inclusion.
- **No activity/publication-count minimum.** A real company with 1–2 filings is included. (A `total_publications ≥ 3` style threshold is explicitly rejected — it would exclude legitimate small companies.)

## Architecture — Routes

**Spanish (primary):**

| Route | Page | Links to |
|---|---|---|
| `/empresas` | Directory root — list of ~50 provinces | province hubs |
| `/empresas/:provincia` | Province hub — A-Z letter index | letter leaves |
| `/empresas/:provincia/:letra` | Leaf — paginated company list | `/empresa/:slug` pages |

**English mirror:** `/en/companies`, `/en/companies/:province`, `/en/companies/:province/:letter`. Same templates via a language parameter (mirrors the existing `_lib.js` bilingual pattern). Province slugs stay Spanish in both languages.

**Cloudflare Pages Functions files (this repo):**

- `functions/empresas/index.js` → root (`handleDirRoot(ctx, 'es')`)
- `functions/empresas/[provincia].js` → province hub
- `functions/empresas/[provincia]/[letra].js` → leaf
- `functions/en/companies/...` → EN mirror wrappers
- `functions/empresas/_dirlib.js` → shared, language-parameterized rendering (the `_lib.js` analogue)

## Data Sources

- **Province index** (`/empresas`): `GET /bormes/stats/provinces` — **exists**. Returns `[{province, total, formations, dissolutions, concursos}]`. Note: `total` appears to be filings/mentions, not unique-company count (Madrid = 2.4M). **Open item:** display a count we can defend, or omit exact numbers in v1.
- **Leaf listing** (`/empresas/:provincia/:letra`): **REQUIRES BACKEND WORK.** The current `/bormes/companies/directory` ignores `province`/`letter` (only `q=` substring search works; returns a scored top-10000). Required contract:

  ```
  GET /bormes/companies/directory?province=<P>&letter=<L>&page=<n>&page_size=<k>
  → {
      companies: [{ company_name, province, ... }],   // gate applied server-side
      pagination: { page, page_size, total_pages },
      total
    }
  ```
  - Filter: `province == P` (case-insensitive, canonical name), `company_name` starts with `L` (A–Z; one bucket for non-alpha/numeric).
  - Quality gate applied server-side (province non-null + name-shape; **no** activity minimum).
  - Sort: alphabetical by `company_name` (stable, paginatable).
- **Per-province letter counts** (province hub): nice-to-have endpoint `GET /bormes/stats/provinces/:P/letters → {A: n, ...}` so the hub shows which letters are populated. If absent, hub links all A-Z and empty leaves render an empty-state.

## Province Slug Map

The province set is small (~50) and fixed. Maintain an **explicit, curated `province ↔ slug` map** in `_dirlib.js` (not algorithmic), to handle accents and bilingual variants authoritatively (e.g. `A Coruña`/`La Coruña`, `Illes Balears`/`Baleares`, `Álava`/`Araba`). Slug = stable canonical (e.g. `a-coruna`). This makes URLs stable and round-trippable (slug → canonical province name for the API call).

## Internal Link Wiring (the actual fix)

- **Homepage + footer → `/empresas`** (modify `LandingPage.jsx` nav/footer; surface, don't bury).
- Root → province hubs → letter leaves → `/empresa/:slug`.
- **Company page breadcrumb (Part 2) → back up into the directory** (see below).

This produces the bidirectional graph that un-orphans the company pages: directory → company *and* company → directory.

## Part 2 — Breadcrumb + BreadcrumbList Schema (frontend-only)

In `functions/empresa/_lib.js` `renderCompanyPage`:

- Replace the current crumb `<a href="/app">Empresas</a>` with `<a href="/empresas">Empresas</a>`.
- Insert a **province crumb** when `company.province` is present: `Home › Empresas › <Provincia>(/empresas/<provinceSlug>) › <Name>`. When province is absent: `Home › Empresas › <Name>`.
- Add **`BreadcrumbList` JSON-LD** (Home, Empresas, Provincia if present, Company) on company pages, and on all directory pages.

This is the highest-value per-page change: every company page with a province now links up to its province directory, and the directory links back down — closing the loop.

## SEO Specifics (every directory page)

- Templated `<title>` / `<meta description>` per level + language.
- Self-referencing `<link rel=canonical>`. Paginated leaves are self-canonical (not canonical to page 1), with `rel=prev`/`rel=next`.
- `hreflang` es / en / x-default.
- `<meta robots="index,follow">` on **populated** pages; `noindex,follow` on **empty** leaves (avoid thin/empty indexable pages).
- `BreadcrumbList` (and `ItemList` on leaves) JSON-LD.
- OpenGraph tags. Fully server-rendered HTML (no JS required to see the links).

## Pagination

- `page_size` ≈ 100–200. `?page=n`, `rel=prev`/`next`, self-canonical per page.
- Large province×letter buckets (Madrid+A) → many pages; acceptable for crawl. If any exposure cap is applied in v1, **log it** (no silent truncation).

## Error Handling

- Unknown province slug → 404 `noindex`, link to `/empresas`.
- Empty letter leaf → empty-state page, `noindex,follow`, link back to province.
- Backend timeout/error → 503 `no-store` (matches existing `handleCompany`).
- Cache headers match existing pages: `s-maxage=86400, stale-while-revalidate=604800`.

## Testing

- **Unit:** province slug-map round-trip; letter bucketing (incl. `Ñ`, non-alpha); quality-gate name heuristic; breadcrumb with/without province; `BreadcrumbList` JSON validity.
- **Integration:** leaf renders linked company list; pagination math; empty-state `noindex`.
- **Live/manual:** `curl` directory pages → 200, `index,follow`, real `<a href="/empresa/...">` links; after deploy, URL-inspect a directory page and a sample company page in GSC; watch "Discovered – not indexed" drain over following weeks.

## Phasing

- **Phase 0 (backend, `ncdata-bormes`):** province + letter + page filtered listing endpoint with server-side quality gate. Hard prerequisite for leaf pages.
- **Phase 1 (frontend, no backend dependency — shippable immediately):** Part 2 breadcrumb + `BreadcrumbList` on company pages; `/empresas` root + province hubs (from `stats/provinces`); homepage/footer link; province sitemap. Starts un-orphaning right away (company → `/empresas` → provinces).
- **Phase 2 (frontend, needs Phase 0):** leaf letter pages listing companies → completes directory → company links → full un-orphaning.

## Sitemap

- New `public/sitemap-directorio.xml` (build-time generated): `/empresas`, province hubs, populated province×letter leaves. Add to `sitemap.xml` index.
- Per-company sitemap expansion (beyond the current 35) is **out of scope** — directories are the discovery mechanism.

## Open Items for Review

1. **Province count display** — `stats/provinces.total` is filings, not unique companies. Show a defensible number, or omit numbers in v1?
2. **EN mirror in v1, or defer** to keep the first cut tight?
3. **Pagination page size**, and whether to cap exposed pages initially (with logging).
4. **Exact name-validity heuristic** for the gate (backend) — principle is "exclude non-records, never small real companies; when in doubt include."
