# Trademarks / Marcas panel on `/empresa` — Design

**Date:** 2026-07-15
**Status:** Approved design → implementation planning
**Repos touched:** `mapasocietario` (frontend SSR), `ncdata-bormes` (backend endpoint), `local-rag` (api-proxy worker allowlist)

## Goal

Add a public, free "Trademarks / Marcas" panel to each `/empresa/:slug` page that surfaces the industrial-property marks associated with a company. It deepens the company profile with a data asset no one ties to the BORME registry, mirroring the existing public-subsidies panel.

## Scope decision (why this shape)

Investigation established the constraints that shape the whole design:

- **No free official API does "all Spanish *national* marks by owner with full history."** OEPM gates holder-search behind a *paid* "Búsqueda por titulares" service. The free OEPM Localizador web service searches by mark **name**, not holder.
- **EUIPO API Platform** (`dev.euipo.europa.eu`) offers a free, official, OAuth2 REST **Trademark Search** API — but it covers **EU trademarks (EUTMs) only**, not Spanish national marks.
- **TMview** aggregates national (OEPM) marks with owner search, but has **no free public self-serve API** (third parties scrape it).

Chosen v1: a **dual-source, free, honestly-labeled** panel:
- **EUIPO Trademark Search API** → the company's EU trademarks, by applicant name (free, official, full EUTM history).
- **OEPM free Localizador SOAP** → Spanish national marks whose *denomination* matches the company name (free, live), filtered by `primerTitular`.

The honest limitation — a Spanish national mark under an *unrelated brand name* (not also an EUTM) will not appear — is **labeled in the UI**, not hidden.

## Non-goals (v1)

- Not building an owned trademark corpus via BOPI XML ingestion (forward-only; deferred, may revisit if the panel earns its place).
- Not using OEPM's paid holder-search service.
- Not building a standalone "search any trademark" page.
- Not matching on NIF (neither office keys marks by Spanish NIF; matching is name-based).

## Architecture & data flow

Mirror the subsidies panel exactly. The **frontend stays dumb** (one fetch, one render). The **backend does the dual-source fan-out** — mandatory, because the EUIPO OAuth `client_secret` must never reach the browser.

```
/empresa/:slug  (mapasocietario: functions/empresa/_lib.js, server-side rendered)
   └─ trademarksBlock: <section> shell + button + inline click-to-load fetch IIFE
         │  click → GET {API_BASE}/bormes/trademarks-by-company?name=…&nif=…&lang=…
         ▼
   ncdata-bormes Flask backend   ← behind feature flag TRADEMARKS_PANEL_ENABLED
         ├─ adapter A: EUIPO Trademark Search API (OAuth2 client-credentials, EUTMs by applicant)
         ├─ adapter B: OEPM Localizador SOAP  (buscarSignoDistintivo, denominación = name → ES national)
         ├─ merge + dedupe + status normalization + name-match filter
         └─ cache per (name, nif), TTL ~24h
         ▼
   api-proxy worker (local-rag repo)  ← the new /bormes route MUST be added to dispatch + allowlist
```

**Cross-repo deploy gates** (per the `ncdata-bormes` deploy model and the api-proxy lesson from the subsidies panel):
1. Endpoint built + deployed in **ncdata-bormes** (push `main`; CI fast-forwards `server-current` → ssh deploy → restart `borme-search.service`).
2. New route added to the **api-proxy worker in `local-rag`** (dispatch + allowlist) — otherwise the worker 404s before Flask is reached.
3. Only the `_lib.js` shell + i18n copy live in **this** repo; it deploys via push + Cloudflare Pages build.

## Backend endpoint contract

`GET /bormes/trademarks-by-company?name=<canonical company name>&nif=<optional>&lang=es|en`

