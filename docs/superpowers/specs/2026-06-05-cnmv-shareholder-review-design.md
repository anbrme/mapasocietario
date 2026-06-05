# CNMV Significant-Shareholder Review — Design

**Date:** 2026-06-05
**Status:** Approved (design); pending implementation plan
**Spans two repos:** `mapasocietario` (admin UI, public page) and `ncdata_infra`
(`bormes/borme_search_api.py`, `cnmv/schema.sql`, `cnmv/push_cnmv_to_pg.py`).

## Problem

The weekly CNMV pipeline (`scrape → push_cnmv_to_pg.py → cnmv_alert.py`) flags
new/changed/dropped significant-shareholder rows as `pending` and emails a digest.
There is **no built approval step** — promotion from `pending` to `approved` today
requires manual SQL, and there is no UI to review what changed.

Two consequences of the current write model make this worse:

1. **Changed holders vanish from the public page while pending.** `push_cnmv_to_pg.py`
   overwrites the approved `current` row in place with the *new* value and flips
   `status='pending'`. Since the public API serves only `status='approved'`, a holder
   whose % changed disappears entirely until approved — the cap table shows neither the
   old nor the new figure, and percentages stop summing correctly.
2. **No review surface, no audit trail** — required by the CNMV LIA
   (`ncdata_infra/cnmv/LIA_AND_RETENTION.md`).

## Goal

A password-gated review surface in the existing admin page where, on receiving the
weekly digest email, the operator can see each company's **existing → proposed** values
side by side and **Approve** or **Reject** changes (per-row or per-company). Approved
data becomes public; rejected data leaves the last-approved value in place but flags it
as possibly outdated.

## Decisions (resolved during brainstorming)

- **Actions:** Approve / Reject only. **No inline Modify** — public-register data is never
  hand-edited; a bad scrape is rejected and re-pulled next week. Strongest
  "faithful reproduction" stance.
- **Granularity:** per-row is the primitive; per-company "Approve all / Reject all" is a
  convenience that loops the per-row op over that company's pending changes. No global
  "approve everything".
- **Write model B (staging):** the weekly run does **not** overwrite the approved `current`
  row for changed/new/dropped holders. It records the proposed diff in a staging table.
  Approve applies the diff; reject leaves it unapplied and marks it `rejected` (the record is
  kept, not deleted, for the audit trail). The public page always shows last-approved data
  while review is pending — fixes consequence (1) above.
- **Reject caveat:** a rejected-and-not-yet-superseded holder keeps its last-approved value
  on the public page **plus** a caveat: *"Posible cambio no verificado — el valor mostrado
  podría no reflejar la última comunicación a la CNMV. Consulte cnmv.es"* (+ EN). Cleared
  automatically when a later change for that holder is approved.
- **Auth:** set `CNMV_ADMIN_TOKEN` (BORME box) = the existing payments admin key. The CNMV
  tab sends `X-Admin-Token: <adminKey>` to `api.ncdata.eu`; orders keep sending
  `Bearer <adminKey>` to `payments.ncdata.eu`. One password, two backends.
- **Caveat scope:** per-holder marker + a company-level summary flag.

## Architecture

### 1. Data model — `ncdata_infra/cnmv/schema.sql`

- **`cnmv_changes` becomes the staging area.** Add: `status TEXT NOT NULL DEFAULT 'pending'`
  (`pending | approved | rejected`), `reviewed_at TIMESTAMPTZ`, `reviewed_note TEXT`.
  It already carries `slug, ticker, holder, change_type, old_pct, new_pct, registry_date`.
  For full-breakdown application on approve, also stage the proposed
  `pct_directo/indirecto/instrumentos/acciones_total` (add columns, or join the matching
  `cnmv_observations` row by `run_id + slug + holder_norm`).
- **`cnmv_shareholders_current`**: add `verify_flag BOOLEAN NOT NULL DEFAULT FALSE`
  (the "check CNMV" caveat).
- **New `cnmv_review_log`** (append-only audit): `id, reviewed_at, action (approve|reject),
  scope (row|company), slug, holder_norm, old_pct, new_pct, note`. Satisfies the LIA
  accountability requirement.

### 2. Pipeline — `ncdata_infra/cnmv/push_cnmv_to_pg.py`

- Keep appending every observation to `cnmv_observations` (unchanged — full history).
- For **unchanged** holders: refresh the `current` row as today.
- For **new / changed / dropped** holders: **do not** mutate the approved `current` row.
  Instead record the proposed diff in `cnmv_changes` with `status='pending'` and enough
  fields to apply it later. (The baseline `--auto-approve` path still writes `current`
  directly, as today.)
- `cnmv_alert.py` digest is unchanged (reads un-alerted `cnmv_changes`).

### 3. API — `ncdata_infra/bormes/borme_search_api.py`

