# Free DD for Insight — Design

**Date:** 2026-06-27
**Status:** Draft for review

## Purpose

Give a first-time user one free due diligence report (without financial
statements) in order to **learn who the buyer is and what job they are hiring
the report for**. This is a learning instrument, not a revenue or marketing
program. Success is measured in understanding, not conversions.

### Primary goal
Capture, in the buyer's own words and at the moment of intent, **who they are**
(role/context) and **what triggered the need** (the deal, the counterparty
check, the lead, the compliance task).

### Secondary goal
Learn whether the report actually served that job — captured later, softly, and
only with consent.

### What success looks like
After ~15–25 free reports, the intake notes cluster into 2–3 recognisable
buyer + job patterns. That clustering — not a click-through rate — is the
output. It feeds positioning, the Spanish/English SEO landing pages, and
pricing.

## Non-goals (YAGNI)

- No testimonials or social proof harvesting. Any praise that surfaces is
  treated as *incentivised* and only used if volunteered and clearly disclosed.
- No live calls, no email sequences, no nurturing funnel.
- No analytics dashboard. The volume is small enough to read the notes directly.
- No new payment plumbing — reuse the existing Stripe coupon + promo-banner path.
- No change to the paid product. Financial statements stay behind the paywall;
  that is what keeps the free report's marginal cost near zero and preserves the
  upsell.

## Mechanism (Approach B: intake-gated, self-serve)

A tiny intake gate sits in front of an existing 100%-off Stripe coupon. The
flow:

1. **Offer surfaced** at intent points — the DD page, pricing, and the checkout
   dialog — as "Your first report is on us." Honest framing: free, in exchange
   for an honest take, no strings.
2. **Intake gate** (the only genuinely new UI). Two short fields plus one
   optional consent checkbox:
   - **What did you need this report for?** — one line, free text. *(the job /
     trigger — the single most valuable field)*
   - **Which best describes you?** — single select: Lawyer / legal · Accountant
     / advisor · Compliance / KYC · Investor / M&A · Journalist · Business owner
     · Other. *(the buyer)*
   - **☐ Happy for us to email you one short question later?** — optional. Drives
     the secondary goal; unchecked by default.
   - Email (already required to deliver the report).
3. **Code applied** on submit — the existing promo-banner mechanism reveals /
   applies the 100%-off coupon. The user completes checkout (€0) and receives
   the report exactly as a paying customer would.
4. **Soft follow-up** — only if the box was ticked, a *single* email at T+1 day:
   one open question ("Did it answer what you needed? Anything missing or
   wrong?"). Reply-in-a-line. No call, no second email, ever.

### Keep the gate tiny
Two fields + one checkbox is the ceiling. A longer form tanks completion and
biases the sample toward only the most motivated, which is the opposite of what
we want for ICP discovery. Both fields should be answerable in seconds.

## Where the insight lands

The intake answers must be readable next to the order. Reuse the existing order
flow rather than building a store:

- Frontend collects the three intake values and passes them to the
  create-checkout-session call.
- The payments worker (separate repo — `local-rag` / payments.ncdata.eu) writes
  them into the **Stripe Checkout Session metadata** alongside the coupon.
- They are then readable in the Stripe dashboard and can be surfaced in
  `AdminPage.jsx` where orders are already listed.

This keeps the frontend change small and avoids a parallel data store. The
cross-repo touchpoint (payments worker accepting + persisting the three fields)
is the one backend change required.

## Honesty & abuse guardrails

- Framing is "on us, we'd value your honest take" — never a disguised sales
  step.
- Abuse (a user burning a fresh email for a second free report) is tolerated:
  marginal cost is negligible and we still gain a data point. Revisit only if
  volume rises materially.
- Follow-up is opt-in, single, purpose-stated → GDPR-clean. Intake data is
  minimal and collected for a stated purpose.
- Expect feedback to skew positive (it was free); weight the *intake* (who/why,
  given before they received anything) above the *follow-up* (did-it-serve,
  given after a gift).

## Scope summary

| Piece | Change | Repo |
|-------|--------|------|
| Intake gate UI (2 fields + checkbox) | New | this repo (`DDCheckoutDialog.jsx`) |
| Surface the free-report offer | Reuse promo-banner pattern | this repo |
| 100%-off coupon | Create in Stripe | Stripe dashboard |
| Persist intake → session metadata | New (small) | payments worker (`local-rag`) |
| Read intake next to orders | Extend | this repo (`AdminPage.jsx`) |
| Single opt-in follow-up email | New (manual to start) | manual / payments worker |

## Resolved decisions

- **Follow-up timing** — a single email at **T+1 day** after the report is
  delivered. One open question, opt-in only, never repeated.
