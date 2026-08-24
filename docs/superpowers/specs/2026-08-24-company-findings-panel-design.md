# Company findings panel — design

**Date:** 2026-08-24
**Status:** draft for review
**Repos touched:** `ncdata-bormes-impl` (endpoint + pure findings module), `local-rag/workers/api-proxy` (route), `mapasocietario` (panel)

## Summary

The company inspector shows facts (NIF, address, chips, officers with dates) but never a conclusion. A first-time visitor who has just selected a company sees "34 ceased" and has to decide for themselves whether that matters. This is the measured graph→offer leak: 94 users select a company, 23 open the order dialog.

This spec adds a **findings block at the top of the inspector**: a compact identity header, what changed, 3–5 interpreted one-line findings with dates and evidence links, a "needs verification" line, and the report offer. The findings are produced by the **same story spine that writes the paid report** (`dd_story.build_story`), projected to a free tier. Free = provenance (date, evidence link, later the BORME reference); paid = assembled reading, screening, citation package, PDF.

An outside "act as a customer" review (2026-08-24) identified this as the highest-leverage change; its four amendments (free provenance, identity first, qualified negatives, auto-exposure) are folded in below.

## Goals

1. A visitor who selects a company sees, without scrolling or clicking, *which entity this is*, *what changed recently*, *what may matter*, and *what we cannot see* — in under ten seconds.
2. Every finding has a date and links to the row it came from. No finding is a claim the user cannot check.
3. Findings shown free and findings in the paid report come from one engine, so the two surfaces can never contradict each other.
4. The block is the natural on-ramp to the report: the offer sits under the findings and names what the paid version adds.

## Non-goals (v1)

- Readings (`dd_readings`), the model-written opening, screening, risk levels: paid only, unchanged.
- Findings on `/empresa/:slug` SEO pages. Same endpoint would serve them; wiring the CF Pages Function is a separate task once the panel proves itself.
- Unifying monitoring-alert wording or search snippets with the spine. Right architecture, wrong moment — scope, not disagreement.
- BORME notice URLs per finding. That is Feature B ("ver en BORME"), backend work not yet done; the finding schema reserves the field so it lights up when B lands.
- The cross-company "same officer name at N companies" finding is **specified but gated off** (see §Findings, `officer_elsewhere`) until the officer name-order fix (committed 711177e/1b99561, unpushed) is deployed — before that the count is order-sensitive and would be wrong.

## Hierarchy (what the user sees, top to bottom)

1. **Identity** — is this the right legal entity
2. **What changed** — latest filing, recent material events
3. **What stands out** — interpreted findings
4. **Needs verification** — uncertainty and source limitations
5. **Evidence** — every item links into the table / events
6. **Offer** — the sourced report

Worked example (EN):

```
INDITEX, SA · NIF A15075062 · A Coruña
Latest BORME filing: 12 Jun 2026 — appointment

What stands out
• 3 governing-body changes published in the last 12 months            → rows
• Share capital reduced on 11 Mar 2024                                 → row
• Sole-shareholder declaration published 2019; any later change
  would appear as a new filing — none indexed                          → row
• No dissolution, liquidation or insolvency notice found in indexed
  BORME publications since 2009. Not a certificate of current status.

Needs verification
• The registry does not show beneficial owners; only sole-shareholder
  declarations are published.

Get the complete sourced assessment
Every finding with its BORME evidence, sanctions and adverse-media
screening, risk interpretation and a PDF. EUR 22.50 · first report free.
```

## Architecture & data flow

```
inspector opens (company selected)
  └─ GET api.ncdata.eu/bormes/v3/company-findings?group_key=…&lang=en
       └─ api-proxy Worker (dispatch + allowlist)  →  Flask borme_search_api
            └─ assemble_company_data(name, es)      (existing, registry-only)
               dd_story.build_story(data, registry=[], lang, ownership)
               dd_findings.build_findings(story, today, lang)   ← NEW pure module
               project_free(findings)                            ← NEW, strips paid fields
            ← JSON (cached 24h per group_key+lang, keyed on last_filing_date)
  └─ <CompanyFindings/> renders; findingsView.js (pure) decides order/labels
```

**One engine, two projections.** `dd_findings.build_findings` consumes the *story* (layers + detail blocks), not raw ES documents. The paid report will call the same function so its findings and the free panel are identical text; that wiring is a follow-up in the report renderer and is out of scope here except that the function must be designed for it (no HTTP, no ES, no locale side-effects).

## Backend

### `dd_findings.py` (new, pure)

```python
def build_findings(story: dict, today: date, lang: str) -> list[Finding]
def project_free(findings: list[Finding]) -> list[dict]
```

A `Finding` is:

