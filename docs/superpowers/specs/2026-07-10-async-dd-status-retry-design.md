# Async DD delivery: persistent status + admin retry

**Date:** 2026-07-10
**Status:** Approved (design)
**Repos touched:** `ncdata-bormes-impl` (Flask), `standalone_rag/local-rag/workers/stripe-handler` (worker), `mapasocietario` (admin frontend)

## Problem

Async DD generation (the 504 fix — see `2026-06-27-async-dd-generation-design.md`) has **no persistent job status**. A DD-only order's admin status is derived on the fly as `completed` iff `dd_reports/<sid>.pdf` exists in R2, else `pending`. That `pending` is lossy — it cannot distinguish:

1. genuinely generating (~3 min),
2. never triggered (webhook missed it — the **MONKIMUN LABS SL** incident, 2026-07-10),
3. triggered but the thread died / `store_failed` / `error`.

`borme_dd_async.py:generate_and_deliver` already computes the true outcome (`done | store_failed | error`) but only **logs** it. Nothing is persisted, so a stranded paid order looks identical to one still cooking, and no one is told when it breaks. A paying customer waited; the operator had to diagnose by hand via the runbook.

## Goal

A paid DD order can never silently strand. The operator (a) is **alerted the moment generation fails**, (b) can **see the true state** of every order in admin, and (c) can **re-fire generation with one click**.

## Non-goals (YAGNI)

- **Cron watchdog** sweeping `generating` > 15 min. Failure alerts + admin visibility cover every known failure mode; a watchdog only helps if a thread hangs forever *without throwing* (very rare). Deferred.
- **Retry limit / backoff.** The retry button is manual and admin-only; unbounded is fine.

## Architecture

### R2 status record (diagnostic, not authority)

New object per order: `dd_status/<sessionId>`

```json
{ "sessionId": "cs_live_…",
  "state": "generating" | "ready" | "failed",
  "reason": "store_failed" | "error" | "trigger_failed" | null,
  "attempts": 2,
  "startedAt": "ISO",  "updatedAt": "ISO",  "finishedAt": "ISO|null" }
```

**Authority rule:** the stored PDF (`dd_reports/<sid>.pdf`) remains the truth for *ready/completed*. `dd_status` is the diagnostic for anything that is not yet a finished PDF. So a lost status write can never hide a delivered report. A paid `dd_orders/<sid>` with **no** `dd_status` record = *never started*.

### One trigger path (DRY)

Generation is fired today from three sites (paid webhook ~L781, free path ~L1778+, self-heal `retrigger-dd-report`). Collapse into one internal helper:

```
retriggerDd(env, sessionId):
  read dd_session_used/<sessionId> sentinel  (403 if missing)
  outcome = triggerDdGeneration(env, {…from sentinel…})   // now RETURNS {accepted, status}
  prev = read dd_status/<sessionId> (for attempts, startedAt)
  if accepted (Flask 202):
    write dd_status = { state:'generating', attempts: prev.attempts+1,
                        startedAt: prev.startedAt ?? now, updatedAt: now }
  else:
    write dd_status = { state:'failed', reason:'trigger_failed',
                        attempts: prev.attempts+1, updatedAt: now, finishedAt: now }
    fireFailureAlert(env, …)
```

`triggerDdGeneration` changes from fire-and-log to **returning** `{ accepted: res.ok, status: res.status }` (throw → `{accepted:false, status:0}`). Call sites:
- **paid webhook** & **free path**: after writing the sentinel, call `retriggerDd(env, sessionId)` (sentinel already present).
- **`retrigger-dd-report`** (public self-heal, sessionId-gated): calls `retriggerDd`.

### Flask reports the terminal outcome

`borme_dd_async.py:generate_and_deliver` gains an injectable `_report_status` callback (default: POST to worker `report-dd-status`), called in a `finally` with the computed outcome. Best-effort — a report failure is logged and swallowed, never crashes generation.

- New env `REPORT_DD_STATUS_URL` (default `https://payments.ncdata.eu/api/stripe/report-dd-status`).
- Auth header `X-Generate-Secret: $GENERATE_SECRET` (already loaded).

