# Chrome Extension — Spanish Company Lookup (selection → card + graph)

**Date:** 2026-06-25
**Status:** Design approved (brainstorming), pending spec review → implementation plan
**Related:** [[project_borme_mcp_connector]] (same read-only backend, same anonymous posture),
[[project_seo_crawl_budget]] (this is a non-SEO distribution channel),
[[project_conversion_focus]], [[user_analyst_not_salesman]]

## Summary

A Chrome MV3 extension that turns selected text on any web page into a Spanish-company
**card + interactive network graph** in Chrome's native side panel. Free, anonymous, and
strictly **read-only** — same posture as the BORME MCP connector. It never triggers the
authed/billed enrichment path; it only calls existing read endpoints on `api.ncdata.eu`.

Strategic purpose: a top-of-funnel **distribution channel that does not depend on Google
crawl budget** (the current binding SEO constraint), reaching the research-minded audience
(journalists, DD/compliance analysts, BD, investors) *while they browse normally* — a
different surface from the MCP connector, which only reaches people already inside an AI chat.

## Goals

- Select text on any page → resolve to a Spanish company → show card + network graph in a side panel.
- Zero backend changes (CORS handled client-side; see Architecture).
- Honest privacy story: no page reading, no tracking, no UI injected into pages in v1.
- One quiet link back to `mapasocietario.es` per card. **No DD upsell in the sidebar.**

## Non-goals (v1) — deferred to v2

- **Floating in-page "🔍 Mapa" chip** on selection (discoverability nicety; deferred so v1
  injects *no* UI into pages — cleaner privacy/Web-Store story).
- Auto-scan of full page text / company NER.
- NIF/CIF auto-highlighting.
- Officer-name as an entry point (company-only lookups in v1).
- Saved/favourite companies, history.
- Firefox / Edge ports.

## Decisions (from brainstorming)

| Decision | Choice | Why |
|---|---|---|
| Trigger model | **Selection-first** (context menu + toolbar icon) | `activeTab` only; zero false positives; smallest, safest v1; easy Web-Store approval |
| Sidebar content | **Card + graph** | Graph is the differentiator and is the "wow"; already exists (to be trimmed) |
| Disambiguation | **Always show a match list** | Avoids confidently showing the WRONG company — fatal for a DD-minded audience |
| Goal / CTA | **Useful tool first, soft link** | One quiet "View full profile on mapasocietario.es" per card; no sidebar upsell; matches analyst-not-salesman |
| In-page UI | **None in v1** | Chip deferred; everything lives in context menu + side panel |

## Architecture

MV3 extension, Chrome **`sidePanel`** API for the native sidebar. Side panel is a small
standalone **Vite + React** app. Bilingual ES/EN from `navigator.language`.

### Components / boundaries

1. **Service worker (`background`)** — owns ALL network I/O.
   - Registers the context-menu item and toolbar action.
   - Holds `host_permissions` for `https://api.ncdata.eu/*`. **Service-worker fetches with
     host_permissions bypass CORS**, so the api-proxy CORS Worker stays **untouched — no
     backend change.**
   - Exposes a small message API to the panel: `resolve(query)`, `getCompany(id)`,
     `getGraph(id/groupKey)`. The panel never fetches directly.
2. **Side panel app (React)** — pure view + messaging.
   - **MatchList** — renders ranked candidates (name · NIF · location) from autocomplete.
   - **CompanyCard** — name, NIF, capital, address, status, key officers (capped), footer link.
   - **CompanyGraph** — trimmed read-only graph core (see Risk 1).
   - **i18n** — ES/EN strings keyed off `navigator.language`.
3. **Context-menu glue** — on `contextMenus.onClicked` for the selection, open the side panel
   and post the selected text to the panel to kick off `resolve()`.

### Data flow