Success:
```json
{
  "success": true,
  "marks": [
    {
      "source": "EUIPO",
      "denomination": "McKILLER",
      "status": "Registered",
      "type": "Denominative",
      "niceClasses": [25],
      "date": "2026-01-21",
      "imageUrl": "https://…",
      "holder": "FIESTAS GUIRCA SL",
      "officeUrl": "https://…"
    }
  ],
  "counts": { "euipo": 3, "oepm": 5, "total": 8 },
  "partial": false,
  "coverageNote": "<localized string>",
  "source_url": "https://www.tmdn.org/tmview/"
}
```

- `partial` (boolean, default `false`) is `true` when one source succeeded and the other errored/timed out — the panel still renders the results it has plus a "some sources unavailable" note.
- Feature flag dark → `{ "disabled": true }` (frontend hides the whole section, exactly like subsidies).
- Error → `{ "success": false }` (frontend shows retry + error copy).
- `status` is a **normalized enum**: `Registered | Pending | Opposed | Expired | Withdrawn | Unknown` (map EUIPO's status codes and OEPM's free-text `situacion` into this set; unmapped → `Unknown` with the raw text preserved for display).
- `type` normalized: `Denominative | Figurative | Mixed | Other`.
- `marks` sorted by `date` descending; ties stable.
- Response capped (e.g. 100 marks) with `counts.total` reflecting the true total.

## Matching strategy

Name-based (no NIF keying available):

