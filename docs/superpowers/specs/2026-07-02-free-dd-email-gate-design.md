# Free DD — per-email redemption gate + admin visibility

**Date:** 2026-07-02
**Status:** Design approved, ready for implementation plan
**Repos touched:** `local-rag` (stripe-handler worker), `mapasocietario` (checkout dialog + admin page)
**Builds on:** [`2026-06-27-free-dd-insight-design.md`](./2026-06-27-free-dd-insight-design.md)

## Problem

The free-first-DD program lets a first-time user redeem one free Due Diligence
report. It is supposed to be **once per user**. It is not.

In `local-rag` `workers/stripe-handler/src/index.js`
`handleCreateDDCheckoutSession`, the free path is gated **only** by
`freeFirstReport === true` in the request body plus a single **global** counter
(`free_first_report_counter`, default 50, `FREE_FIRST_REPORT_LIMIT`). There is
**no per-email check of any kind** — exact or normalized. Any email, or the same
email repeated, is fulfilled for free until the global cap is hit. The frontend
(`DDCheckoutDialog.jsx`) likewise shows the free toggle whenever the program
switch is on, with no "already used" check.

Separately, there is **no visibility**: free redemptions land as `dd_orders/<id>`
markers (carrying `customerEmail`, `freeFirstReport`/`waived`, and the `intake`
block with role/need/`followUpOptIn`), but nothing surfaces them. The AdminPage
has only "Orders" and "CNMV Review" tabs — no view of who got a free DD, who
opted into the follow-up email, or who tried to redeem more than once.

## Goals

1. A **first free DD is genuinely one per email identity.** A repeat email cannot
   redeem the free report — enforced server-side (authoritative), and reflected
   in the UI so a repeat user does not even see the offer.
2. **Owner visibility + control**: an admin "Free DD" tab listing who redeemed,
   who opted into the follow-up email, and who was blocked as a repeat — with
   manual **block**, **reset** (grant one more), and **waiver** (grant ongoing
   free access) actions for cases the automatic matching can't handle.

## Non-goals

- Stopping a determined abuser who uses entirely fresh, distinct mailboxes.
  Email alone cannot do this; IP/device fingerprinting is out of scope. The
  automatic gate catches the lazy cases (literal repeats, `+`-tags, Gmail dots);
  the abuse tab + manual block are the human-in-the-loop backstop for the rest.
- Changing the paid DD flow, the global cap, or the admin-waiver (`WAIVED_EMAILS`)
  behaviour. Waived/admin emails stay uncapped and bypass the per-email gate.

## Design

### 1. Email identity normalization (worker helper)

A single pure function `freeReportEmailIdentity(email)` returns a canonical
identity string used for the gate, the ledger, the blocklist and the eligibility
check. All comparisons and R2 keys derive from this canonical string.

Rules:
- Lowercase and trim.
- Split into `local@domain`. If it doesn't contain exactly one `@`, treat the
  whole trimmed/lowercased string as the identity (defensive; do not throw).
- **Strip plus-tags for all domains:** drop everything from the first `+` in the
  local part. Plus-addressing is supported by most providers (Gmail, Proton,
  Fastmail, Outlook/M365, iCloud, Yahoo). For a provider that does *not* support
  it, `foo+bar@domain` simply isn't a deliverable mailbox — and the free report
  is emailed — so collapsing it costs nothing real.
- **Fold dots only for Gmail:** if the domain is `gmail.com` or `googlemail.com`,
  remove all dots in the local part and normalize the domain to `gmail.com`.
  (Only Gmail ignores dots; do not fold dots for other domains.)
- Return `local@domain`.

Examples:
- `U.S.er+promo@Gmail.com` → `user@gmail.com`
- `user+anything@googlemail.com` → `user@gmail.com`
- `First.Last+x@proton.me` → `first.last@proton.me` (dots kept, tag stripped)
- `plain@example.com` → `plain@example.com`

R2 keys derived from the canonical use `encodeURIComponent(canonical)` so keys
are readable in the admin listing and safe as R2 object names.

### 2. Backend gate + ledger — `handleCreateDDCheckoutSession`

First, broaden the "is this a free order" test to include the **dynamic waiver
allowlist**: `isDynamicWaiver = !!email && exists(free_first_report_waiver/<enc(canonical)>)`,
and `isWaived = isWaivedEmail || isDynamicWaiver`. A dynamic-waiver email behaves
**exactly** like a hardcoded `WAIVED_EMAILS` entry — uncapped, always free,
bypasses the per-email gate — the only difference is it lives in R2 and is
managed from the admin tab instead of in code. The block below then runs for
`isWaived || isFreeFirstReport`.

Inside that block, in the `isFreeFirstReport && !isWaived` sub-path (i.e. a
genuine public free-first request, not a waiver), **before** the global-counter
increment and fulfillment:

