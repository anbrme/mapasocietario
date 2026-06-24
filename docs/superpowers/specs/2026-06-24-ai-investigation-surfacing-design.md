# Surfacing AI Investigation for Customers (Acquisition) — Design

**Status:** Approved design (2026-06-24). Frontend-only, `mapasocietario`. No backend change.

## Summary

Make the (now-live) AI Investigation a visible part of the paid Due Diligence product's value, to drive DD purchases. Acquisition-led: surface the real capability honestly at the points where the buy decision forms — primarily *in the graph the visitor is already exploring*, plus the DD/pricing pages and the checkout dialog. No new components; additive copy + one CTA path, reusing the existing gate and checkout.

## Goals

- **Acquisition (lead):** convince non-buyers that a DD (€22.50) is worth it partly *because* it includes 2 days of AI investigation. Convert at the decision point, in-context.
- Honest framing only: describe the genuine capability; **no hype, no fake social proof, no fabricated urgency** (per the project's analyst-not-salesman principle).

## Non-goals (v1)

- Homepage / top-of-funnel awareness placement (lower intent; deferred — revisit if the acquisition surfaces underperform).
- Activation messaging for existing buyers (email nudges, post-purchase prompts) — separate effort.
- Any new pricing tier or change to the €22.50 DD price.
- Any backend / entitlement / engine change.

## Framing principles (binding on all copy)

- **Factual capability, not salesmanship.** State what it does: "ask questions about a company's network and get answers that cite live web sources and separate registry facts from press reports; 2 days of access per report."
- **No fake social proof / urgency / superlatives.** No "thousands of users", countdowns, or "best".
- **Bilingual (en/es)** via each file's existing `COPY`/`SEARCH_COPY` object.
- Consistent name: **"AI Investigation" / "Investigación por IA"**, and always tie it to "included with a Due Diligence report" + "2 days".

## Surfaces & design

### A. Graph CTA (primary, highest-intent)

The canvas "Investigación por IA" launcher opens `AIInvestigationGate`. For a visitor without a valid token it currently shows only the unlock (email + code + Turnstile) step — a dead end for a non-buyer. Make that step serve both audiences:

- **Buyers (have a code):** the existing email + code unlock form — unchanged.
- **Non-buyers:** a value line + a **"Get the Due Diligence report"** CTA that opens the existing `DDCheckoutDialog` for the **focused company** (`primarySubject`). The gate never traps a non-buyer in a code form they can't complete.

Mechanics: `AIInvestigationGate` gains an `onBuy(company)` prop and a `focusCompany` prop; its unlock view renders a CTA region (value line + button) that calls `onBuy(focusCompany)`. `SpanishCompanyNetworkGraph` passes `onBuy={(name) => { setDdCheckoutCompany(name); setDdCheckoutOpen(true); }}` (both already exist in the graph) and `focusCompany={primarySubject}`. The CTA appears whenever the gate is in the unlock view (it's useful to buyers and non-buyers alike — a non-buyer buys, a buyer ignores it). Contained change; reuses the gate + the graph's existing checkout wiring.

### B. DD page + pricing feature block

- `SpanishCompanyDueDiligencePage`: add **"2-day AI investigation"** to the existing "what a report covers" chip set, and one short factual paragraph in the "what's included" area.
- `PricingPage`: add the same one-line feature to the DD tier's feature list.

Additive copy in the existing feature-chip/list layout; no new components.

### C. Checkout dialog reassurance line

- `DDCheckoutDialog`: one line in the order summary **near the price (below the email field)** — *"Includes 2 days of AI investigation on this company's network"* — reaffirming the value at the moment of payment. Reuses the existing summary-row layout.

**Mobile / Android constraint (binding).** The dialog already renders `fullScreen` at the `sm` breakpoint with the email field first in the content — keep it that way. The added line MUST go in the order summary near the price, **never above the email field**, and be a single compact row (no banner) so it cannot push the email field down or behind the soft keyboard. The checkout is used in the Capacitor Android app on a constrained viewport, so: the email field must stay visible and usable with the keyboard open, the content must remain scrollable, and the addition must not reduce readability. Verify at a narrow viewport (≤ `sm`) with the keyboard open — email reachable, nothing clipped.

## Components / files (frontend only)

- `src/components/AIInvestigationGate.jsx` — add `onBuy`/`focusCompany` props; render a non-buyer CTA region in the unlock view; add `COPY` strings (en/es).
- `src/components/SpanishCompanyNetworkGraph.jsx` — pass `onBuy` (opens `DDCheckoutDialog` for `primarySubject` via existing `setDdCheckoutCompany`/`setDdCheckoutOpen`) and `focusCompany={primarySubject}` to the mounted gate.
- `src/components/SpanishCompanyDueDiligencePage.jsx` — add the feature chip + paragraph (en/es).
- `src/components/PricingPage.jsx` — add the DD-tier feature line (en/es).
- `src/components/DDCheckoutDialog.jsx` — add the summary line (en/es via its `DD_COPY`).

## Success criteria

- A non-buyer exploring a company's network can, from the AI Investigation launcher, reach DD checkout for that company in one click (no dead-end code form).
- The DD page, pricing page, and checkout each state the included 2-day AI investigation factually and bilingually.
- Copy contains no fabricated social proof, urgency, or superlatives.
- No backend/entitlement/engine change; existing redeem flow for buyers is unchanged.
- On a constrained viewport / the Android Capacitor app, the checkout dialog stays readable and the email field remains visible and usable with the keyboard open — the surface-C line does not crowd or hide it.
