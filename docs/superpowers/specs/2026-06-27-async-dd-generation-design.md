# Async DD report generation + email notify — Design

**Date:** 2026-06-27
**Status:** Draft for review

## Problem

`/bormes/dd-report/company` generates the whole PDF synchronously and the
**browser** holds the request open while it runs (`OrderStatusPage` → sync
`generateReport`). Large companies (FTI: 48+31 officers, big AI prompt) outlast
the gateway timeout → **504**. Affects paid and free DD alike (the AI/enrichment
steps aren't gated on financial statements).

## Goal

Generate server-side in the background, store the PDF to R2, and **email the
buyer when it's ready**. No held-open request → no 504 at any company size. The
buyer isn't trapped on a spinner; the report arrives by email and is on the
order page.

## Constraints

- **No Redis** on the API box → no RQ/Celery. Use a `threading.Thread` runner,
  with a self-heal re-trigger as the safety net. (Upgrade path: a cron-daemon
  picking up R2 "pending" markers, if reliability ever needs it.)
- Reuse what already exists: R2 storage (`dd_reports/${sessionId}.pdf`),
  `verify-dd-payment` returning `reportReady`, the FS-order polling in
  `OrderStatusPage`, Flask-side R2 (`alerts_api.py`) and email (`mailer.py`).

## Flow / contract

1. **Worker triggers at order confirmation** (so generation starts at purchase,
   independent of the page being open):
   - Free orders → in the waiver path of `handleCreateDDCheckoutSession`.
   - Paid orders → in `handleWebhook` (the `dd_report` branch).
   - Fire `POST {BORME_API_URL}/bormes/dd-report/generate-async` with
     `{ sessionId, company_name, country, options, email, orderOrigin }` and a
     shared-secret header `X-Generate-Secret`. The worker awaits only the fast
     `202` (generation is NOT awaited).

2. **Flask `/bormes/dd-report/generate-async`:**
   - Reject if `X-Generate-Secret` doesn't match (protects an expensive,
     billable operation from abuse).
   - Idempotency: if `dd_reports/${sessionId}.pdf` already exists → `200`
     (done). If a generation is already in-flight for this sessionId (in-memory
     set) → `202`. Otherwise start a daemon thread and return `202`.

3. **Background thread (Flask):**
   - `generate_company_report(company_name, es, options)` → pdf_bytes.
   - Store to `dd_reports/${sessionId}.pdf` (see R2 decision below).
   - Send the **"Your report is ready"** email (link `${orderOrigin}/order/${sessionId}`).
   - On failure: log + alert the owner (reuse the n8n/Telegram free-order webhook
     or an admin email); write **no** PDF, so a re-trigger regenerates cleanly.

4. **Frontend (`OrderStatusPage`):**
   - DD-only branch: replace sync `generateReport(data)` with `status =
     'processing'` and let the existing poll (lines 337–376) flip to `ready` on
     `reportReady`. Copy → "We're preparing your report — it'll appear here and
     we'll email you."
   - Self-heal: if still not ready after ~3 min of polling, call worker
     `POST /api/stripe/retrigger-dd-report { sessionId }`, which verifies the
     session is a real order (its R2 marker exists) and re-fires generate-async.
     Keeps the shared secret server-side.

## R2 store decision (resolve at build)

Flask must write to the **payments** R2 bucket (where `dd_reports/` live). Two
options:
- **(a)** Flask `boto3` with an R2 S3 token scoped to `payments-tracking` (new
  credential), or
- **(b)** Flask POSTs the PDF to the worker's existing store-dd-report endpoint
  (no new credential).

Prefer **(b)** unless Flask already holds a token for that bucket.

## Email

Reuse Flask `mailer.py`. New "report ready" template with the order link. The
order-confirmation email (worker) changes to *"we're preparing your report —
you'll get it by email shortly, and it's on your order page."* so the buyer
isn't surprised by the wait.

## Config / env

- Worker: `BORME_API_URL` (api.ncdata.eu), `GENERATE_SECRET`.
- Flask: `GENERATE_SECRET`, R2 creds **or** the worker store URL, mailer (exists).

## Auth / abuse

- `generate-async` gated by the shared secret (worker ↔ Flask).
- `retrigger-dd-report` (client → worker) verifies a real order before re-firing.
- Idempotency guard prevents duplicate/concurrent generation per session.

## Out of scope

- Redis/RQ. FS orders (already async via admin upload + poll). The relationship
  and amended modes ride the same path (mode travels in `options`).

## Files touched

| Repo | Change |
|------|--------|
| `local-rag` worker | fire generate-async in free + paid confirmation; new `retrigger-dd-report` endpoint; reword confirmation email |
| `ncdata-bormes-impl` Flask | new `/bormes/dd-report/generate-async` route + background gen/store/email; reuse `generate_company_report` |
| `mapasocietario` | `OrderStatusPage` DD-only branch → poll; copy; self-heal re-trigger |

## Edge cases

- **Duplicate triggers** (worker + client re-trigger) → idempotency (R2 exists /
  in-flight set).
- **Generation failure** → no PDF → re-trigger regenerates; alert owner after
  repeated fails.
- **Worker/Flask restart mid-generation** → report lost → client self-heal
  re-trigger (or owner manual). Acceptable at current volume; the cron-daemon
  upgrade removes even this.
- **Buyer closes the tab** → fine; the email delivers the report.