1. **Require email.** If `email` is missing/blank, reject the free path with
   `400 { error: 'free_report_email_required' }`. (The report is emailed and the
   entitlement is email-bound, so a free order without an email is meaningless.)
2. Compute `canonical = freeReportEmailIdentity(email)`.
   - `ledgerKey = free_first_report_email/<enc(canonical)>`
   - `blockKey  = free_first_report_block/<enc(canonical)>`
3. **If `blockKey` exists** (manually blocked) → treat as a blocked attempt:
   write an abuse record (see below) and return
   `403 { error: 'free_report_blocked' }`.
4. **If `ledgerKey` exists** (already redeemed) → write an abuse record and
   return `403 { error: 'free_report_already_used' }`.
5. **Otherwise** → write the ledger record **immediately** (optimistically,
   before fulfillment, to shrink the race window), then continue into the
   existing global-counter increment + fulfillment path unchanged.

**Ledger record** `free_first_report_email/<enc(canonical)>`:
```json
{
  "canonicalEmail": "user@gmail.com",
  "originalEmail":  "U.S.er+promo@gmail.com",
  "firstRedeemedAt": "2026-07-02T…Z",
  "sessionId": "cs_free_…",
  "country": "es",
  "companyIdentifier": "…",
  "companyName": "…",
  "followUpOptIn": true,
  "intakeRole": "…",
  "intakeNeed": "…"
}
```

**Abuse record** `free_first_report_abuse/<enc(canonical)>_<ts>` (one per blocked
attempt, so repeat attempts accumulate):
```json
{
  "canonicalEmail": "user@gmail.com",
  "originalEmail":  "u.s.er@gmail.com",
  "attemptedAt": "2026-07-02T…Z",
  "reason": "already_used",        // or "blocked"
  "country": "es",
  "companyIdentifier": "…",
  "companyName": "…"
}
```

**Concurrency:** R2 has no atomic compare-and-set, so two truly simultaneous
first-time requests for the same identity could both pass the check. Writing the
ledger optimistically right after the check minimizes the window. This is
abuse-deterrence, not a financial invariant; the residual race is an accepted
limitation.

Waived emails — both hardcoded `WAIVED_EMAILS` and dynamic-waiver-allowlist
entries — bypass steps 1–5 entirely, exactly as today, and are never written to
the ledger, blocklist, or abuse log. Precedence: waiver beats blocklist (an
explicit grant overrides a prior block), so check the waiver allowlist before
the blocklist.

### 3. Eligibility endpoint (new, public)

