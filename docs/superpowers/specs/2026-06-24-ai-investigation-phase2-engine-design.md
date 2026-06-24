# AI Investigation — Phase 2: Investigation Engine — Design

**Status:** Approved design (2026-06-24). Replaces the Phase-1 stub in the `ai-investigation` worker's `/investigate` with the real engine. Implementation spans the worker (`standalone_rag/local-rag/workers/ai-investigation`) + a frontend rendering change (`mapasocietario`).

## Summary

Turn the gated, metered `/investigate` endpoint from a stub into a real graph-grounded investigation. For a curated selection of entities (≤10, from the canvas), the engine assembles a **trusted registry context** (canonical facts + derived signals), runs a **single OpenRouter call with native web search** that answers the user's question while separating provenance, and returns **structured JSON** the panel renders as registry/web cards + cited sources. The JWT gate, per-code rate limiting, and the Phase-1 request contract are unchanged; the cost cap becomes real.

## Goals

- Answer a user's question about the selected entities by blending **trusted registry facts** with **live, cited web findings**, with provenance always separated (registry vs web).
- Give the model **situational awareness** even for narrow/lazy questions: derived signals (size, governance cadence, stability) for context the user didn't explicitly select.
- Keep cost bounded and attributable (real per-code spend metering + a dedicated OpenRouter key with a dashboard ceiling).

## Non-goals (v1)

