# BORME MCP Connector — Design

**Status:** Approved design (2026-06-24). New Cloudflare Worker (`borme-mcp`) in `standalone_rag/local-rag/workers/`. Read-only, anonymous, wraps the live `/bormes` API. No backend change for v1.

## Summary

A public, anonymous, read-only **remote MCP server** that exposes Spanish company-registry facts (BORME-derived) to Claude users as a connector. It wraps the same live `/bormes` endpoints the website already uses — so its data is current by construction — and presents results with attribution and links back to `mapasocietario.es/empresa/:slug`. The point is **reach and credibility**: surface our distinctive registry + corporate-graph data where high-intent users already are, accurately and authoritatively. Revenue is deferred (no auth, no keys, no billing); if usage justifies it, a tiered/keyed model can be added later.

## Goals

- **Reach:** make Spanish company/officer/relationship lookups available to any Claude.ai user via a one-add connector.
- **Credibility:** results are accurate, current, honestly scoped (clear about what BORME does and does not contain), and consistently presented — including the same dissolution rule the rest of the product applies.
- **Attribution loop:** every company result links to its `/empresa/:slug` page (ties into the acquisition/SEO strategy).

## Non-goals (v1)

- **Auth / API keys / billing / tiers.** Anonymous and free for now. Revisit only if usage warrants.
- **Claude Code plugin packaging.** The remote MCP is the deliverable; a Code-plugin wrapper is a cheap follow-up, explicitly deferred.
- **Paid-DD value-adds:** sanctions/PEP screening, AI red-flag analysis, PDF reports — not in the BORME API and out of scope. The connector is the *free-graph* equivalent, not the paid report.
- **Cuentas Anuales / financial statements** — those are Registro Mercantil documents (licensing boundary); never exposed.
- **Cross-company temporal/event-class queries** (e.g. "companies that changed registry between March and May 2026"). Not supported by existing endpoints; see Phase 2.
- **Write operations, monitoring/alerts, anything stateful.**

## Framing principles (binding on all copy & output)

- **Accuracy over breadth.** Better to answer fewer questions correctly than many questions loosely. Honest about BORME's limits (e.g. only sole-shareholder ownership is recorded).
- **Attribution, not advertising.** Each company result carries a neutral `source_note` and an `empresa_url`. No hype, no fabricated social proof, no superlatives.
- **Consistency with the product.** The connector applies the same registry-faithful rules as the site and DD report — notably the dissolution rule (after a dissolution, no officer is reported as current).
- **No cannibalization of paid DD.** Registry facts only; the connector helps users *find and understand*, not replace the documented report.

## Architecture

A new Worker **`borme-mcp`** in `standalone_rag/local-rag/workers/borme-mcp/`, alongside `ai-investigation`.

- **Transport:** spec-compliant remote MCP over **Streamable HTTP**, built on the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`). Read-only tools are stateless; no session store.
- **Hosting:** custom domain **`mcp.mapasocietario.es`** (on-brand; `mcp.ncdata.eu` is already taken by the internal REST worker). Worker route on a subdomain under the Pages apex.
- **Data source:** calls the **live `/bormes` API** (`rag.ncdata.eu`) directly over HTTPS. The Worker holds **no data, no DB binding, no index** — it is a pure protocol + formatting + attribution layer. Freshness is guaranteed because it reads the same `*_live` indices the site reads.
- **Auth:** none (anonymous).
- **Abuse control:** per-IP rate limiting (see below).
- **Retire:** the old stdio `spanish-companies-mcp-server` is deprecated — it predates the entity-assembled/XML-ingested backend (stale data) and cannot be a Claude.ai connector (stdio, not remote). Documented as deprecated; not deleted by this spec.

**Why a pure wrapper:** keeping zero data in the Worker is the single most important credibility decision — there is no second copy to drift, and entity assembly / dedup / enrichment are inherited automatically.

## Tools (v1)

All tools return concise structured JSON (LLM token-budget aware). Every company object carries `empresa_url` (`https://mapasocietario.es/empresa/<slug>`) and the company-level results carry a `source_note` (`"Unofficial; derived from BORME (Registro Mercantil) publications."`). Inputs are validated; unknown/empty inputs return a clear tool error, not a 500.

