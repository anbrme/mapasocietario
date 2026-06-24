# AI Investigation — Canvas Surface — Design

**Status:** Approved design (2026-06-24). Implementation in the `mapasocietario` repo (frontend only; no backend change).

## Summary

Move the AI Investigation from a single order-page dialog to its intended home — the **network graph (canvas)**. A user who has redeemed (email + code → 2-day JWT) can, at any time within the window, **curate a small set of entities** (companies + officers) directly on the graph and run a focused, graph-grounded investigation on exactly that selection. This realizes the original spec's "graph-grounded 'Ask about this network' panel" and matches the entitlement model: the JWT carries the 2-day window + rate tier and is **not** bound to any single company, so the buyer can investigate any company they explore during the window.

**No backend change.** The `ai-investigation` worker already meters by code (not company) and the `/investigate` endpoint is company-agnostic. This is a frontend surfacing + token-persistence + selection-UX task. The Phase 1 stub answer remains until the Phase 2 engine ships; the request payload is finalized now so Phase 2 is a drop-in.

## Goals

1. Let an authorized user invoke an investigation **from the canvas**, for any company/officer they're viewing, anytime in the 2-day window.
2. Let the user **curate the exact entity set** to investigate (e.g. 4 specific officers out of 12 across 3 companies) rather than being limited to one focused company.
3. Persist the entitlement so the user redeems **once** and then investigates freely until expiry.

## Non-goals (v1)

- The Phase 2 investigation engine (Brave query-planner + LLM synthesis). The worker still returns the stub; this design only finalizes the frontend contract.
- Any backend/worker change (rate limiting, JWT, `/redeem` are untouched).
- A "large-network analysis → reduction → focus" mode. A big selection is **blocked with guidance**, not handled by a special reduction mode. (Good future idea; explicitly deferred — YAGNI.)
- Removing the order-page surface. It stays as the post-purchase nudge.

## Concept & scope

- **Primary surface:** the company network graph (`SpanishCompanyNetworkGraph`).
- **Interaction:** build an *investigation selection set* of graph nodes, then launch a context-aware investigation panel scoped to that set.
- **Identity:** the existing email + code → JWT, now persisted in `localStorage` for the 2-day window.

## Design

### 1. Selection model

A new `investigationSet` — a `Set` of node ids (companies and/or officers) — held in `SpanishCompanyNetworkGraph`. Three ways to add/remove a node, all toggling the same set:

- **Shift/⌘-click** a canvas node (toggle add/remove). Plain click is unchanged — it still navigates/expands the node, so no existing behavior breaks. Selection happens **only** via shift/⌘-click, the table, or the menu.
- **Linked-persons table** — a tick/action per row ("Añadir a investigación").
- **Node right-click context menu** — an "Añadir a investigación" item (toggles membership).

Selected nodes get a distinct visual treatment on the canvas (a colored selection ring drawn in the existing `linkCanvasObject`/node renderer) so the set is always visible at a glance.

A floating control shows **"Investigar selección (N)"**:
- Enabled when `1 ≤ N ≤ 10`.
- When `N === 0`, it falls back to the **focused company** (`primarySubject`) as a one-entity selection.
- When `N > 10`, it is **disabled** and reads "Reduce la selección a 10 entidades" (block-with-guidance; never silently trim).

**Cap = 10 entities** (companies + officers combined) per investigation. Rationale: each entity becomes multiple entity-anchored web searches + registry lookups in Phase 2; depth beats breadth, and the per-code spend cap and latency stay sane. The explore→find→focus loop is preserved by running several focused investigations (each metered).

### 2. Authorization & token persistence

On a successful `/redeem`, store `{ token, expiresAt }` in `localStorage` under `ai_investigation_token`. The entitlement then survives reloads/navigation — redeem **once**, investigate until expiry.

The panel (`AIInvestigationGate`, reused) is context-aware:
- **No valid stored token** → unlock step (email + code + Turnstile) → on success, store token → continue to the ask step.
- **Valid stored token** → open straight to the ask step.

A status chip on the canvas toolbar surfaces entitlement state:
- Authorized → e.g. "IA · 1 día restante" (computed from `expiresAt`).
- Not authorized → "Investigación por IA" as the call-to-action.

`isTokenValid(stored, nowSec)` (already built) is checked before each call; an expired token silently drops to the unlock step with a message (already built).

### 3. Investigation request payload

When the user asks, `POST ${AI_INVESTIGATION_API}/investigate` carries the curated context (not just a question):

```json
{
  "question": "<free text>",
  "focus": { "id": "company-...", "name": "...", "type": "company" },
  "entities": [
    { "id": "company-...", "name": "...", "type": "company" },
    { "id": "officer-...",  "name": "...", "type": "officer" }
  ],
  "edges": [
    { "source": "<id>", "target": "<id>", "type": "<relationship/role>" }
  ]
}
```

- `entities` = the selected set (or the single focused company when the set was empty), each `{ id, name, type: 'company'|'officer' }`.
- `edges` = the visible graph edges **among the selected entities** (relationships/roles), so the model sees how the selection connects.
- `focus` = the primary subject for framing (the focused company, or the first selected entity).

In Phase 1 the worker ignores `focus`/`entities`/`edges` and returns the stub; the shape is fixed now so Phase 2 needs no frontend change. The worker's JWT validation + per-code rate/spend metering are untouched (it reads the JWT and meters by code only).

### 4. Order-page surface & error handling

- The **order-page gate stays** (post-purchase nudge; shows/prefills the code). It shares the same `AIInvestigationGate` component and the same `localStorage` token, so redeeming there authorizes the canvas too, and vice-versa.
- Errors degrade quietly: 429 → "límite alcanzado, prueba en un momento"; expired token → back to unlock; selection over cap → disabled launch button with guidance; network/worker error → generic retry message.

## Components / files (frontend only)

- `src/components/SpanishCompanyNetworkGraph.jsx` — `investigationSet` state + the three add/remove entry points (shift/⌘-click handler, table action, context-menu item); selection-ring rendering; the "Investigar selección (N)" control + cap logic + fallback; the toolbar status chip; mounts `AIInvestigationGate` with the built context.
- `src/components/AIInvestigationGate.jsx` — accept an `entities`/`edges`/`focus` context; persist/load the token from `localStorage`; on open with a valid token skip to the ask step; send the new `/investigate` payload.
- `src/utils/aiInvestigationClient.js` — token persistence helpers (`saveToken`/`loadToken`/`clearToken`) and `buildInvestigatePayload({ question, focus, entities, edges })`; reuse existing `isTokenValid`/`buildInvestigateHeaders`.
- `src/components/OrderStatusPage.jsx` — switch its gate to the shared `localStorage` token (so redeeming on the order page persists for the canvas). Otherwise unchanged.

## Success criteria

- A redeemed user can shift/⌘-click (or use the table / right-click menu) to select up to 10 entities and launch one investigation scoped to exactly that set, with the selection visibly highlighted.
- Redeeming once persists the 2-day entitlement across reloads and navigation; the toolbar chip reflects remaining time; expiry drops cleanly back to unlock.
- Selecting >10 blocks the launch with guidance; an empty selection falls back to the focused company.
- The `/investigate` payload carries `{ question, focus, entities, edges }`; Phase 1 still returns the stub; no worker change is required.