```python
{
  'kind': str,          # see table
  'cls': 'concern' | 'context' | 'limitation',
  'text': str,          # one sentence, bilingual by lang, ALWAYS with a date when one exists
  'date': 'YYYY-MM-DD' | None,
  'layer': 'identity'|'activity'|'authority'|'ownership'|'shape'|'unseen',
  'evidence': [ {'kind': 'officer'|'event'|'capital'|'ownership', 'ref': str} ],
  'borme_ref': None,    # reserved for Feature B: {'date','section','page','url'}
  'paid_only': bool,    # True → stripped by project_free
}
```

`cls` is decided by **finding kind**, never by the renderer, so "potential concern" and "data limitation" cannot be confused downstream. Rules:

- `concern` — a dated registry fact a careful reader would want explained (structural event, capital reduction, dissolution notice, dense governing-body turnover).
- `context` — a dated registry fact with no default reading (previous name, sole-shareholder declaration, capital increase).
- `limitation` — something the registry cannot show. Always phrased as a limitation of *indexed BORME publications*, never as a statement about the world.

### Findings table (v1)

| kind | cls | from layer/detail | text rule (EN; ES equivalent) |
|---|---|---|---|
| `governing_body_turnover` | concern if ≥3, else context | `authority_shape.administrator_dates` | "N governing-body changes published in the last 12 months" — counts administrator/consejero appointments + cessations dated within 365 days of `today`; apoderados excluded; omitted if N = 0 |
| `structural_event` | concern | `shape_events.events` | one per event, newest first, max 2: "{Type} published on {date}" using the BORME type label (merger, spin-off, transformation, change of name, registered-office move, reactivation) |
| `insolvency_or_dissolution` | concern | `shape_events.events` where type ∈ {disolucion, liquidacion, concurso} | "{Type} notice published on {date}" — always shown when present, ahead of everything else |
| `no_insolvency_notice` | limitation | absence of the above | "No dissolution, liquidation or insolvency notice found in indexed BORME publications since 2009. This is not a certificate of current status." |
| `capital_movement` | concern if reduction, context if increase | `shape_events.capital` | "Share capital {reduced/increased} on {date}" — **omitted** if the summary carries no date; never "capital changed" without one |
| `sole_shareholder_declared` | context | ownership layer detail | "Sole-shareholder declaration published {year}; any later change would appear as a new filing — none indexed" — no "not reconfirmed" wording: declarations are one-off filings |
| `previous_name` | context | `identity_names.previous_names` | "Previously registered as {names}" |
| `superseded_seats` | context | `authority_shape.superseded` | "N seats superseded by later appointments" — branch on `supersession_kind`: succession vs re-inscription wording, never "replaced by" for re-inscription |
| `officer_elsewhere` | limitation | (gated) | "One officer name also appears at N other companies. BORME provides no person identifier, so these records may refer to different people." — **behind `OFFICER_IDENTITY_FINDINGS` flag, default off** |
| `power_density` | paid_only | `authority_shape.powers` | reading-adjacent; produced for the report, stripped from free |

Ordering: `insolvency_or_dissolution` first; then `concern` by date desc; then `context` by date desc; `limitation` last. Cap at 5 in the free projection; the count of dropped items is returned as `more` so the offer can say "and 3 more in the report".

**Needs verification** = the spine's `gaps` (already bilingual, already derived from the layers so they cannot disagree with the findings) plus any `limitation` finding beyond the cap. Gap sentences are free. The report's *recommended checks* per gap remain paid.

### Endpoint

`GET /bormes/v3/company-findings?group_key=<gk>&lang=<en|es>` (name fallback `?name=` for callers without a group_key, resolved through the same `_resolve_v3_company` as the report).

Response:

```json
{
  "company": {
    "name": "INDITEX, SA", "group_key": "…", "nif": "A15075062" | null,
    "province": "A Coruña" | null, "registry": "…" | null,
    "previous_names": [], "last_filing": {"date": "2026-06-12", "type": "appointment"} | null
  },
  "findings": [ {kind, cls, text, date, layer, evidence, borme_ref} ],
  "more": 0,
  "verification": [ "…gap sentence…" ],
  "coverage": { "since": "2009", "indexed_through": "2026-08-23" },
  "generated_at": "…", "lang": "en", "tier": "free"
}
```

- **Cache:** 24 h in-process per `(group_key, lang)`, key includes the company's `last_filing_date` so a new filing invalidates it. Cold path calls `assemble_company_data`, which is the report's assembler (events + PG officers + companies-owned); budget p95 < 1.5 s warm-index. If it proves heavier than that in practice, the plan adds a lighter assembler that skips `companies_owned` — not decided here.
- **Errors:** unknown company → 404 `{error:'not_found'}`; assembler failure → 502 with a logged stack, never a 200 with an empty list (an empty list means "nothing to report", which is a finding in itself).
- **CORS / proxy:** added in BOTH places in `local-rag/workers/api-proxy/src/index.js` — the `targetPath` dispatch in `handleSpanishCompaniesRequest` (unknown paths silently fall through to working-search) and the pathname allowlist (~line 1850). Deployed with `npx wrangler deploy` from `workers/api-proxy/src`. This has bitten twice; it is a checklist item in the plan.
- Anonymous, same rate limits as the other `/bormes/v3/*` reads.