- The Brave query-planner / Brave LLM-Context orchestration (the original design's web layer). We use OpenRouter native web search instead; Brave stays a documented future upgrade.
- Sonnet escalation for "hard" queries (Haiku only in v1; easy tunable later).
- Per-redemption OpenRouter sub-keys via the `openrouter-provisioning` worker (documented upgrade path, not v1).
- Any change to the JWT/redeem/rate-limit path, the request contract, or the canvas selection UI (all shipped in Phase 1).

## Request contract (unchanged from Phase 1)

`POST /investigate`, JWT-gated + metered, body:
```json
{ "question": "...", "focus": {"id","name","type"}, "entities": [{"id","name","type"}], "edges": [{"source","target","type"}] }
```
`type` is `'company' | 'officer'`. Selection is capped at 10 entities (enforced client-side).

## Architecture

All inside `ai-investigation`'s `/investigate`, after the existing JWT-validate + rate-limit checks. Three units, each independently testable:

1. **Context assembler** (pure logic + injected `fetchImpl`) — registry lookups → a compact REGISTRY FACTS block.
2. **Synthesizer** (prompt builder = pure; OpenRouter call = injected `fetchImpl`) — one Haiku call with native web search.
3. **Response shaper** (pure) — validates/normalizes the model's JSON into `{answer, citations, usage}` and computes `estCostMicros`.

```
/investigate (JWT ok, rate ok)
  → assemble REGISTRY FACTS  (parallel /bormes lookups, ≤10 entities)
  → build prompt (registry block + question + entity-anchored web-search intent)
  → OpenRouter Haiku + openrouter:web_search, usage accounting on
  → shape response { answer:{summary,registry,web}, citations[], usage }
  → recordUsage(estCostMicros = real cost)   // Layer-1 spend cap now bites
  → return JSON
(Layer 2: OpenRouter key dashboard ceiling bounds total cost unconditionally)
```

### 1. Context assembler

Server-to-server `/bormes` calls (`api.ncdata.eu`, same pattern as `verify-dd-payment`), run in parallel, bounded by the ≤10 cap. Produces ONE compact REGISTRY FACTS block (derived signals, never raw dumps):

- **Per selected company** (`v3/company` + `v3/events`):
  - **Composition & size:** active counts of directors / apoderados / auditors; sole-shareholder / unipersonal status.
  - **Governance cadence:** appointments vs cessations across the registry span, flagged **linear vs spiky** with the years and the role level (executive vs apoderado) — e.g. "director churn clustered 2019–20 (5 changes), otherwise steady."
  - **Stability events:** count/timing of address changes, capital changes, dissolution/concurso markers.
  - **Registry span:** first/last filing, company age, current status.
- **Per selected officer** (`expand-officer`): person-screening profile — active vs ceased seat counts, across how many companies, with roles (e.g. "active administrador in 4 companies, ceased in 2").
- **Relationship structure:** the frontend-supplied `entities`/`edges` (already curated, free) — how the selection connects.

The signal set is ported from the proven logic in `borme_dd_report.py` (`officer_role_counts`, `canonical_governance`, churn cross-patterns, the facts block). **Degradation:** a failed lookup or unresolvable company degrades that entity to name-only (web search still anchors on the name); the investigation never fails wholesale on one lookup.

### 2. Synthesizer

One OpenRouter call: model `anthropic/claude-haiku-4.5`, `plugins: [{ id/type: 'web' /* openrouter:web_search */ }]`, `usage: { include: true }`, JSON response (mirrors `borme_dd_report.py`'s `_llm_json_round` + `_parse_llm_json`). The prompt encodes:

- the REGISTRY FACTS block, labelled as the **sole** source for registry claims;
- the user's question;
- **entity-anchored web-search intent:** anchor on legal name + CIF/NIF (disambiguate by province/sector), run the search intent in **Spanish and English**, split intents into adverse-media (fraude, concurso, blanqueo, sanción, investigación), general profile, and person-screening (names are surname-first in BORME);
- strict instructions: **separate provenance**, never assert a registry fact absent from the FACTS block, **cite every web claim** with an `[n]` marker, and if there are no relevant web findings say so rather than inventing.

### 3. Response shape & panel rendering

```json
{
  "answer": {
    "summary": "one-line direct answer",
    "registry": "Del registro (BORME): … grounded only in REGISTRY FACTS",
    "web": "Reportado en prensa/web: … each claim carries an inline [n]"
  },
  "citations": [{ "n": 1, "title": "...", "url": "..." }],
  "usage": { "cost_micros": 0, "model": "..." }
}
```

The panel's ask-phase answer area (today a single plain `Alert`) renders: the **summary** line; two labelled cards — **"Del registro (BORME)"** and **"Web / Prensa"**; and a numbered **Sources** list of clickable links. No markdown library (each field is plain text into a styled box; citations are links). Empty web → "sin menciones relevantes." Language follows `uiLanguage`. `usage` is for metering, not displayed.

## Model, cost & limits

- **Model:** `anthropic/claude-haiku-4.5` + native web search. Sonnet escalation deferred.
- **Key:** a **dedicated** `OPENROUTER_API_KEY` for this worker, stored as a wrangler secret (server-side only), **with its own spend ceiling set in the OpenRouter dashboard = Layer 2**. Not shared with the DD-report key, so this feature's blast radius is isolated and independently rotatable.
- **Real cost metering (closes a Phase-1 gap):** request `usage: { include: true }`; record the actual returned cost (LLM + web search) as `estCostMicros` via the existing `recordUsage`. The existing `checkRateLimit` `spend_cap` (200,000 micros ≈ €0.20/code) then genuinely enforces, alongside the unchanged 5/min + 40/day limits. If cost isn't returned, fall back to a token-based estimate.

## Error handling

- **Timeout:** ~30s on the OpenRouter call; on timeout/error → clean "couldn't complete, try again" (HTTP 502/504 with `{error}`); the panel shows a retry message.
- **Partial degradation:** failed `/bormes` lookup → entity name-only; malformed LLM JSON → one retry, then graceful error (no broken card).
- **No fabrication:** enforced by prompt (registry claims only from the FACTS block; citation required per web claim; empty web stated, not invented).

## Components / files

**Worker** (`standalone_rag/local-rag/workers/ai-investigation/`):
- Create `src/registry-context.js` — `assembleRegistryContext({focus, entities, edges}, env, fetchImpl)` → REGISTRY FACTS object; plus pure signal-derivation helpers (composition, cadence, stability) tested with fixtures.
- Create `src/synthesis.js` — `buildInvestigationPrompt(question, registryFacts)` (pure) + `runSynthesis(prompt, env, fetchImpl)` (OpenRouter call) + `shapeResponse(llmJson, usage)` (pure).
- Modify `src/index.js` — replace the `/investigate` stub body with: assemble → synthesize → shape → `recordUsage(realCost)` → return. JWT/rate-limit path unchanged.
- `wrangler.jsonc` — add `BORMES_API_BASE` var (default `https://api.ncdata.eu`); secret `OPENROUTER_API_KEY` (set via `wrangler secret put`).

**Frontend** (`mapasocietario`):
- Modify `src/components/AIInvestigationGate.jsx` — render the structured `{answer:{summary,registry,web}, citations}` as summary + two cards + Sources list (replaces the plain-text `Alert`). Backward-safe: if `answer` is a string (old shape), render as-is.

## Testing

- **Pure units** (`node:test`/vitest): signal derivation from fixture `v3/company`+`v3/events`; `buildInvestigationPrompt` includes the signals + anchoring intent; `shapeResponse` normalizes good/edge LLM JSON and computes `estCostMicros`.
- **Endpoint tests** (vitest, hermetic — inject `fetchImpl` for both `/bormes` and OpenRouter, like `verifyTurnstile`/`verifyDdPayment`): valid JWT + selection → assembled prompt carries the registry signals; mocked LLM JSON → correctly-shaped response; cost recorded; rate-limit/JWT failures still short-circuit before any OpenRouter call; degraded `/bormes` lookup → name-only, still succeeds.
- No live OpenRouter/Brave/`/bormes` calls in tests.

## Setup (gated — user runs)

1. Create a dedicated OpenRouter key; set its spend ceiling in the OpenRouter dashboard (Layer 2).
2. `wrangler secret put OPENROUTER_API_KEY` on the `ai-investigation` worker.
3. Deploy the worker; deploy the frontend (Pages) for the new rendering.

## Success criteria

- A redeemed user selecting entities on the canvas and asking a question gets a synthesized answer that (a) cites web sources for every web claim, (b) separates registry facts from reported ones, and (c) reflects derived signals (e.g. notes "32 apoderados → operationally broad" or a governance churn spike) even when not directly asked.
- No client ever holds the OpenRouter key; per-code rate + real spend caps hold; total spend bounded by the dashboard ceiling.
- Cost per investigation stays well under the DD margin.