`POST {baseApiRoute}/check-free-report-eligibility`, body `{ email }`, returns
`{ eligible: boolean, reason: string }`. No admin auth (it's a pre-checkout UX
aid). Logic:
- No/blank email → `{ eligible: true, reason: 'unknown' }` (can't tell yet).
- Waived email (hardcoded `WAIVED_EMAILS` **or** dynamic waiver allowlist) →
  `{ eligible: true, reason: 'waived' }` (checked first; overrides block/ledger).
- `blockKey` exists → `{ eligible: false, reason: 'blocked' }`.
- `ledgerKey` exists → `{ eligible: false, reason: 'already_used' }`.
- Global cap reached → `{ eligible: false, reason: 'limit_reached' }`.
- Else → `{ eligible: true, reason: 'ok' }`.

This endpoint reveals whether a given email has used a free report. That is a
minor enumeration surface (only exposes free-report usage, only to someone who
supplies the address); accepted as low-risk.

### 4. Frontend — `DDCheckoutDialog.jsx`

- When the free program switch is on and the email input changes, **debounced**
  (~400–500 ms), call `check-free-report-eligibility`.
- If `eligible === false`: force `useFreeReport = false`, **hide/disable** the
  free toggle + intake, and show a short note keyed by `reason`
  (already used / blocked → "This email has already used its free report";
  limit_reached → program-closed message). Keep copy bilingual (EN/ES) to match
  the existing dialog strings.
- If `eligible === true`: show the toggle as today.
- **Defensive submit handling:** if the create-dd-checkout call returns
  `free_report_already_used` / `free_report_blocked` / `free_report_email_required`,
  catch it, un-check the free toggle, show the message, and let the user continue
  as a **normal paid order** (do not hard-fail the dialog).

### 5. Admin "Free DD" tab

**New admin endpoint** `GET {baseApiRoute}/list-free-reports` (Bearer
`ADMIN_SECRET`, same pattern as `list-fs-orders`) returns:
```json
{
  "redemptions": [ { canonicalEmail, originalEmail, redeemedAt, company, country,
                     sessionId, followUpOptIn, intakeRole, intakeNeed, source } ],
  "abuseAttempts": [ { canonicalEmail, originalEmail, attemptedAt, reason,
                       company, count } ],
  "blocked": [ { canonicalEmail, blockedAt } ],
  "waivers": [ { canonicalEmail, grantedAt } ],
  "summary": { redeemedCount, limit, followUpOptInCount, abuseAttemptCount, blockedCount, waiverCount }
}
```
- **Redemptions** come from the `free_first_report_email/` ledger, **plus** a
  backfill scan of existing `dd_orders/` markers where `freeFirstReport === true`
  (so free reports redeemed *before* this change still appear). Merge and dedupe
  by canonical email; `source` distinguishes `ledger` vs `dd_orders_backfill`.
- **Abuse attempts** come from `free_first_report_abuse/`; group by canonical
  email with a `count`, keep the most recent `attemptedAt`.
- **Blocked** comes from `free_first_report_block/`.
- **Waivers** comes from `free_first_report_waiver/`.

**New admin actions** (small POST endpoints, `ADMIN_SECRET`, all take `{ email }`
and key off `freeReportEmailIdentity(email)`):
- `block-free-report` → write `free_first_report_block/<enc(canonical)>`
  `{ canonicalEmail, blockedAt }`.
- `unblock-free-report` → delete that block key.
- `reset-free-report` → **grant one more**: delete the
  `free_first_report_email/<enc(canonical)>` ledger entry (and that identity's
  `free_first_report_abuse/` records), so the user is eligible for exactly one
  more free report. Does **not** touch the block or waiver keys.
- `grant-free-report-waiver` → **grant ongoing**: write
  `free_first_report_waiver/<enc(canonical)>` `{ canonicalEmail, grantedAt }`.
  From then on that identity gets free reports uncapped, exactly like a
  `WAIVED_EMAILS` entry, with no redeploy.
- `revoke-free-report-waiver` → delete that waiver key.

**New component** `FreeReportsTab.jsx` (mirrors `CnmvReviewTab.jsx`; receives
`adminKey`), added as a third AdminPage tab labelled **"Free DD"**. It shows:
- A **summary line**: `N redeemed / limit · M opted into follow-up · K blocked attempts`.
- A **redemptions table**: email (raw + canonical), company, date, role, need,
  and a highlighted **follow-up opt-in** flag; per-row **Block**, **Reset
  (grant one more)**, and **Grant waiver** buttons.
- An **abuse-attempts table**: raw + canonical email, most-recent attempt date,
  attempt **count**, reason; per-row **Block** and **Grant waiver** buttons.
- A **Blocked** list with **Unblock** per row, and a **Waivers** list with
  **Revoke** per row.
- A small free-text email input supporting the same manual actions (block /
  grant waiver) for an address not otherwise listed.

### Data model (R2 keys)

| Key | Purpose | New? |
|-----|---------|------|
| `free_first_report_email/<enc(canonical)>` | Redemption ledger (one per identity) | new |
| `free_first_report_abuse/<enc(canonical)>_<ts>` | One record per blocked attempt | new |
| `free_first_report_block/<enc(canonical)>` | Manually blocked identities | new |
| `free_first_report_waiver/<enc(canonical)>` | Dynamic waiver allowlist (uncapped free, like `WAIVED_EMAILS`) | new |
| `free_first_report_counter` | Global cap | unchanged |
| `dd_orders/<id>` | Order markers; source for admin backfill | unchanged |

## Testing

Worker (following existing stripe-handler test patterns):
- `freeReportEmailIdentity`: Gmail dot+plus folding, `googlemail`→`gmail`,
  plus-strip on non-Gmail with dots preserved, plain address, malformed/no-`@`
  input, casing/whitespace.
- Gate behaviour: first free request passes and writes the ledger; second
  request for the same identity (incl. dot/plus variants) is blocked and writes
  an abuse record; blocked identity is refused; missing email rejected; hardcoded
  and dynamic-waiver emails bypass the gate + global cap and are not written to
  the ledger; a `reset` makes a previously-redeemed identity eligible again; a
  waiver overrides an existing block.
- Eligibility endpoint: each `reason` branch (incl. `waived` from the dynamic
  allowlist overriding `blocked`/`already_used`).

Frontend: light coverage that the toggle hides on `eligible:false` and that a
`free_report_already_used` submit response falls back to the paid path.

## Rollout / ops notes

- No migration required. The gate is additive; historical free redemptions
  appear in the admin tab via the `dd_orders` backfill (they simply won't be in
  the ledger, so the *first* post-deploy repeat by such a user would slip through
  once — acceptable, and visible in the abuse tab thereafter). Optionally, a
  one-off backfill script could seed the ledger from existing `dd_orders`
  free markers; not required for v1.
- Deploy order: worker first (gate + endpoints), then frontend (dialog +
  admin tab), since the frontend depends on the new endpoints.