All write/review endpoints gated by `_cnmv_admin_ok()` (already added: `X-Admin-Token`
vs `CNMV_ADMIN_TOKEN`, constant-time, fail-closed).

- `GET /bormes/cnmv/pending` *(admin)* — pending changes grouped by company, each item
  carrying `existing` (current approved value) and `proposed` (staged value) for
  side-by-side display, plus `change_type`. Replaces today's raw `pending` dump.
- `POST /bormes/cnmv/review` *(admin)* — body
  `{ slug, holder_norm?, action: "approve"|"reject", scope: "row"|"company" }`.
  - **approve:** apply the staged diff to `cnmv_shareholders_current` (upsert new values,
    set `status='approved'`, `is_current` per change_type, clear `verify_flag`); mark the
    `cnmv_changes` row `approved`; write `cnmv_review_log`.
  - **reject:** mark the `cnmv_changes` row `rejected`; set `verify_flag=TRUE` on the
    affected `current` row (leave its value untouched); write `cnmv_review_log`.
  - `scope:"company"` loops the action over all that company's `pending` changes.
- `GET /bormes/cnmv/shareholders` *(public)* — add per-holder `verify_at_source` (from
  `verify_flag`) and company-level `has_unverified` + localized caveat text. Default
  `status='approved'` behaviour and the CNMV `notice`/`source` are unchanged.

### 4. Admin UI — `mapasocietario/src/components/AdminPage.jsx`

- Add a tab bar at the top: **Orders** (the existing Pending/Completed sections, extracted
  unchanged) and **CNMV Review**. Reuse `adminKey`, `localStorage`, the login screen, and
  the existing Paper/Collapse visual vocabulary.
- **CNMV Review tab:** fetch `GET /bormes/cnmv/pending` with `X-Admin-Token: adminKey`.
  Render companies (grouped, collapsible) with a table of `existing → proposed` rows.
  Per-row **Approve/Reject** buttons; per-company **Approve all / Reject all**. On action,
  `POST /bormes/cnmv/review`, optimistic update, refresh. Empty state: "No pending CNMV
  changes."
- Consider extracting `OrdersTab` and `CnmvReviewTab` as sibling components to keep
  `AdminPage.jsx` focused (it is already ~700 lines).

### 5. Public page — `mapasocietario/functions/empresa/_lib.js` (+ render component)

- When `/bormes/cnmv/shareholders` returns `verify_at_source` for a holder, render the
  per-holder caveat marker; when `has_unverified` is set, render a company-level note.

## Data flow

```
weekly: scrape → push_cnmv_to_pg.py
          ├─ unchanged → update current (approved)
          └─ new/changed/dropped → cnmv_changes (status=pending)   [current untouched]
        → cnmv_alert.py emails digest

review: operator opens admin → CNMV Review tab
        GET /bormes/cnmv/pending  (X-Admin-Token)
        POST /bormes/cnmv/review {action, scope}
          ├─ approve → apply diff to current (approved), clear verify_flag, log
          └─ reject  → mark rejected, set verify_flag on current, log

public: GET /bormes/cnmv/shareholders
          serves approved current rows
          + verify_at_source / has_unverified caveat where verify_flag set
```

## Error handling

- All review writes are transactional; a failed apply rolls back and returns a non-200 so
  the UI can surface it without optimistically marking the row done.
- `_cnmv_admin_ok()` fail-closed: missing/incorrect token → 403; non-approved reads on the
  public endpoint silently fall back to approved (no leak that pending rows exist).
- Concurrent review of the same row: approve/reject act on `status='pending'` rows only; a
  second action on an already-resolved row is a no-op (report "already reviewed").

## Testing

- **Pipeline:** unit-test that a changed holder produces a `pending` `cnmv_changes` row and
  leaves `cnmv_shareholders_current` untouched (model B); that `--auto-approve` still writes
  `current` directly.
- **API:** approve applies values + clears `verify_flag` + logs; reject sets `verify_flag` +
  logs + leaves value; `scope:company` resolves all rows; non-admin → 403; public read
  exposes the caveat fields and never leaks pending data.
- **UI:** tab switch; existing→proposed rendering; per-row and per-company actions;
  optimistic update + refresh; empty state; auth failure surfaces.

## Out of scope (YAGNI)

- Inline Modify / hand-editing of values.
- Global "approve all companies" action.
- A standalone CNMV dashboard outside the existing admin page.
- Retroactive backfill of `verify_flag` for historical rejections.

## Deployment / operational notes

- The admin-gate change to `borme_search_api.py` is already staged in the repo working tree
  (5 hunks over the live server file) and must be deployed separately: scp the file, set
  `CNMV_ADMIN_TOKEN`, restart the service.
- Reminder: the live `borme_search_api.py` has ~6 months of uncommitted feature work; this
  feature's API changes should be committed alongside, not left in the same undifferentiated
  working tree.
```