### 1. `search_companies`
- **Input:** `{ query: string (required), limit?: number (default 10, max 25) }`
- **Output:** `{ results: [{ name, status, province?, incorporation_year?, empresa_url }], note? }`
- **Backend:** `GET /bormes/v3/search` (with `working-search` as the ranking the site uses). Fuzzy/autocomplete matching is already provided by the backend — typos and partial names return ranked candidates. If the top match is weak, `note` advises the model to disambiguate among the returned candidates rather than assume.

### 2. `get_company`
- **Input:** `{ name?: string, slug?: string }` (one required; `name` is fuzzy-resolved)
- **Output:** `{ name, status, dissolved: boolean, incorporation_date?, nif?, address?, capital?, current_officers: [{ name, role }], former_officers: [{ name, role }], sole_shareholder?: string|null, sole_shareholder_note, capital_events: [{ date, type, detail }], empresa_url, source_note }`
- **Backend:** `GET /bormes/v3/company` (envelope `{company:{}}`; role = `position_normalized`; events are `{type,category}`). Resolves `name` to a single entity via the same search ranking; if ambiguous, returns the top candidate plus a `disambiguation` list.
- **Dissolution rule (binding):** when `dissolved` is true, **no officer appears in `current_officers`** — all are moved to `former_officers`, and `source_note` carries the standard line that BORME may not have inscribed a formal cessation. Mirrors the site graph and the DD report.
- **Ownership honesty (binding):** `sole_shareholder` is populated only when BORME records a sole shareholder (socio único). `sole_shareholder_note` always explains: *"BORME records only sole-shareholder ownership (socio único); it does not contain a general shareholder/cap-table. Absence here does not imply no owner."* This is how the typo'd "who owns X" question gets a correct, non-misleading answer.

### 3. `search_officers`
- **Input:** `{ name: string (required), limit?: number (default 10, max 25) }`
- **Output:** `{ results: [{ officer_name, company_name, role, empresa_url }], note? }`
- **Backend:** `working-search` (officer mode) / `GET /bormes/v3/expand-officer`. Answers "is officer Z present in other companies?" directly. Fuzzy-matched on the person name; name-variant handling (order/accents/hyphen) is the backend's.

### 4. `get_company_network`
- **Input:** `{ name?: string, slug?: string }` (one required)
- **Output:** `{ company, connected: [{ name, relationship: "shared_officer" | "owns" | "owned_by", via?: string, empresa_url }], truncated: boolean }`
- **Backend:** composed server-side: `v3/company` (officers + sole-shareholder/participation links) + `v3/expand-officer` for officers shared with other companies. **Fan-out capped at 25** connections; `truncated: true` when more exist (no silent cap). Answers "is there a relationship between company X and company Y?" — the model calls this on X and checks for Y (and may cross-check with `get_company`).

## Capability matrix (example questions → tools)

| User question (incl. typos) | Handled by | Notes |
|---|---|---|
| "who owns this compaany X?" | `get_company` → `sole_shareholder` (+ note) | BORME = sole-shareholder only; note prevents a misleading "no owner" |
| "find COMPNY ACME" (typo) | `search_companies` | backend fuzzy/autocomplete returns ranked candidates |
| "is there a relationship between X and Y?" | `get_company_network` (+ `get_company`) | direct shared-officer / ownership edges, capped 25 |
| "is officer Z in other companies?" | `search_officers` | person → all linked companies |
| "show officers / status / capital of X" | `get_company` | dissolution rule applied |
| "which companies moved registry between Mar–May 2026?" | **Not supported in v1** | needs new backend endpoint — see Phase 2 |

## Phase 2 (future, requires backend work — out of scope here)

A `search_events` tool answering **cross-company, event-type + date-range** questions (registry transfers / traslados, capital changes, dissolutions, name changes within a window). It depends on a **new backend endpoint** in the Flask API (gated `server-current` repo): e.g. `GET /bormes/v3/events/search?event_type=&from=&to=&province=` aggregating over `borme_events_v3`. Documented now so the connector is honestly scoped; built only if/when the backend endpoint exists. The connector's tool would then wrap it and return `[{ company_name, event_type, event_date, empresa_url }]` with explicit result caps.

## Attribution & credibility framing

