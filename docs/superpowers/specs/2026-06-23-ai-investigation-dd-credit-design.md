# AI Investigation, gated by a DD-purchase credit — Design

**Status:** Approved design (2026-06-23). Implementation to happen in a fresh session, directly in the `mapasocietario` repo.

## Summary

After a customer buys a Due Diligence (DD) report, the confirmation email includes the report link **and a redemption code bound to their email**. Entering *email + code* on mapasocietario unlocks an **AI Investigation** panel for a **2-day, rate-limited** window. The assistant answers questions about a company/network by blending:

- **(a) trusted structured facts** — the canonical BORME graph + relational data (officers, ownership, connections) that was hardened in `ncdata-bormes` (the `officer_status` resolver / v3 `officers_active`), and
- **(b) live, cited web search** — adverse media, recent news, current status that a registry structurally cannot provide,

into a single synthesized answer with **clear provenance labels** (registry vs web) and **citations**.

## Goals

1. **Drive DD purchases (acquisition).** Advertise "every DD includes 2 days of AI investigation" as part of the paid product's value.  
2. **Retain & cross-sell (engagement).** Exploring a company's network surfaces *new* entities worth investigating → the user buys another DD. The AI investigation is the engine of that loop.

Both are served by anchoring on mapasocietario's unique asset — the **network graph** — rather than a commodity search.

## Non-goals (v1)

- Free-form Text-to-SQL / generic open-ended BORME NL search (partly redundant with the DD; the relational Text-to-SQL path is the fragile one).
- User accounts / passwords. **The email + code is the lightweight identity.**
- Chat-with-the-PDF.
- Brave "Answers/research mode" synthesis (it would bypass our controlled provenance — see Web Search).
- Per-redemption OpenRouter sub-keys (single shared key + proxy metering is enough for v1).
- A free trial for non-buyers.

## Concept & scope

- **Surface:** a graph-grounded "Ask about this network" panel on the company/graph the user is viewing.
- **Identity:** email + code (no accounts).
- **Window:** **2 days** from purchase (the urge to explore is right after buying; short window also shrinks abuse surface and makes generous-but-fair rate limits easy).
- **Answer = trusted graph/relational facts + cited web search**, never free-form SQL.

## Architecture

**Model: a signed entitlement token (JWT), enforced by a proxy worker that holds the single shared OpenRouter key.** The client never touches an OpenRouter key. Reuses existing infra (`payments.ncdata.eu`, the `api-proxy`/`brave-proxy` worker pattern, Cloudflare Pages `functions/`, `wrangler.toml`).

Five components, each with one job:

1. **Mint** — in the `payments.ncdata.eu` post-payment (Stripe-confirmed) step: generate a unique code bound to the buyer's email; store `{code, email, dd_order_id, paid_at, expires_at = paid_at + 2d, status}`. The code is included in the existing DD email.
2. **Entitlement store** — the codes table + a usage counter (Cloudflare D1 or KV). Single source of truth for "is this code valid / how much has it used."
3. **Redeem endpoint** (Cloudflare Pages Function) — input `email + code` → validate (exists, email matches, not expired) → **bind code↔email on first use** → return a short-lived signed **JWT** carrying `{code_id, window_expiry, rate_tier}`. **Turnstile-gated** to stop code-guessing.
4. **AI proxy worker** (extends the `api-proxy` pattern) — every AI call carries the JWT. The worker: validates the JWT; enforces **per-code rate limits + spend cap** (Layer 1, see Limits); orchestrates the answer using the **shared** OpenRouter key + the web-search module; returns the synthesized answer. Gatekeeper for cost and abuse — the only holder of the OpenRouter key.
5. **Frontend** (mapasocietario) — a **redemption UI** (email + code) and the **AI Investigation panel** on the graph.

## Entitlement & limits (incl. shared OpenRouter key handling)

The shared OpenRouter key is just the **funding source**. OpenRouter's key-level limits apply to the *whole* key (all users combined), so per-user fairness is **not** delegated to OpenRouter — the proxy does it. Two layers:

- **Layer 1 — per user (proxy-enforced).** Before forwarding any call, the proxy checks the code's usage in the entitlement store against its rate tier + spend cap and rejects if exceeded. Starting tier (tunable): **~5 req/min, ~40/day**, hard **2-day** expiry, plus an under-the-hood **per-code spend cap** backstop.
- **Layer 2 — global backstop (OpenRouter on the key).** A credit/spend ceiling set on the OpenRouter key itself, so a bug or a flood of redemptions can't drain unlimited funds. Bounds the blast radius unconditionally.

**Why the shared key is safe:** it is only usable *through* the proxy, and the proxy requires a valid JWT minted from a *paid* code. No anonymous path reaches it. Realistic worst case = "a paying user maxes their own rate limit for 2 days," already bounded by Layer 1.