- **EUIPO adapter — two-step** (the Trademark Search response carries applicants only as `{office, identifier}`, **not** names, so name-matching happens via the Persons API):
  1. **Persons API** (`/persons`): search by name = canonical company name → collect matching applicant `identifier`(s). Normalize + filter to keep true matches.
  2. **Trademark Search API** (`/trademark-search/trademarks`): `query=applicants.identifier==<id>` (one call per identifier, or an OR'd RSQL set) → the applicant's marks.
  - Mark name comes from `wordMarkSpecification.verbalElement` (WORD marks); figurative marks (`markFeature` != WORD) have no verbal element — label by type + image. Status from `status`; Nice from `niceClasses`; dates from `applicationDate`/`registrationDate`/`expiryDate`.
- **OEPM adapter**: `buscarSignoDistintivo` with `denominacion` = company name, criterio `CONTENGA` or `COMIENCE_POR`; keep results where `primerTitular` normalizes to the company name.
- **Normalization**: reuse the same normalization rules as `src/utils/companyName.js` (`normalizeCompanyName`) — reimplemented server-side in `ncdata-bormes` (uppercase, strip legal-form suffixes/punctuation) — to reduce false positives.
- **Coverage note** (localized), shown under the results:
  - ES: "Muestra las marcas de la UE de esta empresa y las marcas nacionales españolas que llevan su nombre. Una marca nacional con una denominación distinta puede no aparecer — consulta el registro completo de la OEPM."
  - EN: "Shows this company's EU trademarks plus Spanish national marks bearing its name. A national mark under a different brand name may not appear — search the full OEPM register."

## Frontend rendering (`functions/empresa/_lib.js`)

- New `trademarksBlock` string, composed into the page **immediately after `${subsidiesBlock}`** (currently `_lib.js:1082`).
- Renders for **every company** (a `company.name` always exists) — no NIF gate, unlike subsidies.
- Structure copied from `subsidiesBlock` (`_lib.js:865–946`):
  - `<section class="marks" id="marks-section">` with `<h2>`, sub-copy, a `#marks-btn` button, an empty `#marks-body` carrying `data-name`, `data-nif`, `data-lang`, `data-api`, and a `<script type="application/json" id="marks-i18n">` block.
  - Inline IIFE: on click, disable button → show loading → `fetch(data-api + '/bormes/trademarks-by-company?name=…&nif=…&lang=…')` → handle `{disabled:true}` (hide section), `{success:false}` (retry + error), else render.
- **Render**: a list/table of marks. Per mark: a **source badge** (`EU` for EUIPO / `ES` for OEPM), denomination, status chip, Nice classes, date, a thumbnail `<img>` if `imageUrl` is a valid `https://` URL, and a link to `officeUrl`. Followed by the localized `coverageNote` and a source link.
- **XSS-safe**: DOM construction only (`textContent`, `createElement`, attribute checks on URLs with `/^https?:\/\//`) — never `innerHTML`. Follow the subsidies IIFE precisely.
- **i18n**: new keys added to both the `es` and `en` `t` dictionaries in `_lib.js` (mirroring the `subs*` keys): `marksTitle`, `marksSub`, `marksBtn`, `marksLoading`, `marksEmpty`, `marksError`, `marksRetry`, `marksThMark`, `marksThStatus`, `marksThClasses`, `marksThDate`, `marksSource`, `marksSearchLink`, `marksCoverage`, `marksPartial`, `marksBadgeEu`, `marksBadgeEs`.

## Phasing

Two independent backend adapters behind one endpoint, so OEPM's fiddlier Axis-1.4 SOAP can lag EUIPO's clean REST:

- **Phase 1 — EUIPO end-to-end.** EUIPO adapter + full frontend panel + feature flag. Shippable alone; shows EUTMs. `counts.oepm` = 0, coverage note still shown.
- **Phase 2 — OEPM SOAP adapter** added to the same endpoint. No frontend change; `counts.oepm` populates.

## Prerequisites (human, cannot be automated)

- **EUIPO API Platform** (Phase 1) — two-stage, because production subscriptions require manual EUIPO approval + documentation:
  - **Development (no approval needed):** register an app in the **Sandbox** (`dev-sandbox.euipo.europa.eu`), subscribe to **both Trademark Search AND Persons** (name→applicant-identifier resolution) → sandbox `client_id`/`client_secret`. EUIPO explicitly allows API evaluation in Sandbox **without documentation**. All Phase-1 build + testing happens here. Caveat: sandbox may return synthetic/limited data — it validates the OAuth flow and response *shape*, not real EUTM coverage.
  - **Production go-live (deploy gate):** request the production Trademark Search subscription and **email the required documentation to `docs.apiplatform@euipo.europa.eu`**; wait for approval. The filing-API integration tests EUIPO describes do **not** apply (we use the read-only Search API, no DB writes). Production creds stored as Flask env vars `EUIPO_CLIENT_ID` / `EUIPO_CLIENT_SECRET` (sandbox creds used in staging).
- **OEPM Localizador** (Phase 2): register for web-service credentials via the OEPM access form; endpoint `https://consultas2.oepm.es/WSLocalizador/LDMWS` (WSDL at `?wsdl`). Stored as `OEPM_WS_USER` / `OEPM_WS_PASS`. **Deploy gate for Phase 2.**

## Error handling & resilience

- Backend: each adapter wrapped independently; if one source errors or times out, return the other's results plus a `partial: true` flag (do not fail the whole panel). Both fail → `{ success: false }`.
- Timeouts on both upstream calls (e.g. 8s) so the panel never hangs.
- Cache successful responses (per `name`+`nif`, ~24h) to protect OEPM/EUIPO from repeated hits and keep the panel fast — same rationale as the subsidies cache.
- Feature flag `TRADEMARKS_PANEL_ENABLED` defaults **off**; while off, endpoint returns `{ disabled: true }` and the section hides itself, so the frontend can ship ahead of the backend.

## Compliance & terms (EUIPO Conditions of Use of APIs, v2, 29/01/2026)

Reviewed against our public-facing reuse. **Verdict: compatible**, subject to these must-dos (baked into the design):

- **Licence (§3.4a):** "revocable, non-exclusive, non-transferable, non-assignable and royalty-free licence." Free reuse permitted, no non-commercial restriction. Because it's **revocable**, the `TRADEMARKS_PANEL_ENABLED` flag is also our kill-switch if the licence is withdrawn.
- **No implied endorsement (§3.2b iii):** must not imply association with or endorsement by EUIPO. → Attribute source as "Data: EUIPO / TMview" in plain text; **do not** use the EUIPO logo/branding; add "not affiliated with or endorsed by EUIPO."
- **Accuracy / no warranty (§8, §12):** data is as-is. → Show an "unofficial, may be incomplete, verify at source" disclaimer, consistent with the site's existing framing. Must not present misleading data (§3.2b iv).
- **Credentials confidential, server-side only (§3.6a):** never expose `client_secret` or tokens to the browser — already enforced by the backend fan-out design; secrets live only as Flask env vars.
- **Rate limits (§3.6c):** Office may impose/change limits at will; must not circumvent. → The 24h cache + graceful backoff already serve this; add polite retry/backoff, no parallel hammering.
- **Data protection — GDPR/EUDPR (§3.5):** the **user is the controller of the API Client** (§3.5d); trademark data can include **personal data of natural-person applicants**. Mitigations for v1:
  - The panel keys off a *company* name match, so holders are overwhelmingly legal persons.
  - Display holder **name + mark data only**; **do not display applicant postal addresses**.
  - Consider suppressing marks whose holder is clearly a natural person (mirrors the existing BORME officer-privacy stance) — decide during implementation.
  - **Action:** read EUIPO's published data-protection statement before go-live (§3.5f, user responsibility).

These obligations extend the frontend copy requirements: the panel's source/disclaimer line must state data origin, unofficial status, and non-endorsement. (OEPM terms — Ley 37/2007 / RD 1495/2011 reuse — reviewed separately in the scope section; add the equivalent OEPM attribution in Phase 2.)

## Testing

- **Frontend (this repo, vitest):** unit-test the `trademarksBlock` builder — renders a well-formed section with the button + i18n JSON + fetch handler; escapes company name/data; produces a button-only shell when marks are absent; both `es` and `en` copy present. `_lib.js` is a pure string builder, so this is straightforward.
- **Backend (ncdata-bormes):** adapter unit tests with recorded EUIPO/OEPM fixtures — status/type normalization, name-match filtering (true positives kept, obvious false positives dropped), merge/dedupe, partial-failure behavior.
- **Manual verification:** confirm end-to-end on a live allowlisted origin (localhost fetch fails on CORS) using a company with known EUTMs (Phase 1) and known ES national marks (Phase 2).

## Confirmed EUIPO sandbox API (probed 2026-07-15)

Base: `https://api-sandbox.euipo.europa.eu` (prod: `https://api.euipo.europa.eu`). OAuth2 `client_credentials`, `Authorization: Bearer`.

- **`GET /persons/applicants?name=<company>&country=ES&page=&size=`** → `{ applicants: [{ identifier, name, address, … }], totalElements, … }`. (Sibling of the verified `/persons/representatives`, same shape.) Use to resolve company name → applicant `identifier`(s); filter by normalized-name match. **Do not surface `address`.**
- **`GET /trademark-search/trademarks?query=applicants.identifier==<id>&page=&size=`** → `{ trademarks: [ … ], totalElements, totalPages, size, page }`. Each trademark: `applicationNumber`, `markFeature` (WORD/FIGURATIVE/…), `markKind`, `markBasis`, `wordMarkSpecification.verbalElement` (WORD marks only), `niceClasses[]`, `applicants[]:{office,identifier}`, `applicationDate`, `registrationDate`, `expiryDate`, `status` (e.g. REGISTERED). **No applicant name and no image URL in this payload** — name comes from the Persons step; images (figurative marks) need the details endpoint / image URL pattern (confirm during build).
- **`GET /trademark-search/trademarks/{applicationNumber}`** → adds `goodsAndServices[]`, `statusDate`, languages. Optional enrichment.

Both `/persons` and `/trademark-search` are **separate API products** — subscribe to both.

## Open questions to resolve during implementation

- Exact EUIPO Trademark Search query parameters for applicant-name filtering (verify in sandbox): field name, exact vs. contains, pagination.
- Whether EUIPO Trademark Search alone suffices or the separate "Persons" API is needed to resolve applicant → portfolio.
- OEPM SOAP client choice in Python (e.g. `zeep`) and auth header placement (username/password) — confirm from the WSDL.
- Dedupe rule when the same mark appears as both an EUTM and an ES national mark (unlikely — different registers — but define: dedupe by `denomination` + `holder` only if `source` differs and dates align).
