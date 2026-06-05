# CNMV Significant-Shareholder Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A password-gated admin surface to Approve/Reject the weekly CNMV significant-shareholder changes, with a staging write-model so the public page never shows unverified data and rejected values are flagged "verify at CNMV".

**Architecture:** Write-model B — the weekly pipeline stages new/changed/dropped holders in `cnmv_changes` (status `pending`) and leaves the approved `cnmv_shareholders_current` row untouched. Admin endpoints on the BORME API (`api.ncdata.eu`, gated by the existing `_cnmv_admin_ok`/`X-Admin-Token`) list pending diffs and apply approve/reject. The admin React page gains a CNMV Review tab; the public `/empresa` server-rendered page gains a per-holder caveat.

**Tech Stack:** PostgreSQL, Python/Flask (`borme_search_api.py`), Python pipeline (`push_cnmv_to_pg.py`), React/MUI (`AdminPage.jsx`), Cloudflare Pages Function server-rendered HTML (`_lib.js`).

**Spans two repos:** `ncdata_infra` (DB, pipeline, API) and `mapasocietario` (admin UI, public page).

## Testing approach (read first)

Neither repo has a unit-test harness: `mapasocietario` has no vitest/jest; `ncdata_infra`'s `test_*.py` are standalone runnable print-scripts that connect to live services. This plan therefore verifies each task pragmatically, matching existing conventions:
- **Pipeline/SQL:** `python3 push_cnmv_to_pg.py --dry-run` and direct `psql` queries against a DB.
- **API:** `curl` against a locally-run or staging API, with/without `X-Admin-Token`.
- **Frontend:** `npm run build` (must pass) + manual check in `npm run dev`.
Do **not** scaffold a new test framework — it is out of scope. Where a piece of pure logic is worth a check, add a standalone `cnmv/check_*.py` script in the ncdata_infra style.

---

## Task 0 (prerequisite): Deploy the already-staged admin gate

The `_cnmv_admin_ok` gate is already written in the repo working tree but **not on the live server**. It must be live before the review endpoints make sense.

**Files:** `ncdata_infra/bormes/borme_search_api.py` (already modified, uncommitted)

- [ ] **Step 1: Commit the staged API changes** (separately from this feature, since they predate it)

```bash
cd ~/ncdata_infra
git add bormes/borme_search_api.py
git commit -m "feat(cnmv): admin-gate review-queue endpoints (X-Admin-Token)"
```

- [ ] **Step 2: Set the shared admin token on the BORME box**

Add to the API service env file (same file holding `PG_PASSWORD`):
```
CNMV_ADMIN_TOKEN=<set equal to the payments admin key>
```

- [ ] **Step 3: Deploy and restart**