### Worker `report-dd-status` (new route)

`POST /api/stripe/report-dd-status`  body `{ sessionId, outcome }`

- **Gate (defense in depth):** `dd_session_used/<sid>` sentinel must exist **AND** `X-Generate-Secret` matches `env.GENERATE_SECRET`. 403 otherwise.
- `outcome === 'done'`  → `dd_status = { state:'ready', finishedAt, updatedAt }`.
- `outcome in {store_failed, error}` → `dd_status = { state:'failed', reason:outcome, finishedAt, updatedAt }` **+ `fireFailureAlert`**.
- Preserves `attempts`/`startedAt` from the prior record.

### Failure alert (silent → loud)

`fireFailureAlert(env, { sessionId, companyName, email, reason, attempts })` POSTs the existing n8n/Telegram order webhook (`env.N8N_WEBHOOK_URL`) with `event:'dd_generation_failed'` + an admin order link. Non-blocking, best-effort. Fired on both `trigger_failed` (in `retriggerDd`) and terminal `failed` (in `report-dd-status`).

### Admin surface

**Worker `handleListFSOrders`** — for `dd_only` orders: PDF exists → `status:'completed'` (unchanged, authoritative). Else read `dd_status/<sid>` and attach `ddState`, `ddReason`, `ddAttempts`, `ddStartedAt`; **no record → `ddState:'never_started'`**. Include order age from `createdAt`.

**Worker `admin-retrigger-dd` (new route)** — `POST /api/stripe/admin-retrigger-dd`, `Authorization: Bearer $ADMIN_SECRET`. Body `{ sessionId }`. Calls `retriggerDd`, returns the new `dd_status`. 401 without ADMIN_SECRET.

**`AdminPage.jsx` `OrderCard`** (dd_only) — status chip + a **[Retry base DD]** button for anything not `ready`:

```
● Generating…  (2m)
⚠ Generating — taking long (14m)     [Retry base DD]   (age ≥ 10 min → amber)
✗ Failed: store_failed  · 1 attempt  [Retry base DD]
⚠ Never started                      [Retry base DD]
✓ Ready
```

Button → `POST ${PAYMENTS_API}/api/stripe/admin-retrigger-dd` with the admin key; disabled while in flight; refreshes orders on success. "Taking long" threshold = **10 min** (generation is ~3 min).

## Error handling

- Every new R2 write / webhook / status POST is best-effort and wrapped; failures are logged and never block generation, checkout, or the admin list.
- `report-dd-status` and `admin-retrigger-dd` validate `sessionId` against the existing `^cs_(test|live|free)_[A-Za-z0-9_]{10,}$` pattern and their auth gate before any work.

## Testing

- **Flask** `borme_dd_async_test.py`: `_report_status` invoked with `done` on success, `store_failed` when `_store` returns False, `error` on generate exception; a raising `_report_status` does not crash `generate_and_deliver`.
- **Worker** `test/dd-status.spec.js`:
  - `report-dd-status` — 403 without sentinel; 403 on bad secret; writes `ready` on `done`; writes `failed`+reason and calls the alert on `error`.
  - `admin-retrigger-dd` — 401 without `ADMIN_SECRET`; writes `generating`; increments `attempts`.
  - `handleListFSOrders` — dd_only with PDF → `completed`; with `dd_status:generating` → surfaces `ddState`; no record → `never_started`.
  - `triggerDdGeneration` returns `{accepted}`; `trigger_failed` path writes `failed` + alerts.
- **Frontend** `AdminPage` test: `OrderCard` renders the correct chip per `ddState`; retry button calls the endpoint and disables while pending.

## Deploy & secrets

Order (matches the known 404 gotcha — Flask route must exist before the worker calls it): **Flask** (deploy `borme_dd_async.py`, set `REPORT_DD_STATUS_URL`, restart `borme-search.service`) → **worker** (`wrangler deploy`) → **Pages** (frontend).

**No new secrets.** Reuses `GENERATE_SECRET` (already shared Flask↔worker) and `ADMIN_SECRET` (already set on the worker). `N8N_WEBHOOK_URL` is already configured for order notifications.