### Tests

- `dd_findings.py` is pure: pytest over story fixtures (one real INDITEX-shaped story JSON, one dormant SL, one dissolved company, one with a capital reduction, one with no date on the capital summary). Assertions on kind, cls, ordering, cap, date presence, and that `project_free` strips `paid_only`.
- CI only runs root-level `tests_*.py`; the file is `tests_dd_findings.py` at repo root, not under `tests/`.
- The wording rules for `no_insolvency_notice` and `sole_shareholder_declared` are asserted verbatim in both languages — those sentences are the honesty contract.

## Frontend (`mapasocietario`)

### Files

- `src/components/CompanyFindings.jsx` — the block. Mounted as the **first** child of the inspector's company view in `CompanyInspectorPanel.jsx`, above the identity section it partly replaces (the identity header here supersedes the mid-panel name/NIF line; address/activity/capital stay where they are).
- `src/utils/findingsView.js` (+ `.test.js`) — pure: takes the API payload and returns `{ header, changed, findings, verification, offer }` with display labels, class→colour token, and evidence targets. All copy lives here or in the payload; the component has no strings.
- `src/services/spanishCompaniesService.js` — `getCompanyFindings(groupKey, lang)` via `fetchWithRetry`, 24 h client cache in the existing read-cache layer.
- Feature flag `FINDINGS_PANEL_ENABLED` in `src/config.js` (default **off**). Ships dark, flipped on after a live check.

### Rendering rules

- **Header:** `NAME · NIF … · Province`. NIF absent → `NIF not published in BORME` with the existing "know it? tell us" link (`onOpenReport('nif','')`). Never an empty slot.
- **What changed:** `Latest BORME filing: {date} — {type}`. If `last_filing` is null the line is omitted, not dashed.
- **Findings:** `concern` amber left rule, `context` neutral, `limitation` grey italic. Each with its date right-aligned and an evidence chevron that scrolls to / highlights the officer row or opens the events table at that event (reuse the panel's existing row handlers — no parallel navigation logic). `more > 0` → "and N more in the report" inside the offer.
- **Needs verification:** gap sentences as plain text.
- **Offer:** the existing report button and copy, with one added line naming what paid adds. The "1st free" badge stays.
- **Failure:** endpoint error → one grey line "Findings unavailable right now — the table below is unaffected" and a `findings_unavailable` event. Not hidden silently.
- **Loading:** three-line skeleton for at most 1.5 s; the rest of the panel renders immediately and does not wait.
- **Mobile:** the panel is a drawer; findings are first in scroll order, nothing else changes.
- **Auto-exposure:** already in place — the inspector auto-opens on company selection (shipped 2026-08-20) and landing deep-links carry `gk=`. This spec only puts findings at the top of that panel.

### Tests

- `findingsView.test.js` (vitest, node env): ordering, class mapping, header fallbacks, `more` wording, empty payload, error state.
- No component tests (project convention: node-only vitest). Browser verification on the live origin after deploy, both languages, one dissolved and one active company.

## Analytics

Existing: `graph_search_selection` (company selected), `view_item` (order dialog opened), `begin_checkout` (submitted), `checkout_failed`, `checkout_redirect`.

Added:
- `findings_visible` `{ count, concerns, limitations, more }` — once per company per session when the block renders with data
- `evidence_clicked` `{ kind }`
- `free_report_selected` — in `DDCheckoutDialog` when the free toggle is ticked
- `findings_unavailable` `{ status }`

Primary metrics: `graph_search_selection → view_item` (today 94→23) and `view_item → begin_checkout` (23→6). The intermediate events say *why* if the primary does not move. At ~12 real users/day, expect four to six weeks before intermediate ratios are readable; do not redesign on a week of data.

## Rollout

1. Backend module + tests + endpoint, deployed via push to `main` (CI ff's server-current). Endpoint is harmless dark.
2. Proxy route (both places) deployed with wrangler.
3. Frontend behind `FINDINGS_PANEL_ENABLED=false`; verify against the live endpoint from a local build; flip the flag; deploy.
4. Read the numbers at four weeks.

## Success criteria

- A selected company shows header + findings within 1.5 s on a warm index, in EN and ES.
- Every finding rendered has a date and a working evidence target; the two negative/limitation sentences match the spec verbatim.
- The same `build_findings` output is what the report will consume — no second finding generator exists anywhere.
- `graph_search_selection → view_item` improves from ~24% at the four-week read. If it does not, the intermediate events identify which of visibility, trust, or checkout is the blockage.

## Decisions recorded here

- Free/paid boundary: provenance free (date, evidence, later BORME ref); reading, screening, citations package, PDF paid. Decided 2026-08-24.
- Negative findings are limitations of *indexed publications*, never certificates of status.
- Shared-officer finding: specified, gated off until name-order fix is deployed.
- `/empresa` pages: same endpoint, later task.
