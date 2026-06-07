# Barómetro Empresarial — Data Story — Design

**Date:** 2026-06-07
**Status:** v2 — re-sourced to official Registradores data (v1 built on our BORME stats; shipped, then found materially inaccurate)
**Repo:** `mapasocietario` (frontend) — no backend changes (reads a committed official CSV at build time)

> ## v2 — re-sourced to the official Registradores suite + NET CREATION lead
>
> **Why:** v1 sourced from `api.ncdata.eu/bormes/stats/*` (BORME-derived), which proved **materially wrong** vs official — national constituciones 2025 ours 155,399 vs official **128,871** (+20%), driven by a **Barcelona ~2× over-count** (pipeline bug filed at `ncdata_infra/bormes/BUG_barcelona_stats_overcount.md`; [[project_official_stats_discrepancy]]). Publishing wrong numbers would cost the credibility the story is built to earn.
>
> **New source:** the full official **Colegio de Registradores** dataset (provided as XLSX, 2011–2026, all `cod-ca;ca;cod-prov;prov;ano;mes;form-soc;…`):
> - `RM_Const` — constituciones (`num-con` + subscribed/paid capital)
> - `RM_Extin` — **extinciones (dissolutions)** (`num-ext`)
> - `RM_Ampli` / `RM_Reduc` — capital increases / reductions (count + capital)
>
> **Lead metric is now NET CREATION** (`constituciones − extinciones`), the user's original first choice — **deferred in v1 only because the BORME dissolution data was broken; now available and accurate** from official `RM_Extin`. Verified 2025: national net **94,612** (128,871 − 34,259); Madrid 20,558, Barcelona 14,428, … Ceuta 58. Const/extin ratio 3.76 (sane). No Barcelona anomaly.
>
> **Page (supersedes the v1 "gross formations" framing):**
> 1. **Hero:** national net creation `year` (and constituciones / extinciones), % vs prior year; top province.
> 2. **Province table** (52): `Constituciones | Extinciones | Neto | Neto vs año anterior`. Sorted by net. Net bar chart (top-15).
> 3. **By legal form** (SL dominance) — constituciones by form.
> 4. **Trend** (2011→`year`): yearly constituciones vs extinciones (or net) line chart.
> 5. **Capital (bonus):** total subscribed capital in new companies + capital injected via ampliaciones (`RM_Ampli`) — "capital movilizado".
> 6. **Methodology:** cite "datos del Colegio de Registradores"; definitions; not seasonally adjusted; link the CSV.
>
> **Data prep:** convert the relevant XLSX → CSV once (no xlsx dep at build) and commit to **`data/registradores/{const,extin,ampli,reduc}.csv`**. To publish a new edition: drop in fresh Registradores exports, re-convert, rebuild.
>
> **Implementation:** add a Registradores CSV parser + aggregators to the lib; the render/table grows to net columns; **reuse** the existing primitives (`intEs`, `pctEs`/`shareEs`, `barChartSvg`, `trendChartSvg`, `injectHead`, `esc`, the SPA-strip + self-`<style>` standalone-page handling). Swap `generate-barometro.mjs` to read the CSVs.
>
> **Still deferred:** transfers (`RM_Trasl` — which provinces gain/lose companies via relocation) and accounts-deposited (`RM_Depst`) as future angles; deeper capital cuts.
>
> The v1 sections below are retained for the page mechanics (build approach, charts, SEO, URL, recurrence); ignore their `api.ncdata.eu` and gross-formations specifics — superseded here.

## Goal

A recurring Spanish **data story** at **`mapasocietario.es/es/barometro-empresarial`** — the "Barómetro Empresarial" — leading with **gross company formations by province and legal type, latest full year vs prior**. Its purpose is to earn **backlinks → domain authority**, the binding SEO constraint ([[project_seo_crawl_budget]]). It's the first of the [[project_acquisition_strategy]] authority loops, and being recurring it gives a built-in reason to publish again.

## Why this framing (decisions locked in brainstorming)

- **Host:** mapasocietario.es `/es` (Spanish; native to BORME; best for Spanish regional/business-press links).
- **Lead metric:** **gross formations** (NOT net creation). Net was rejected for v1 because **dissolution data is unreliable** — e.g. Barcelona shows 761 dissolutions vs 38,459 formations in 2025 (~2%) against Madrid's ~27%, and the same skew all-time. Publishing net would crown Barcelona #1 on undercounted closures — a misleading, debunkable finding that would *cost* authority ([[user_analyst_not_salesman]]). Net is **deferred** until dissolutions are verified (separate `ncdata-bormes` task).
- **Period:** latest full calendar year (currently **2025**; 2026 is in progress) vs prior year (2024). Auto-detected from the data, with a manual override.
- **Recurring:** one **stable URL** updated each edition (accumulates authority on one URL).
- **COVID:** not a headline — at most a quietly labeled point on the trend line.

## Data feasibility (verified 2026-06-07)

