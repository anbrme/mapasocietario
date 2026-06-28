# Company Currency Confirmation — Design

**Date:** 2026-06-28
**Status:** Design approved; Phase 1 is the build target
**Related:** [[project_company_context_layer]] (the broader "context layer" idea this sharpens), [[project_acquisition_strategy]] (distribution loop #4), [[user_analyst_not_salesman]] (accuracy over sales), [[project_dd_payment_paths]] (monetization touchpoint)

---

## 1. Thesis

A company's own website is distrusted *precisely because the company controls it* — it is the selling window. The commercial registry (BORME) is trusted *precisely because the company cannot touch it*. These live in two separate worlds today, and there is a point where they align:

> **A company's self-interest in proving trustworthiness is best served by a profile whose backbone is data it cannot manipulate.**

This inverts the usual logic of a company profile. Normally, editability is the value ("let me tell my story"). Here, **non-editability is the value** — the company *wants* to point a customer or supplier at this page *because* it carries the registry's independent authority, which the company's own website never can. We are not selling a brochure. We are selling **borrowed authority**: a "don't take my word for it" page.

This also dissolves the central risk of the older context-layer design (*becoming a press-release repository*): the company's incentive is no longer to embellish — embellishment destroys the very authority it came for — it is to *be verified*. **The willingness to be checked is the message.** Honest companies self-select in; spinners self-select out, because immutable scrutiny is the opposite of what they want.

## 2. What we add that the registry does not

The badge alone is not enough: if the page only echoes BORME, a customer can read BORME for free. The registry, by nature, is three things it can never stop being:

- **Backward-looking and lagged** — it only ever speaks *as of the last filing*; it can never say *still true today*.
- **Legally incomplete** — it records only what the law compels (sole shareholder, not the real cap table; no plain-language activity; no trading names).
- **Passive and anonymous** — no living party stands behind it; it is a log, not a counterparty.

So a verified company supplies exactly what the registry cannot contain: **currency, completion, and affirmation.** Of these, **currency is the strongest draw** and the focus of v1: a dated, authority-verified assertion that the registry record is *current* — the one thing BORME structurally cannot offer.

**The core, non-obvious property — anchored juxtaposition:** the value is neither the company's data (a distrusted brochure) nor the registry (free), but the two *side by side*. Company-supplied claims sit directly beside an immutable registry record **capable of contradicting them**. The registry becomes the lie-detector for the company's own additions. A customer trusts "we ceased being unipersonal in January" *because* it is printed next to a registry that would expose the company if it were lying. That composite exists nowhere else — not even on BORME.

## 3. Trust mechanics

### 3.1 Decaying currency (the engine)

A permanent "verified" badge is worthless: the company verifies once and coasts, and the viewer cannot distinguish a living company from a fossil. So the confirmation **has a visible age and decays:**

- Fresh: *"Confirmed current by María López, administrator (registry-verified), 3 days ago."* — green.
- Aging: *"Last confirmed 5 months ago."* — amber.
- Never: *"Registry last published 14 Feb 2026. Not independently confirmed since."* — grey, conspicuous.

What the decay buys:
- **For the company** — a *recurring reason to return* (retention), and visible out-signalling of competitors who let theirs go stale. Currency becomes a status race the honest win for free.
- **For the viewer** — the decay *is* the trust. A signal that can't go stale is gameable; one that visibly ages is self-policing. They are reading a clock, not trusting our say-so.

### 3.2 Confirm specific registry facts, not a vague "all good"

A confirmation is a set of checkboxes against named registry fields: *"Yes, María López is still our administrator." "Yes, this is our registered address." "No, we have not entered insolvency."* Specificity (a) matches what viewers actually care about and (b) raises the cost of lying, because each assertion stays anchored — if they confirm "X is still administrator" and BORME later shows a cessation, **the contradiction surfaces on its own.**

### 3.3 Getting ahead of the lag — honestly

The strongest trust play is letting the company pre-empt registry lag *in its own favour while being honest*: *"We confirm a change of administrator was filed 10 Jun, pending BORME publication."* The company looks proactive, the viewer gets information ahead of the official channel, and the platform delivers something BORME structurally cannot — early, attributed, and falsifiable later. (Phase 2+ — not v1.)

### 3.4 Anti-gaming invariant (all phases — inviolable)

- Company confirmations **never overwrite** registry-derived fields. On conflict, **show both**, each dated and sourced.
- The badge says **"the company asserts,"** never **"the platform vouches for the claim."** We verify the *representative's authority*, not the *truth of every assertion*.
- A false "still current" self-exposes at the next BORME publication. The cost of lying is structural, not editorial.

## 4. Two-sided exchange & abuse control

The mature platform is a **trust exchange**: supply = dated registry-anchored confirmations; demand = viewer-pulled confirmation requests. The mechanic that makes both sides reach for the same button: a viewer (a supplier about to extend credit, a buyer about to sign) clicks **"Ask the company to confirm this is current."** The company is notified — *"A potential counterparty is evaluating you right now"* — the strongest possible, deal-proximate incentive. We get the purest demand signal: who is being checked = who matters.

**Reachability** is folded into what claiming a page *means*: onboarding includes a standing declaration — *"We are reachable here and commit to respond to confirmation requests."* That willingness-to-be-asked is itself a costly honest signal. The request button only ever appears on pages of companies that have opted in and provided a channel; unreachable companies simply never have the button (at most an "invite them" link).

**Abuse is controlled by the same decay clock that makes the badge honest:**
- **You cannot request what is already fresh.** Inside the freshness window (e.g. < 90 days) there is no request button — only *"Confirmed current 3 days ago ✓."* A paranoid re-request has nothing to request.
- **Requests aggregate, they do not ping.** When a page *is* stale, multiple requests collapse into one batched signal the company sees as *"4 counterparties checked you this week"* — more incentive, not harassment. No individual can spam.
- Unanswered requests are **private to the company**, never displayed publicly as a shaming signal (prevents adversarial/competitor weaponization).

## 5. Phasing

The two-sided loop has a cold-start problem (no point requesting confirmations from companies that have not joined). So we sequence supply before demand and prove the riskiest assumption cheaply.

### Phase 1 — Testbed (Nurnberg Consulting SL; audience of one: the user) — THE v1 BUILD
Self-verify the user's own company, apply the badge, render it, and judge the result. No reachability problem, no abuse surface — it is just us. **Goal:** does the page *feel* more trustworthy with this on it, and is the UX/copy right?

### Phase 2 — Supply test (invite ~10–20 pilot companies)
Adds the claim/onboarding flow, **manual authority review** (cross-check the named representative against the company's *currently-active* BORME officer list + a supporting document; a human approves), and the **standing willingness-to-be-asked declaration**. **Goal:** will real companies actually claim and confirm? (Validates perceived demand.)

### Phase 3 — Close the loop (viewer "request a confirmation")
Only on opted-in companies, gated by the freshness window, requests aggregated and private. **Goal:** does viewer demand pull supply? Monetization (§7) attaches here.

## 6. Phase 1 — concrete build

Scope: render a decaying currency-confirmation panel on `/empresa/nurnberg-consulting-...` (and the `/en/company/...` mirror), sourced from a hand-authored confirmation record, plus a "confirmed-current" marker wherever the company surfaces. No backend, no auth, no admin UI, no request button.

### 6.1 Data store — a curated confirmations map
Mirror the existing `functions/empresa/_curated.js` pattern: a new **`functions/empresa/_confirmations.js`** exporting a slug-keyed map, hand-authored, `_`-prefixed so Pages does not route it. One record per company:

```js
export const CONFIRMATIONS = {
  'nurnberg-consulting-sl': {
    confirmedAt: '2026-06-28',            // ISO date the representative confirmed
    representative: 'Alessandro Nürnberg', // named, registry-listed officer
    role: 'Administrador único',
    verification: 'registry-officer-match', // how authority was established
    // Specific registry facts the representative affirmed as current:
    affirms: [
      { fact: 'administrator', label: '…', status: 'current' },
      { fact: 'address',       label: '…', status: 'current' },
      { fact: 'insolvency',    label: '…', status: 'none' },
    ],
  },
};
```

### 6.2 Render path
`renderCompanyPage()` in `functions/empresa/_lib.js` is the single render entry (shared by ES + EN). Inject a `confirmationBlock` near the top of the profile — after the badges/lead, **above** `Datos registrales`, so the borrowed authority frames the registry rather than hiding below it. The block:
- Reads the confirmation for `canonicalSlug` from `CONFIRMATIONS`.
- Computes **age in days** from `confirmedAt` to render date and maps to fresh/aging/stale styling + copy (new entries in the `T` i18n table, ES + EN).
- Renders representative + role + the affirmed-facts list, each visually tied to its registry field.
- States provenance explicitly: *"Statement by a representative whose authority was verified against the public registry. Mapa Societario verifies the representative's authority, not the truth of each statement."*
- When no confirmation exists for a slug (the default for every other company), renders **nothing** new — pages are unchanged.

> **Freshness is computed at render time, not stored.** The page already sets `s-maxage=86400`, so the displayed age is at worst ~1 day stale — acceptable. (If we ever need to-the-day precision, recompute client-side; not needed for v1.)

### 6.3 Search/surfacing marker (incentive, kept honest)
A **"Verificada · actual"** marker shown wherever the company appears (the `/empresa` page itself in v1; result lists later). It is a **signal marker and at most a tiebreaker — never bought rank.** A confirmed-current company is *shown to be* confirmed-current; nothing more. (Sort/filter "confirmed-current first" is Phase 2+, once more than one company qualifies.)

### 6.4 Freshness/revocation story (required even at pilot volume)
A "verified" badge that silently rots when the confirming officer ceases is a badge that lies. At Phase 1–2 volume this is handled **manually, not by code**: a periodic re-check (and, if the representative is no longer an active officer in BORME, the confirmation is pulled). Phase 3+ automates the re-check on registry change. The design must never present a stale confirmation as fresh — the decay rendering (§3.1) is what makes an un-refreshed confirmation visibly age rather than masquerade.

## 7. Monetization — principle + open debate (Phase 3; does not touch Phase 1)

**Inviolable principle:** the verified company **never pays for the badge, for verified status, or for rank.** The moment trust can be bought, it is advertising and the model collapses.

**Decided boundary (so the principle doesn't strangle revenue):** a company may pay for **utility, never status** — monitoring/alerts, "who checked you this week," analytics, its own DD reports. Paying for a *tool* ≠ paying for *trust*.

**Open debate — how the *requester* side pays (devil's-advocate outcome):**
- The user's first instinct ("requester pays for a verification request, gets free DDs") is recorded but flagged as the **weaker instrument**, because (a) it cannibalizes DD, our actual paid product; (b) it charges for an *uncertain* outcome (the company may not respond); (c) the requester *is* essentially a DD customer.
- **Recommended instead:** make the confirmation-request a **feature of the DD product** — "your DD report, with a live, as-of-today confirmation" — riding on a payment we already take, no cannibalization, principle intact.

**Open ruling needed — third-party co-sign back door:** when a bank/insurer co-signs the check (the eventual killer incentive), *someone* pays the third party's cost. If that is the company, is it "company pays to be verified" through the back door? Proposed ruling: **permitted** — paying an independent third party for *deeper scrutiny* is the opposite of buying a pass — but this must be ruled explicitly, not by accident.

## 8. Out of scope (v1 / Phase 1)
- Any claim/onboarding/self-service flow (Phase 2).
- Authority-verification automation, certificado digital / Cl@ve (Phase 2 is manual; automation only after the pilot proves demand).
- The viewer "request a confirmation" button and notifications (Phase 3).
- Completion and affirmation layers (real ownership beyond *socio único*, trading names, contact) — currency only in v1.
- Any monetization mechanism (Phase 3).
- Named natural-person data beyond the registry-listed representative themselves (GDPR — see [[project_company_context_layer]]).

## 9. Open questions
1. Freshness window length for "fresh" vs "aging" vs "stale" (proposed 90 days fresh; revisit with pilot feedback).
2. Exact set of registry facts a confirmation should affirm (administrator, address, insolvency, sole-shareholder status — which are the decision-grade ones?).
3. Phase 2 authority check: registry-officer-match + supporting doc is the manual baseline — what document(s) count, and who reviews?
4. Visual treatment of the panel so it reads as *trust*, not *advertisement* — verify on the real Nürnberg Consulting page in Phase 1.
5. Whether the search marker needs a dedicated source-of-truth beyond `_confirmations.js` once result-list surfacing arrives (Phase 2).

## 10. Success criteria
- **Phase 1:** the rendered Nürnberg Consulting page demonstrably reads as more trustworthy/decision-useful to the user, with provenance unambiguous and the freshness clock legible. No regression on any other company page.
- **Phase 2:** ≥ a handful of invited companies claim and confirm of their own volition (perceived-demand signal positive).
- **Phase 3:** viewer requests occur and pull at least some confirmations — the loop turns.