```
select text → right-click → "Look up Spanish company"
   → service worker: GET /bormes/companies/directory/autocomplete?q=<sel>
   → panel: MatchList (name · NIF · location)
   → user clicks a match
       → GET /bormes/v3/company/<id>        (capped officers — avoid CaixaBank-style freeze)
       → GET /bormes/v3/expand-company + /bormes/v3/events   → graph
   → CompanyCard footer: → View full profile on mapasocietario.es/empresa/<slug>
```

### Endpoints (all existing, read-only)

- Resolve: `/bormes/companies/directory/autocomplete?q=…`
- Card: `/bormes/v3/company/<id>` — **must use the officer-capped variant** (e.g. default cap,
  `?full_officers=1` NOT set) per [[project_v3_api_hardening]] to avoid large-board freezes.
- Graph: `/bormes/v3/expand-company` + `/bormes/v3/events`, with `group_key` where available
  to avoid the AIE name-leak ([[project_v3_api_hardening]]). Link event-dates via the same
  enrichment the site uses ([[project_event_dates_pipeline]]).

## Risks & mitigations

### Risk 1 — Graph component is heavily coupled (CONFIRMED)

`src/components/SpanishCompanyNetworkGraph.jsx` imports paid/edit machinery that does NOT
belong in a read-only extension: `DDCheckoutDialog`, `AIInvestigationGate`,
`RelationshipReportModal`, `OfficerTimelineDialog`, corrections service (post/list/delete),
`useTerms`, `spanishCompaniesService`, MUI icons.

**Mitigation:** do NOT lift the component wholesale. Extract a **trimmed read-only graph
core** = `ForceGraph2D` + node/link rendering + manual arrow drawing
([[project_forcegraph_arrows]]) + event-date link enrichment + officer link-status
(`isActiveCategory` / `effectiveCategoryFromEvents`, [[project_graph_link_status_enrichment]]).
Leave behind DD checkout, AI investigation, corrections editing, terms gating.

**Plan task:** first audit the component's true rendering dependencies and pull the shared
pure utils (`positionCategories`, `officerLinkStatus`, `networkAnalysis`,
`relationshipScope`) into the panel; everything else stays in the main app.

**Fallback (only if extraction proves too large for v1):** ship card-only with a "See full
network on mapasocietario.es" link, add the graph in a fast-follow. Not preferred.

### Risk 2 — Web Store review & branding

Uses the mapasocietario name/data. Needs a clean privacy policy: "we send the text you select
to api.ncdata.eu to look up companies; we do not read pages, and we do not track you."
`activeTab` + selection + no in-page injection keeps this honest and approvable.

### Risk 3 — Selection noise

Selected text may be a fragment ("…stake in Telefónica was…"). The autocomplete endpoint is
fuzzy and tolerant; the **match list** absorbs ambiguity. If autocomplete returns nothing,
show an empty-state with the raw query and a "search on mapasocietario.es" link rather than a
wrong guess.

## Localization

ES + EN, selected from `navigator.language`, mirroring the site. Small static string table in
the panel; no runtime translation.

## Testing

- **Service worker messaging** — unit-test `resolve/getCompany/getGraph` against mocked fetch;
  assert the capped-officer and `group_key` params are sent.
- **Match list / card** — component tests with fixture payloads (incl. the array-of-bare-strings
  sole-shareholder shape, [[project_sole_shareholder_api]]).
- **Graph core** — render with a fixture network; assert arrows draw and ceased vs active
  link status matches event enrichment.
- **Manual** — load unpacked, select a name on a news article + a LinkedIn company page +
  an official page with a NIF; verify match list → card → graph → link-out.

## Success signals

Installs, lookups per active user, and click-through to `mapasocietario.es` — a non-SEO
acquisition channel ([[project_acquisition_strategy]]).

## Open questions for build

- Repo location: new repo (per [[project_repo_topology]] each project is its own repo) vs a
  folder in mapasocietario. Lean: **new repo** `mapasocietario-chrome` to keep build/store
  release cycle independent from the web app.
- Exact `/v3/company` field availability for capital/address vs enriched_* fields
  ([[project_shared_enrichment]]) — confirm the card reads enriched fields when BORME is blank.