- `GET /bormes/stats/provinces?from=&to=&company_type=` — per-province formations/dissolutions/concursos; **`from`/`to` and `company_type` filters work and compose**. 52 provinces.
- `GET /bormes/stats/formations` — national **monthly** time series (2009→now), filterable by `province`/`company_type`/`from`/`to`. (Also `/dissolutions`, `/concursos` — used later for net.)
- Latest data month: 2026-06 (partial) → **latest full year = 2025**.
- **By type (2025):** SL 150,337 (96.7%), SLP 1,717 (1.1%), SA 572 (0.4%), small tail; total 155,399. (No `stats/types` endpoint — derive by querying per `company_type`.)
- **Not available:** sole-vs-multiple (`is_unipersonal` not exposed by stats) → deferred (backend).

## Content structure (the page)

1. **Hero finding:** national total formations 2025, % change vs 2024, and top/bottom provinces (Barcelona ~38.5k, Madrid ~30.3k … Ceuta 85).
2. **Province table** — all 52 provinces: formations 2025, 2024, % change. The crawlable, citeable core (the link-bait).
3. **By legal type** — small table: SL vs SLP/SA/tail, 2025 vs 2024. Honest framing: "almost all new companies are SLs (~97%)."
4. **Trend** — national monthly formations 2009→2025 as an inline-SVG line chart; a couple of inflection points quietly labeled (incl. 2020).
5. **Methodology + caveats** — source (BORME via the index), "formation = first BORME inscription," coverage since 2009, "not an official registry," and a **transparency note that dissolutions/net creation are coming in a future edition once that data is validated** (turns the data-quality limitation into a credibility signal).
6. **CSV download** of the full province dataset.

## Build approach — `scripts/generate-barometro.mjs` (build-time static)

A periodic snapshot, so generate it statically (not a live Function — stable citeable numbers, crawlable HTML, fast page). The generator:
1. Determines the **latest full year** from `stats/formations` (last month with a complete year), overridable via `BAROMETRO_YEAR` env / arg.
2. Fetches: province formations for `year` and `year-1` (`stats/provinces?from&to`), national by-type for both years (loop over `company_type` values), and the national monthly series (`stats/formations`).
3. Renders the article HTML (crawlable **HTML tables** + inline **SVG** charts) into the built `dist/index.html` template's `<div id="root">` (same injection pattern as `prerender.mjs`; React replaces on hydrate), writing **`dist/es/barometro-empresarial/index.html`**.
4. Writes **`dist/es/barometro-empresarial.csv`** (province × {formations 2025, 2024, %Δ}).
5. On any stats-fetch failure → **exit non-zero (fail the build)** so a broken/empty edition is never deployed (the prior good deploy stays live) — consistent with `check-curated.mjs`.

Runs in **`postbuild`** after `prerender.mjs` (needs the built `dist/index.html` template; build-time network fetch is already established by `check-curated.mjs`).

## Charts + crawlability

Hand-rolled **inline SVG** — a province bar chart (top N) and the national trend line — dependency-free and visible to crawlers. The **HTML data tables carry the actual numbers** (what gets cited); charts are the human-friendly layer.

## SEO + linking

- `<title>`/`<meta description>`/self-canonical (`/es/barometro-empresarial`)/hreflang (`es`; `x-default`→es)/OG; `robots: index,follow`.
- **Internal links in:** from the prerendered homepage `/` (extend the staticContent added in `feat/prerender-homepage`) and the `/es` page. **Out:** to `/app` and `/empresas-cotizadas`. Ties it into the crawl graph and channels earned authority inward.
- Add `/es/barometro-empresarial` to the sitemap (via `generate-seo-files.mjs` / sitemap-pages).

## Recurrence

Re-running the build regenerates the edition on the same URL; the page shows an edition label ("Datos de 2025"). No per-year archive in v1.

## Testing

- **Unit (`node:test`):** latest-full-year detection from a month series; % change + number formatting (es-ES); CSV row/format; SVG path generation for a known series.
- **Integration:** run the generator against the live API; assert the page contains a 52-row province table, the by-type table, an SVG trend chart, the in/out internal links; assert the CSV exists with 52 data rows.
- **Manual:** `curl` the built page → 200, crawlable tables present, links resolve; after deploy, URL-inspect in GSC.

## Out of scope (deferred)

- **Net creation / dissolutions** — gated on a separate **dissolution-data verification** task in `ncdata-bormes` (the Barcelona undercount). Unlocks a stronger edition 2.
- **Shareholdership (sole vs multiple)** — needs `is_unipersonal` exposed in the stats aggregation (backend).
- EN mirror, per-year archive, interactive map.

## Decisions (resolved 2026-06-07)

1. Slug: **`/es/barometro-empresarial`**.
2. CSV at **`/es/barometro-empresarial.csv`** (next to the page).
3. Province bar chart: **top-15** provinces; all 52 remain in the HTML table + CSV.