- Every company object includes `empresa_url`; the model is encouraged (via tool descriptions) to cite it.
- `source_note` on company-level results: unofficial, BORME-derived.
- The MCP **server instructions** (returned at initialize) state plainly: coverage (3.1M companies, 9.4M filings since 2009), that data is BORME-derived and unofficial, that ownership is sole-shareholder-only, and that for documented/critical use the paid Due Diligence report and the official BORME exist. This sets accurate expectations up front.
- No emojis, no marketing language in tool output.

## Rate limiting & abuse control

- Per-IP token-bucket using the same approach as the `ai-investigation` worker (Cloudflare KV or a Durable Object counter keyed on `CF-Connecting-IP`). Proposed limits: **30 requests/min and 1,000/day per IP** (generous for genuine use, caps scraping). On exceed: a clean MCP tool error ("rate limit reached, try again shortly"), not a hard 429 that breaks the client.
- Per-tool result caps (search ≤25, network fan-out ≤25) bound cost per call.
- Upstream timeouts: each `/bormes` call has a bounded timeout (e.g. 15s); on upstream failure the tool returns a clear, retryable error.

## Error handling

- Input validation errors → structured tool errors with a human-readable message (not exceptions).
- Empty results → a normal, non-error response (`results: []`) with a `note` ("no company matched; try a different spelling").
- Upstream `/bormes` non-200 / timeout → tool error: "registry service temporarily unavailable."
- Never leak internal URLs, index names, or stack traces to the client.

## Freshness & data boundary

- **Freshness:** inherited — the Worker queries the live `*_live` aliases via the public API; nothing is cached beyond short-lived edge caching (if any). No re-ingestion, no copy.
- **Boundary:** BORME/BOE-derived company/officer/graph data + our own `enriched_*` fields only. **Excluded:** Cuentas Anuales/financial statements (Registro Mercantil documents), sanctions/PEP/AI-analysis (paid-DD value-adds), CORPME official-statistics CSV (separate licence). BORME/BOE reuse is the same basis the public site already operates under — no extra licence needed for v1 tools.

## Components / files (new Worker only)

- `standalone_rag/local-rag/workers/borme-mcp/wrangler.jsonc` — name `borme-mcp`, custom domain `mcp.mapasocietario.es`, `BORMES_API_BASE` var, KV/DO binding for rate limiting.
- `src/index.js` — Worker entry: MCP Streamable HTTP handler, server instructions, tool registration, rate-limit gate.
- `src/tools/*.js` — one module per tool (`search-companies`, `get-company`, `search-officers`, `get-company-network`), each: validate input → call `/bormes` → shape + attribute output.
- `src/bormes-client.js` — thin typed client over the live `/bormes` endpoints (timeouts, error normalization).
- `src/format.js` — shared shaping/attribution (`empresa_url` builder, `source_note`, dissolution-rule presentation, fan-out cap).
- `src/ratelimit.js` — per-IP limiter (ported from `ai-investigation`).
- `test/` — unit tests for shaping/attribution/dissolution/cap logic with mocked `/bormes` responses (hermetic, no live network).

## Testing

- **Pure logic (node:test / vitest-pool-workers):** output shaping, attribution URL building, the dissolution presentation rule, sole-shareholder note inclusion, network fan-out cap + `truncated` flag, input validation, error normalization — all with mocked upstream responses.
- **Smoke (manual / scripted, against live API):** each tool against a known entity — a clean active company, a dissolved one (verify no current officers), a sole-shareholder case, a no-match typo, an officer present in multiple companies, and a two-company relationship.
- No live-network calls in the automated suite.

## Success criteria

- A Claude.ai user can add the connector and, in one turn, search a Spanish company, get its registry profile (with correct dissolution handling), find an officer's other companies, and check a relationship between two companies — each result linking to `/empresa`.
- A typo'd company/officer name still returns ranked candidates; "who owns X" returns the sole-shareholder (or an honest note about BORME's ownership limits) — never a misleading "no owner."
- Data shown matches the live site (same backend); the Worker stores none.
- The connector exposes no paid-DD value-adds and no Registro Mercantil documents.
- The unsupported temporal-event query is clearly out of scope, with a defined Phase 2 path.
- Automated tests pass hermetically; no auth, no keys, no billing in v1.
