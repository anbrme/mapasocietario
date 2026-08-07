# DD website copy: accurate screening claims — design

**Date:** 2026-08-07
**Goal:** Make the site describe what the due diligence report now actually does — official sanctions-list screening and adverse-media screening — and make the report easier to evaluate before buying.

## Why now

The external-intelligence layer shipped and is live. §7 of the report now performs:

- **Sanctions screening** against the OFAC SDN list and the EU consolidated list, both with their publication dates printed in §7.1.
- **Adverse-media screening**: risk-framed retrieval, LLM classification, an adversarial refutation pass, findings grouped by event with every source URL in an annex.
- **Officer-name checks** via the BOE, and name matching against Congreso deputies, flagged as unverified coincidence.

The site does not say any of this. Worse, it says something untrue.

## The problem in two halves

### 1. A claim we do not meet

Three files claim PEP screening. The report explicitly declines to do it, and says so in its own scope note: *"officers and natural persons are not screened anywhere else in this section… screening named individuals against media raises privacy concerns this report does not incur."*

| file | current text |
| --- | --- |
| `src/components/landingCopy.jsx:85` (EN), `:280` (ES) | "Sanctions & PEP screening" |
| `src/components/SpanishCompanyNetworkGraph.jsx:403` (EN), `:713` (ES) | "…sanctions & PEP screening…" |
| `src/components/DueDiligencePage.jsx:76` (EN), `:174` (ES) | "Automated cross-check against international sanctions lists and **PEP databases**" |

The third is the worst: it asserts we query PEP databases. We query none.

This matters beyond tidiness. The buyer is a professional who will read §7's scope note, and a paid report that contradicts its own sales page damages the thing the report is selling — that its claims are checkable.

### 2. Four more places that undersell

These are accurate but predate the external layer, describing BOE checks alone:

- `src/components/PricingPage.jsx:42` (EN), `:87` (ES)
- `src/components/SpanishSeoPage.jsx:49, 55, 67, 166` (ES only)
- `src/components/SpanishCompanyDueDiligencePage.jsx:39, 48, 62, 66` (EN)
- `src/components/DDCheckoutDialog.jsx:86` (EN), `:185` (ES)

`DDCheckoutDialog` is the point of purchase. Its one-line summary is the last thing a buyer reads before paying.

## What changes

### A. The screening claims — `landingCopy.jsx`, both languages

One inaccurate bullet becomes three accurate ones:

> - AI analysis & risk score
> - **Sanctions screening against the OFAC SDN and EU consolidated lists, each dated in the report**
> - **Adverse media screening — findings grouped by event, every one traced to its source**
> - **Officer names checked against the BOE and against Congreso deputies, flagged for verification**
> - Full officer history and traceability of registry changes
> - Capital events & red flags
> - Optional financial statements (Cuentas Anuales)
> - Free BORME monitoring included

Description gains the external checks: *"registry history, official sanctions-list screening and adverse-media checks, with every finding traced to the source it came from."*

### B. The false claims — `DueDiligencePage.jsx`, `SpanishCompanyNetworkGraph.jsx`

"PEP databases" and "sanctions & PEP screening" are replaced with the BOE/Congreso wording. Both languages.

### C. The FAQ — `landingCopy.jsx`

Currently: *"They also feature BOE sanctions checks, risk analysis…"* — now the smallest part of §7.

Rewritten to name the three checks and, deliberately, to state that **items which could not be verified are disclosed rather than dropped**. That disclosure is unusual in this market and is a reason to trust the negative results, not only the positive ones.

### D. The sample report link — `LandingPage.jsx:453`

Currently `variant="caption"` — caption-sized text. Becomes an outlined Button beside "Get a due diligence report". Same URL, same words, actually visible.

This is the highest-leverage single change on the page: the sample is the strongest trust asset and it is currently the least visible element near the buy CTA.

### E. The understated four

`DDCheckoutDialog` and `PricingPage` gain "adverse media" in their summary lines, both languages. These are the two on the purchase path.

`SpanishSeoPage` and `SpanishCompanyDueDiligencePage` are **out of scope for this pass** — they are SEO surfaces with their own keyword structure, and editing them well is a separate job from fixing a false claim. They stay accurate, just narrower than reality.

## Explicitly not doing

- No hero changes, no new page sections, no layout restructuring. The page teaches search → graph → reports, and the report is deliberately the end of that journey.
- No pricing changes.
- No new claims about accuracy, recall or speed. The measured figures (96% recall, 100% precision against a labelled set) are internal engineering evidence, not marketing copy — they were measured on two companies and would not survive being quoted as a general claim.
- No regeneration of the sample PDF. The current sample predates the external layer and does not show §7. **The user is handling this separately.** Until it is regenerated there is a gap between what the bullets promise and what the sample shows.

## Risk

The one real risk is D combined with the stale sample: promoting the sample link makes it *more* likely a buyer opens a PDF that lacks the sections we have just started advertising. Options are to ship the copy now and the button when the sample is refreshed, or to ship both and accept a short window. Flagged for the user to decide; default is to ship together and let the sample catch up, since the copy alone already creates the mismatch.

## Testing

Copy-only changes to presentational components. Verification is:

1. `npm run build` succeeds.
2. Grep confirms zero remaining "PEP" claims in user-facing copy (`congresoOfficerMatcher.js` and internal comments excepted).
3. Visual check of the landing reports section and the checkout dialog in both languages.
4. No string is left with only an EN or only an ES variant updated — `landingCopy.jsx` carries both and they must not drift.