**Funding math:** each DD grants ~2 days of bounded use (≤~40 Haiku queries/day + a few web searches) ≈ a few cents to ~€0.10 of real usage per DD against the €5 margin. Keep the key topped to `DDs/month × that`; Layer 2 is the hard ceiling.

**Setup answer:** create **one** OpenRouter key, store it as a secret in the proxy worker only, never client-side; rotate periodically. (Upgrade path, not v1: OpenRouter *provisioning keys* to mint a per-redemption sub-key with its own hard cap — more robust per-user isolation, but adds key lifecycle management.)

## Web search strategy module

The "spotty" feeling from naive web search comes from thin SERP snippets. The fix is endpoint choice + a multi-query planner.

- **Primary grounding: Brave LLM-Context endpoint** — returns cleaned, citation-bearing extracts formatted as LLM grounding context (ideal for RAG; richer than raw web search). Confirm field shape against docs at build time.
- **Freshness/adverse-media lane: Brave News Search** — time-filtered, dated, sourced. Core to DD ("recent concurso, sanción, investigación, blanqueo?").
- **Web Search**: general fallback only.
- **Skip Answers/research-mode for v1** — it makes Brave synthesize, bypassing our controlled blend of registry + web with provenance. (Revisit later as a premium "deep research" button.)

**The real lever — an LLM query-planner.** Per investigation, fan out 2–4 *entity-anchored* queries:
- anchor on **legal name + CIF/NIF**, disambiguate by province/sector (kills name-collision noise);
- run a **Spanish pass (country=ES, lang=es)** *and* an English pass;
- split intents: **adverse-media terms** (fraude, concurso, blanqueo, sanción, investigación) vs **general profile** vs **person screening** (BORME stores names surname-first);
- route recency to News, depth to LLM-Context.

Combine the cited results → feed to the synthesis LLM. Trade-off: latency ~5–15s per investigation (acceptable for a deliberate action); cost negligible. Reuse the existing `brave-proxy` worker.

## Investigation engine (behind the gate)

For one question:

1. **Context assembly (trusted):** the visible graph (nodes/edges + the focused company id) + canonical relational lookups via the hardened `/bormes` endpoints (`pg/expand-company`, `pg/expand-officer`, `v3/company`, etc. — current officers/ownership/connections). No Text-to-SQL.
2. **Web search (fresh):** the query-planner + LLM-Context + News lanes → cited context.
3. **Synthesis:** LLM (default Haiku; Sonnet for hard queries) produces an answer that **separates provenance** — "From the registry: …" vs "Reported in the press (sourced): …" — with inline citations for every web claim. Mirrors the jurisdiction/citation pattern in standalone_rag.

## Data flow

```
Stripe payment confirmed (payments.ncdata.eu)
  → mint code (bound to email, +2d expiry) → store → include in DD email

User: enter email + code (Turnstile)
  → Redeem function: validate + bind → issue 2-day JWT

User asks a question in the AI Investigation panel
  → AI proxy (JWT-gated): validate + meter (Layer 1)
     → assemble context [visible graph + canonical /bormes lookups]
     → web-search module [query-planner → LLM-Context + News, cited]
     → LLM synthesis (provenance-labelled + citations)
  → answer + citations → panel
(Layer 2: OpenRouter key spend cap bounds total cost unconditionally)
```

## v1 scope & build sequence

Each step is independently testable; build the money/access path first, then the intelligence, then the UI.

1. **Entitlement spine** — mint → redeem → JWT → proxy gate, returning a **stubbed** answer. Proves the paid-access loop end-to-end before any AI.
2. **Investigation engine** — context assembly + web-search strategy + synthesis with citations, behind the gate.
3. **Frontend** — redemption UI + AI Investigation graph panel, wired to 1 + 2.

## Out of scope / later

Per-redemption OpenRouter sub-keys; Brave research-mode "deep research" button; free trial for non-buyers; chat-with-PDF; stackable windows on repeat purchases.

## Open questions / to confirm at implementation

- **`payments.ncdata.eu` internals** — where exactly the Stripe-confirmed post-payment hook is, to mint the code and inject it into the DD email. (Separate service, not yet opened.)
- **Entitlement store** — D1 vs KV (D1 for the codes/usage relational data is likely cleaner).
- **Exact Brave LLM-Context response shape** — confirm against docs; finalize how citations are extracted.
- **JWT signing/secret management** across the redeem function and the proxy worker.
- Final **rate-tier numbers** after a small real-usage check.

## Success criteria

- A buyer can redeem email+code and run a graph-grounded investigation within 2 days, with answers that cite web sources and clearly separate registry facts from reported ones.
- No client ever holds the OpenRouter key; per-user limits hold; total spend is bounded by the OpenRouter cap.
- Cost per DD's AI usage stays well under the DD margin.