Copy the file to the server and restart the API service (operator's normal deploy step). Verify:
```bash
curl -s "https://api.ncdata.eu/bormes/cnmv/pending"            # expect 403
curl -s -H "X-Admin-Token: <key>" "https://api.ncdata.eu/bormes/cnmv/pending"   # expect 200 JSON
```
Expected: 403 without token, 200 with token.

---

## Task 1: Database schema — staging columns, verify flag, audit log

**Files:**
- Modify: `ncdata_infra/cnmv/schema.sql`
- Apply: via `psql` against the live DB

- [ ] **Step 1: Add the DDL to `schema.sql`** (append after the existing `cnmv_changes` block, ~line 90)

```sql
-- Review workflow (model B): cnmv_changes is the staging area; approved/rejected
-- transitions are applied to cnmv_shareholders_current by the API review endpoint.
ALTER TABLE cnmv_changes        ADD COLUMN IF NOT EXISTS holder_norm  TEXT;
ALTER TABLE cnmv_changes        ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'pending'; -- pending | approved | rejected
ALTER TABLE cnmv_changes        ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ;
ALTER TABLE cnmv_changes        ADD COLUMN IF NOT EXISTS reviewed_note TEXT;
CREATE INDEX IF NOT EXISTS idx_cnmv_changes_status ON cnmv_changes(status);
CREATE INDEX IF NOT EXISTS idx_cnmv_changes_slug_status ON cnmv_changes(slug, status);

-- "Value may be stale vs CNMV" flag, set when a change is rejected and cleared on
-- the next approval for that holder.
ALTER TABLE cnmv_shareholders_current ADD COLUMN IF NOT EXISTS verify_flag BOOLEAN NOT NULL DEFAULT FALSE;

-- Append-only audit of every review action (LIA accountability).
CREATE TABLE IF NOT EXISTS cnmv_review_log (
  id           SERIAL PRIMARY KEY,
  reviewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  action       TEXT NOT NULL,        -- approve | reject
  scope        TEXT NOT NULL,        -- row | company
  slug         TEXT NOT NULL,
  holder_norm  TEXT,
  old_pct      NUMERIC,
  new_pct      NUMERIC,
  note         TEXT
);
CREATE INDEX IF NOT EXISTS idx_cnmv_review_log_slug ON cnmv_review_log(slug);
```

- [ ] **Step 2: Apply to the DB**

```bash
cd ~/ncdata_infra/cnmv
PGPASSWORD=… psql -h 127.0.0.1 -U borme -d borme -f schema.sql
```
Expected: `ALTER TABLE` / `CREATE TABLE` / `CREATE INDEX` with no errors (idempotent — safe to re-run).

- [ ] **Step 3: Verify columns exist**

```bash
PGPASSWORD=… psql -h 127.0.0.1 -U borme -d borme -c "\d cnmv_changes" -c "\d cnmv_shareholders_current" -c "\d cnmv_review_log"
```
Expected: `cnmv_changes` shows `holder_norm,status,reviewed_at,reviewed_note`; `cnmv_shareholders_current` shows `verify_flag`; `cnmv_review_log` exists.

- [ ] **Step 4: Commit**

```bash
git add cnmv/schema.sql
git commit -m "feat(cnmv): schema for review staging, verify_flag, review audit log"
```

---

## Task 2: Pipeline model B — stage diffs, don't overwrite approved rows

**Files:**
- Modify: `ncdata_infra/cnmv/push_cnmv_to_pg.py` (the per-company holder loop in `main()`, currently ~lines 120–210)

**Behaviour change:** On a weekly (non-`--auto-approve`) run, for each company:
- baseline = approved current rows (`status='approved'`) keyed by `holder_norm`
- **unchanged** holder → upsert `current` to refresh `last_seen` (keep value + `approved` status)
- **new** holder → stage `cnmv_changes('new', holder_norm, old=NULL, new)`; do NOT write `current`
- **changed** holder → stage `cnmv_changes(increased|decreased, holder_norm, old, new)`; do NOT change the `current` value
- **dropped** holder → stage `cnmv_changes('dropped', holder_norm, old, NULL)`; do NOT flip `is_current`
- `--auto-approve` (baseline load) path is unchanged: it writes `current` directly as `approved`.

- [ ] **Step 1: Replace the per-holder current-table writes + change detection.** In `main()`, replace the block that does the `INSERT … ON CONFLICT … cnmv_shareholders_current` upsert, the dropped-holder `UPDATE`, and the `changes_rows` computation with the following. Keep the `cnmv_observations` insert above it unchanged.

```python
                # ---- current-table writes + change staging (model B) ----
                if auto_approve:
                    # Baseline load: write approved rows directly, no change staging.
                    for s in shs:
                        hn = norm(s.get('holder'))
                        cur.execute(
                            """INSERT INTO cnmv_shareholders_current
                                 (slug, holder, holder_norm, ticker, pct_acciones_total, pct_directo,
                                  pct_indirecto, pct_instrumentos, pct_total, registry_date, status,
                                  is_current, first_seen, last_seen, last_changed)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'approved',TRUE,now(),now(),now())
                               ON CONFLICT (slug, holder_norm) DO UPDATE SET
                                 holder=EXCLUDED.holder, ticker=EXCLUDED.ticker,
                                 pct_acciones_total=EXCLUDED.pct_acciones_total,
                                 pct_directo=EXCLUDED.pct_directo, pct_indirecto=EXCLUDED.pct_indirecto,
                                 pct_instrumentos=EXCLUDED.pct_instrumentos, pct_total=EXCLUDED.pct_total,
                                 registry_date=EXCLUDED.registry_date, is_current=TRUE,
                                 status='approved', last_seen=now()""",
                            (slug, s.get('holder'), hn, c.get('ticker'),
                             s.get('pct_acciones_total'), s.get('pct_directo'), s.get('pct_indirecto'),
                             s.get('pct_instrumentos'), s.get('pct_total'), s.get('registry_date')),
                        )
                    continue  # next company

                # Weekly run: compare to the APPROVED baseline; stage diffs only.
                cur.execute(
                    "SELECT holder_norm, holder, pct_total::float8 FROM cnmv_shareholders_current "
                    "WHERE slug=%s AND status='approved'",
                    (slug,),
                )
                prev = {r[0]: {'holder': r[1], 'pct': r[2]} for r in cur.fetchall()}
                seen = set()
                for s in shs:
                    hn = norm(s.get('holder'))
                    seen.add(hn)
                    new_pct = s.get('pct_total')
                    old = prev.get(hn)
                    if old is None:
                        changes_rows.append((run_id, slug, c.get('ticker'), s.get('holder'), hn,
                                             'new', None, new_pct, s.get('registry_date')))
                        n_new += 1
                    elif new_pct is not None and old['pct'] is not None and abs(new_pct - old['pct']) >= 0.001:
                        ctype = 'increased' if new_pct > old['pct'] else 'decreased'
                        changes_rows.append((run_id, slug, c.get('ticker'), s.get('holder'), hn,
                                             ctype, old['pct'], new_pct, s.get('registry_date')))
                        n_changed += 1
                    else:
                        # unchanged: refresh last_seen, keep approved value + status
                        cur.execute(
                            "UPDATE cnmv_shareholders_current SET last_seen=now(), is_current=TRUE "
                            "WHERE slug=%s AND holder_norm=%s",
                            (slug, hn),
                        )
                # dropped: present in approved baseline but absent from this scrape
                for hn, info in prev.items():
                    if hn not in seen:
                        changes_rows.append((run_id, slug, c.get('ticker'), info['holder'], hn,
                                             'dropped', info['pct'], None, None))
                        n_dropped += 1
```

- [ ] **Step 2: Update the `cnmv_changes` INSERT to include `holder_norm` and `status`.** Replace the existing `changes_rows` insert (near the end of the company loop) with:

```python
            if changes_rows:
                psycopg2.extras.execute_values(
                    cur,
                    """INSERT INTO cnmv_changes
                       (run_id, slug, ticker, holder, holder_norm, change_type, old_pct, new_pct, registry_date, status)
                       VALUES %s""",
                    [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], 'pending') for r in changes_rows],
                )
```

- [ ] **Step 3: Remove the now-dead `detect_changes`/old-upsert variables.** Ensure `n_new/n_changed/n_dropped/changes_rows` are still initialised before the company loop; delete the old `prev`/`detect_changes` fetch and the old upsert/dropped/changes blocks that this replaces. Confirm `--auto-approve` still has `detect_changes` semantics removed (the new code branches on `auto_approve` directly).

- [ ] **Step 4: Dry-run parse check**

```bash
cd ~/ncdata_infra/cnmv
python3 push_cnmv_to_pg.py --dry-run
```
Expected: prints per-company holder counts, no DB writes, no Python errors.

- [ ] **Step 5: Real run against the DB, then verify staging** (use the latest scraped JSON)

```bash
PGPASSWORD=… python3 push_cnmv_to_pg.py
PGPASSWORD=… psql -h 127.0.0.1 -U borme -d borme -c \
  "SELECT slug, holder_norm, change_type, old_pct, new_pct, status FROM cnmv_changes WHERE status='pending' ORDER BY slug LIMIT 20;"
PGPASSWORD=… psql -h 127.0.0.1 -U borme -d borme -c \
  "SELECT count(*) FROM cnmv_shareholders_current WHERE status='approved';"
```
Expected: pending rows carry `holder_norm`; the approved count is unchanged from before the run (model B did not overwrite/insert approved rows).

- [ ] **Step 6: Commit**

```bash
git add cnmv/push_cnmv_to_pg.py
git commit -m "feat(cnmv): model B — stage changes, never overwrite approved rows"
```

---

## Task 3: API — `GET /bormes/cnmv/pending` returns existing → proposed diffs

**Files:**
- Modify: `ncdata_infra/bormes/borme_search_api.py` (replace the body of `cnmv_pending`, ~line 12134; it is already admin-gated by `_cnmv_admin_ok`)

- [ ] **Step 1: Replace the `cnmv_pending` query/response** so each pending change carries the current approved value (existing) alongside the proposed value.

```python
@app.route('/bormes/cnmv/pending', methods=['GET', 'OPTIONS'])
@log_endpoint
def cnmv_pending():
    """Pending CNMV changes grouped by company, each with existing (approved) vs
    proposed values, for the admin review UI. Admin-gated."""
    if request.method == 'OPTIONS':
        return cors_response({}, 200)
    if not _cnmv_admin_ok():
        return cors_response({'error': 'admin token required', 'success': False}, 403)
    conn = _pg_connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT ch.id, ch.slug, ch.ticker, ch.holder, ch.holder_norm,
                          ch.change_type, ch.old_pct::float8 AS old_pct,
                          ch.new_pct::float8 AS new_pct, ch.registry_date::text AS registry_date,
                          ch.detected_at::text AS detected_at,
                          cur.pct_total::float8     AS existing_pct_total,
                          cur.pct_directo::float8   AS existing_pct_directo,
                          cur.pct_indirecto::float8 AS existing_pct_indirecto
                   FROM cnmv_changes ch
                   LEFT JOIN cnmv_shareholders_current cur
                          ON cur.slug = ch.slug AND cur.holder_norm = ch.holder_norm
                   WHERE ch.status = 'pending'
                   ORDER BY ch.slug, ch.change_type, ch.new_pct DESC NULLS LAST""")
            rows = cur.fetchall()
        bycomp = {}
        for r in rows:
            grp = bycomp.setdefault(r['slug'], {'slug': r['slug'], 'ticker': r['ticker'], 'changes': []})
            grp['changes'].append(r)
        return cors_response({'success': True, 'count': len(rows),
                              'companies': list(bycomp.values()), 'source': CNMV_SOURCE}, 200)
    finally:
        conn.close()
```

- [ ] **Step 2: Verify**

```bash
curl -s -H "X-Admin-Token: <key>" "https://api.ncdata.eu/bormes/cnmv/pending" | python3 -m json.tool | head -40
```
Expected: JSON `companies[].changes[]` with `change_type`, `new_pct`, and `existing_pct_total` populated for changed/dropped (null for new).

- [ ] **Step 3: Commit** (`borme_search_api.py`, with Task 4 & 5 — commit once after Task 5).

---

## Task 4: API — `POST /bormes/cnmv/review` (approve / reject, row / company)

**Files:**
- Modify: `ncdata_infra/bormes/borme_search_api.py` (add a new route after `cnmv_pending`)

**Semantics by change_type on APPROVE** (apply proposed → current, mark change approved, clear verify_flag, log):
- `new`: insert the holder into `current` as `approved` (values from the matching `cnmv_observations` row for that run).
- `increased|decreased`: update the existing `current` row's pct_* to the proposed values (from the observation), keep `approved`, clear `verify_flag`.
- `dropped`: set `is_current=FALSE` on the `current` row.

**On REJECT** (mark change rejected, set verify_flag on current, log; value untouched):
- any type with an existing current row → `verify_flag=TRUE`; `new` with no current row → nothing to flag (just mark rejected).

- [ ] **Step 1: Add the review endpoint.**

```python
@app.route('/bormes/cnmv/review', methods=['POST', 'OPTIONS'])
@log_endpoint
def cnmv_review():
    """Approve or reject pending CNMV changes. Admin-gated.
    Body: {slug, holder_norm?, action: 'approve'|'reject', scope: 'row'|'company', note?}"""
    if request.method == 'OPTIONS':
        return cors_response({}, 200)
    if not _cnmv_admin_ok():
        return cors_response({'error': 'admin token required', 'success': False}, 403)
    body = request.get_json(silent=True) or {}
    slug = (body.get('slug') or '').strip().lower()
    action = (body.get('action') or '').strip().lower()
    scope = (body.get('scope') or 'row').strip().lower()
    holder_norm = (body.get('holder_norm') or '').strip()
    note = body.get('note')
    if not slug or action not in ('approve', 'reject'):
        return cors_response({'error': 'slug and valid action required', 'success': False}, 400)
    if scope == 'row' and not holder_norm:
        return cors_response({'error': 'holder_norm required for row scope', 'success': False}, 400)

    conn = _pg_connect()
    conn.autocommit = False
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if scope == 'company':
                cur.execute("""SELECT * FROM cnmv_changes
                               WHERE slug=%s AND status='pending'""", (slug,))
            else:
                cur.execute("""SELECT * FROM cnmv_changes
                               WHERE slug=%s AND holder_norm=%s AND status='pending'""",
                            (slug, holder_norm))
            changes = cur.fetchall()
            applied = 0
            for ch in changes:
                hn, ct, run_id = ch['holder_norm'], ch['change_type'], ch['run_id']
                if action == 'approve':
                    if ct == 'dropped':
                        cur.execute("""UPDATE cnmv_shareholders_current
                                       SET is_current=FALSE, status='approved', verify_flag=FALSE,
                                           last_changed=now()
                                       WHERE slug=%s AND holder_norm=%s""", (slug, hn))
                    else:
                        # pull the proposed full breakdown from this run's observation
                        cur.execute("""SELECT holder, pct_acciones_total, pct_directo, pct_indirecto,
                                              pct_instrumentos, pct_total, registry_date
                                       FROM cnmv_observations
                                       WHERE run_id=%s AND slug=%s AND holder_norm=%s
                                       ORDER BY id DESC LIMIT 1""", (run_id, slug, hn))
                        obs = cur.fetchone()
                        if obs:
                            cur.execute("""INSERT INTO cnmv_shareholders_current
                                  (slug, holder, holder_norm, ticker, pct_acciones_total, pct_directo,
                                   pct_indirecto, pct_instrumentos, pct_total, registry_date, status,
                                   is_current, first_seen, last_seen, last_changed)
                                  VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'approved',TRUE,now(),now(),now())
                                  ON CONFLICT (slug, holder_norm) DO UPDATE SET
                                    holder=EXCLUDED.holder, ticker=EXCLUDED.ticker,
                                    pct_acciones_total=EXCLUDED.pct_acciones_total,
                                    pct_directo=EXCLUDED.pct_directo, pct_indirecto=EXCLUDED.pct_indirecto,
                                    pct_instrumentos=EXCLUDED.pct_instrumentos, pct_total=EXCLUDED.pct_total,
                                    registry_date=EXCLUDED.registry_date, status='approved',
                                    is_current=TRUE, verify_flag=FALSE, last_seen=now(), last_changed=now()""",
                                (slug, obs['holder'], hn, ch['ticker'], obs['pct_acciones_total'],
                                 obs['pct_directo'], obs['pct_indirecto'], obs['pct_instrumentos'],
                                 obs['pct_total'], obs['registry_date']))
                    cur.execute("UPDATE cnmv_changes SET status='approved', reviewed_at=now(), reviewed_note=%s WHERE id=%s",
                                (note, ch['id']))
                else:  # reject
                    cur.execute("""UPDATE cnmv_shareholders_current SET verify_flag=TRUE, last_changed=now()
                                   WHERE slug=%s AND holder_norm=%s""", (slug, hn))
                    cur.execute("UPDATE cnmv_changes SET status='rejected', reviewed_at=now(), reviewed_note=%s WHERE id=%s",
                                (note, ch['id']))
                cur.execute("""INSERT INTO cnmv_review_log (action, scope, slug, holder_norm, old_pct, new_pct, note)
                               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                            (action, scope, slug, hn, ch['old_pct'], ch['new_pct'], note))
                applied += 1
        conn.commit()
        return cors_response({'success': True, 'action': action, 'scope': scope, 'applied': applied}, 200)
    except Exception as e:
        conn.rollback()
        return cors_response({'error': str(e), 'success': False}, 500)
    finally:
        conn.close()
```

- [ ] **Step 2: Verify approve + reject end-to-end** (pick a real pending row from Task 3's output)

```bash
# reject a row → expect verify_flag set
curl -s -X POST -H "X-Admin-Token: <key>" -H "Content-Type: application/json" \
  -d '{"slug":"<slug>","holder_norm":"<HN>","action":"reject","scope":"row"}' \
  https://api.ncdata.eu/bormes/cnmv/review
# approve all for a company → expect proposed values applied
curl -s -X POST -H "X-Admin-Token: <key>" -H "Content-Type: application/json" \
  -d '{"slug":"<slug>","action":"approve","scope":"company"}' \
  https://api.ncdata.eu/bormes/cnmv/review
```
Then check DB: rejected change → `cnmv_changes.status='rejected'` + `cnmv_shareholders_current.verify_flag=TRUE`; approved → `status='approved'` + current value matches proposed + a `cnmv_review_log` row per action.

---

## Task 5: API — public `/shareholders` exposes the verify caveat

**Files:**
- Modify: `ncdata_infra/bormes/borme_search_api.py` (`cnmv_shareholders`, ~line 12061)

- [ ] **Step 1: Add `verify_flag` to the selected columns.** In `_CNMV_SH_COLS` (line ~12052) append `, verify_flag` so the public rows carry it.

- [ ] **Step 2: Add a company-level summary + caveat text to the response.** In `cnmv_shareholders`, after building `shareholders`, compute and include:

```python
        has_unverified = any(s.get('verify_flag') for s in shareholders)
        # ... inside the returned dict, add:
        #   'has_unverified': has_unverified,
        #   'verify_notice': ('Algún valor podría no reflejar la última comunicación a la CNMV; '
        #                     'verifique en cnmv.es.'),
```
Add the two keys to the existing `cors_response({...})` return. Each shareholder already includes `verify_flag` (renamed to `verify_at_source` is optional — keep `verify_flag` for simplicity and consume that name on the frontend).

- [ ] **Step 3: Verify** the public endpoint still defaults to approved and now carries the flag.

```bash
curl -s "https://api.ncdata.eu/bormes/cnmv/shareholders?company=<slug>" | python3 -m json.tool | grep -E "verify_flag|has_unverified" | head
```
Expected: `has_unverified` present; the rejected holder shows `verify_flag: true`.

- [ ] **Step 4: Commit the API changes (Tasks 3–5)**

```bash
cd ~/ncdata_infra
git add bormes/borme_search_api.py
git commit -m "feat(cnmv): review endpoint + pending diffs + public verify caveat"
```

---

## Task 6: Admin UI — tab bar (Orders | CNMV Review)

**Files:**
- Modify: `mapasocietario/src/components/AdminPage.jsx`

- [ ] **Step 1: Add MUI Tabs + state.** Import `Tabs, Tab` from `@mui/material`. Add `const [tab, setTab] = useState(0);` near the other `useState`s (after line 45). The existing CNMV admin token is the same `adminKey`.

- [ ] **Step 2: Render the tab bar** inside the authenticated return (after the header `Box`, before the `error` Alert, ~line 266):

```jsx
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Orders" sx={{ textTransform: 'none' }} />
          <Tab label="CNMV Review" sx={{ textTransform: 'none' }} />
        </Tabs>
```

- [ ] **Step 3: Wrap the existing Orders sections** (the Pending Orders + Completed Orders blocks, ~lines 280–368) in `{tab === 0 && ( … )}` and add `{tab === 1 && <CnmvReviewTab adminKey={adminKey} />}` after them.

- [ ] **Step 4: Build check**

```bash
cd ~/mapasocietario && npm run build
```
Expected: build passes; `/admin` shows two tabs, Orders tab unchanged.

---

## Task 7: Admin UI — CnmvReviewTab component

**Files:**
- Create: `mapasocietario/src/components/CnmvReviewTab.jsx`
- Reference: `const BORME_API = 'https://api.ncdata.eu';`

- [ ] **Step 1: Create the component.** It fetches pending changes with `X-Admin-Token: adminKey`, renders companies (collapsible) with an existing→proposed table, and posts approve/reject.

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Alert, Chip, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const BORME_API = 'https://api.ncdata.eu';
const fmtPct = (n) => (typeof n === 'number' ? `${n.toFixed(3)} %` : '—');
const CHANGE_COLOR = { new: 'success', increased: 'info', decreased: 'warning', dropped: 'default' };

export default function CnmvReviewTab({ adminKey }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // `${slug}:${hn}` or `${slug}:ALL`
  const [open, setOpen] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BORME_API}/bormes/cnmv/pending`, { headers: { 'X-Admin-Token': adminKey } });
      if (res.status === 403) { setError('Admin token rejected by BORME API.'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch (e) { setError(`Failed to load pending changes: ${e.message}`); }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { load(); }, [load]);

  const review = async (slug, holder_norm, action, scope) => {
    setBusy(`${slug}:${scope === 'company' ? 'ALL' : holder_norm}`); setError('');
    try {
      const res = await fetch(`${BORME_API}/bormes/cnmv/review`, {
        method: 'POST',
        headers: { 'X-Admin-Token': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, holder_norm, action, scope }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      await load();
    } catch (e) { setError(`Review failed: ${e.message}`); }
    finally { setBusy(null); }
  };

  if (loading && !companies.length) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={32} /></Box>;
  if (error) return <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>;
  if (!companies.length) return (
    <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, textAlign: 'center' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>No pending CNMV changes.</Typography>
    </Paper>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {error && <Alert severity="error" sx={{ fontSize: '0.8rem' }}>{error}</Alert>}
      {companies.map((co) => {
        const isOpen = open[co.slug] !== false; // default open
        const allBusy = busy === `${co.slug}:ALL`;
        return (
          <Paper key={co.slug} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                 onClick={() => setOpen((o) => ({ ...o, [co.slug]: o[co.slug] === false }))}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                {co.slug}{co.ticker ? ` (${co.ticker})` : ''} · {co.changes.length} change(s)
              </Typography>
              {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
            <Collapse in={isOpen}>
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {co.changes.map((ch) => {
                  const rowBusy = busy === `${co.slug}:${ch.holder_norm}`;
                  return (
                    <Box key={ch.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
                                           p: 1, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.2)' }}>
                      <Chip size="small" label={ch.change_type} color={CHANGE_COLOR[ch.change_type] || 'default'}
                            sx={{ fontSize: '0.6rem', height: 18 }} />
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 180 }}>{ch.holder}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                        {fmtPct(ch.existing_pct_total)} → {ch.change_type === 'dropped' ? '(removed)' : fmtPct(ch.new_pct)}
                      </Typography>
                      <Button size="small" variant="contained" color="success" disabled={rowBusy}
                              onClick={() => review(co.slug, ch.holder_norm, 'approve', 'row')}
                              sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
                        {rowBusy ? <CircularProgress size={12} /> : 'Approve'}
                      </Button>
                      <Button size="small" variant="outlined" color="error" disabled={rowBusy}
                              onClick={() => review(co.slug, ch.holder_norm, 'reject', 'row')}
                              sx={{ textTransform: 'none', fontSize: '0.7rem' }}>Reject</Button>
                    </Box>
                  );
                })}
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Button size="small" variant="contained" color="success" disabled={allBusy}
                          onClick={() => review(co.slug, null, 'approve', 'company')}
                          sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
                    {allBusy ? <CircularProgress size={12} /> : 'Approve all'}
                  </Button>
                  <Button size="small" variant="outlined" color="error" disabled={allBusy}
                          onClick={() => review(co.slug, null, 'reject', 'company')}
                          sx={{ textTransform: 'none', fontSize: '0.7rem' }}>Reject all</Button>
                </Box>
              </Box>
            </Collapse>
          </Paper>
        );
      })}
    </Box>
  );
}
```

- [ ] **Step 2: Import it in `AdminPage.jsx`** (top of file): `import CnmvReviewTab from './CnmvReviewTab';`

- [ ] **Step 3: Build + manual check**

```bash
cd ~/mapasocietario && npm run build && npm run dev
```
Open `/admin?key=<adminKey>` → CNMV Review tab → companies list, per-row and per-company Approve/Reject work and refresh.

- [ ] **Step 4: Commit (Tasks 6–7)**

```bash
git add src/components/AdminPage.jsx src/components/CnmvReviewTab.jsx
git commit -m "feat(admin): CNMV review tab — approve/reject pending shareholder changes"
```

---

## Task 8: Public page — per-holder verify caveat on /empresa

**Files:**
- Modify: `mapasocietario/functions/empresa/_lib.js` (labels ~226/340, render block 621–639)

- [ ] **Step 1: Add caveat labels** to both translation objects. After `cnmvSource` in the `es` object (~line 233) add:

```js
    cnmvVerify: 'Posible cambio no verificado — el valor mostrado podría no reflejar la última comunicación a la CNMV. Consulte cnmv.es.',
```
After `cnmvSource` in the `en` object (~line 347) add:

```js
    cnmvVerify: 'Possible unverified change — the value shown may not reflect the latest CNMV filing. Check cnmv.es.',
```

- [ ] **Step 2: Render the per-holder marker** in the shareholder row map (line 633). Append a marker after the holder name cell when `s.verify_flag`:

```js
              (s) => `<tr><td>${esc(s.holder)}${s.verify_flag ? ` <span class="verify" title="${esc(t.cnmvVerify)}">⚠</span>` : ''}</td><td>${esc(fmtPct(s.pct_total))}</td><td>${esc(fmtPct(s.pct_directo))}</td><td>${esc(fmtPct(s.pct_indirecto))}</td><td>${esc(fmtPct(s.pct_instrumentos))}</td><td>${esc(fmtDate(s.registry_date, lang))}</td></tr>`,
```

- [ ] **Step 3: Render a company-level note** under the table when the API reports `has_unverified`. Change the `<p class="more">` source line (637) to be preceded by the note:

```js
        ${cnmv && cnmv.has_unverified ? `<p class="more verify-note">⚠ ${esc(t.cnmvVerify)}</p>` : ''}
        <p class="more">${t.cnmvSource(fmtDate(cnmv.last_modified, lang))}<a href="https://www.cnmv.es/" rel="nofollow noopener" target="_blank">cnmv.es</a>.</p>
```

- [ ] **Step 4: Build check**

```bash
cd ~/mapasocietario && npm run build
```
Expected: build passes. (Manual: a company with a rejected holder shows the ⚠ marker + note; check via `npm run dev` against a slug that has `verify_flag`.)

- [ ] **Step 5: Commit**

```bash
git add functions/empresa/_lib.js
git commit -m "feat(empresa): per-holder + company verify-at-CNMV caveat for rejected changes"
```

---

## Final verification (whole feature)

- [ ] Weekly pipeline run stages diffs without overwriting approved rows (Task 2 Step 5).
- [ ] `/bormes/cnmv/pending` (admin) returns existing→proposed; 403 without token.
- [ ] Approve applies proposed values + clears verify_flag + logs; Reject sets verify_flag + logs + leaves value.
- [ ] Public `/empresa/<slug>` shows approved data + ⚠ caveat where a change was rejected.
- [ ] `cnmv_review_log` has one row per action (LIA audit trail).
- [ ] Both repos committed; admin gate (Task 0) deployed with `CNMV_ADMIN_TOKEN` set.

## Notes / gotchas

- The `--auto-approve` path is only for the one-time baseline; weekly runs must NOT use it.
- Reject of a `new` holder (no current row) just marks the change rejected — there's no value to flag, which is correct.
- If a later weekly run re-detects a previously-rejected change as a new pending change, that's expected: the operator reviews it again. `verify_flag` clears when any change for that holder is approved.
