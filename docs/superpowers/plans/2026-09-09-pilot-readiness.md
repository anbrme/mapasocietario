# Pilot Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the attestation pilot showable to real companies — publish the operating entity rather than an employee's name, let a pilot company preview its own badge before it is public, and start a durable record of every reconciliation check.

**Architecture:** Three independent slices over the existing pilot. The reviewer change lands in one place (`publicProjection`), because every public reader is downstream of that allow-list. The preview reuses `view_grants` with a `kind` column and its own route, so no token ever reaches the cacheable `/empresa` path. Check continuity is one new table written inside the `batch()` the reconciler already runs, deliberately outside the audit chain.

**Tech Stack:** Cloudflare Pages Functions, a Cloudflare Worker (cron), D1 (`VERIFY_DB` = `mapasocietario-verify`), vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-pilot-readiness-design.md`

## Global Constraints

- **The legal entity is `Nurnberg Consulting SL`** — no umlaut, no periods in "SL". This is how the name is registered.
- **The individual reviewer's name is retained internally** in `attestations.reviewer` and `audit_events.detail`, and redacted only from the public projection. The redaction is asymmetric by design; tests must assert **both** halves, or a later "consistency" cleanup will delete the accountability.
- **Every non-valid grant state returns 404, never 403.** A 403 confirms the record exists.
- **A grant counts openings of a link, never readers.** No surface may describe it otherwise.
- **Preview grant TTL is 14 days.**
- **`reconciliation_runs` retention is 730 days (2 years).**
- Run the whole suite with `npm test` (`vitest run && node --test test/*.test.mjs`). Vitest collects `src/**/*.test.js`, `functions/**/*.test.js`, `scripts/**/*.test.js`.
- Commit with `git -c commit.gpgsign=false commit`.
- Migrations apply with `npx wrangler d1 execute mapasocietario-verify --remote --file=migrations/<file>.sql`. Use `--local` first.

---

### Task 1: The public reviewer is the operating entity

**Files:**
- Modify: `src/verify/projection.js`
- Modify: `src/verify/projection.test.js`
- Modify: `src/verify/render.js:43,69`
- Modify: `src/verify/render.test.js`
- Create: `functions/empresa/_confirmation.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PUBLIC_REVIEWER` (string constant) exported from `src/verify/projection.js`. Task 6's tests import it.

**Why only the projection changes:** `liveAttestationFor()` returns `publicProjection(...)` (`functions/empresa/_attestation.js:64`), so the `/empresa` badge, the in-app `CurrencyConfirmationCard`, `/api/verify/badge` and the grant permalink are all downstream of it. `functions/empresa/_confirmation.js` needs **no edit** — it gets a regression test instead.

- [ ] **Step 1: Write the failing tests**

In `src/verify/projection.test.js`, replace the test named `'publishes the reviewer, deliberately'` with:

```js
  it('names the operating entity, never the individual reviewer', () => {
    const view = publicProjection(record(), [], []);
    expect(view.reviewer).toBe(PUBLIC_REVIEWER);
    expect(JSON.stringify(view)).not.toContain('Alessandro');
  });
```

Change the import line at the top of that file to:

```js
import { publicProjection, PUBLIC_REVIEWER } from './projection.js';
```

In the same file, add `reviewer` to the poisoned record inside `'never leaks any private field, for any generated value'`, so the property test enforces the redaction rather than a single example. The `poisoned` assignment becomes:

```js
      const poisoned = record({
        claimant_email: marker, identification_note: marker, email_domain_basis: marker,
        sealed_key: marker, personal_key: marker, sealed_hash: marker, decision_note: marker,
        reviewer: marker,
      });
```

and add the reviewer's name to the `secrets` array in that same test:

```js
    const secrets = ['ceo@example.es', 'video call 2026-09-07', 'company website',
                     'evidence/sealed/abc.json', 'evidence/personal/abc.json',
                     'deadbeef', 'internal: checked poder', 'Alessandro Nürnberg'];
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/verify/projection.test.js`
Expected: FAIL — `PUBLIC_REVIEWER` is not exported, and the property test finds the marker in `reviewer`.

- [ ] **Step 3: Change the projection**

In `src/verify/projection.js`, replace the whole header comment block with:

```js
/**
 * The ONLY shape a reader ever sees. Built by allow-list: a deny-list would
 * leak every column added after it was written.
 *
 * `reviewer` is REDACTED to the operating entity. Section 8 of the pilot design
 * published the individual deliberately — the reviewer takes accountability for
 * the decision — but that reasoning assumed a sole operator and does not survive
 * an employee doing the review. The individual is still recorded in
 * attestations.reviewer and in audit_events.detail, so the accountability is
 * kept; only the exposure is dropped. The asymmetry is deliberate: do not
 * "tidy" it by redacting the internal record too.
 *
 * Every public reader is downstream of this function — the grant permalink, the
 * /empresa badge, the in-app card and /api/verify/badge — so this constant is
 * the single point of change.
 *
 * The redaction set is claimant email, identification_note, email_domain_basis,
 * audit detail, evidence keys and hashes, grant tokens, and the reviewer's name.
 */

// The registered legal name: no umlaut, no periods. Mapa Societario is a brand
// and cannot be accountable for a review; an entity with a NIF can.
export const PUBLIC_REVIEWER = 'Nurnberg Consulting SL';
```

Then change the `reviewer` line inside `publicProjection` from `reviewer: attestation.reviewer,` to:

```js
    reviewer: PUBLIC_REVIEWER,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/verify/projection.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing render tests**

In `src/verify/render.test.js`, change the import line to:

```js
import { statusLine, renderAttestationHtml, FORBIDDEN_PHRASES } from './render.js';
import { PUBLIC_REVIEWER } from './projection.js';
```

Change the `base` fixture's reviewer line from `reviewer: 'Alessandro Nürnberg', status_reason: null,` to:

```js
  reviewer: PUBLIC_REVIEWER, status_reason: null,
```

Replace the test named `'publishes the reviewer, deliberately'` with these two:

```js
  it('names the operating entity as reviewer, not an individual', () => {
    const html = renderAttestationHtml(base, 'ACME SL', 'en');
    expect(html).toContain('reviewed by Nurnberg Consulting SL, operator of Mapa Societario');
    expect(html).not.toContain('Alessandro');
  });

  it('names the operating entity in Spanish too', () => {
    const html = renderAttestationHtml(base, 'ACME SL', 'es');
    expect(html).toContain('revisada por Nurnberg Consulting SL, operador de Mapa Societario');
  });
```

Leave the `'escapes values rather than trusting them'` test exactly as it is. The value is a constant now, but the escaping is defence in depth and costs nothing.

- [ ] **Step 6: Run the render tests to verify they fail**

Run: `npx vitest run src/verify/render.test.js`
Expected: FAIL — the rendered method line has no "operator of Mapa Societario" clause.

- [ ] **Step 7: Add the operator clause to both i18n templates**

In `src/verify/render.js`, line 43 (English), replace the `method` entry with:

```js
    method: (who, when) => `Confirmed from an address at the company's domain; the representative holds the registry-recorded position stated; their authority to make this statement was reviewed by ${who}, operator of Mapa Societario, on ${when}.`,
```

At line 69 (Spanish), replace it with:

```js
    method: (who, when) => `Confirmada desde una dirección del dominio de la empresa; el representante ocupa el cargo registral indicado; su autoridad para hacer esta declaración fue revisada por ${who}, operador de Mapa Societario, el ${when}.`,
```

- [ ] **Step 8: Run the render tests to verify they pass**

Run: `npx vitest run src/verify/render.test.js`
Expected: PASS.

- [ ] **Step 9: Add the badge regression guard**

Create `functions/empresa/_confirmation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderConfirmationBlock } from './_confirmation.js';
import { PUBLIC_REVIEWER } from '../../src/verify/projection.js';

// This is a PROJECTION, not a raw attestation row: liveAttestationFor returns
// publicProjection(...), so the badge only ever sees projected values. The
// guard exists because the badge is a public surface and the projection is the
// only thing protecting it.
const projected = () => ({
  id: 'att_x',
  status: 'live',
  method: 'email-confirmed',
  representation_basis: 'sole_admin',
  representative: { name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO' },
  accepted_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  expires_at: new Date(Date.now() + 85 * 86_400_000).toISOString(),
  approved_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
  last_verified_at: new Date(Date.now() - 86_400_000).toISOString(),
  reviewer: PUBLIC_REVIEWER,
  status_reason: null,
  facts: [],
  history: [],
});

describe('the /empresa badge', () => {
  it('attributes the review to the operating entity', () => {
    const html = renderConfirmationBlock(projected(), 'es');
    expect(html).toContain('Nurnberg Consulting SL');
  });

  it('keeps the short form: the operator clause is redundant on our own site', () => {
    const html = renderConfirmationBlock(projected(), 'es');
    expect(html).not.toContain('operador de Mapa Societario');
  });

  it('renders in English too', () => {
    const html = renderConfirmationBlock(projected(), 'en');
    expect(html).toContain('Authority reviewed by Nurnberg Consulting SL');
  });
});
```

- [ ] **Step 10: Run the full suite**

Run: `npm test`
Expected: PASS. If `renderConfirmationBlock` returns `''` for the fixture, the accepted_at age is outside the window `confirmationStatus()` accepts — widen the fixture's `accepted_at` to a more recent date rather than changing production code.

- [ ] **Step 11: Commit**

```bash
git add src/verify/projection.js src/verify/projection.test.js src/verify/render.js src/verify/render.test.js functions/empresa/_confirmation.test.js
git -c commit.gpgsign=false commit -m "feat(verify): the public reviewer is the operating entity, not a person

Section 8 published the individual deliberately, but that assumed a sole
operator. The name stays in attestations.reviewer and audit_events.detail,
so the accountability is kept and only the exposure is dropped.

One change, in publicProjection: every public reader is downstream of that
allow-list, so the badge and the in-app card needed a regression test
rather than an edit. The property test now poisons reviewer too."
```

---

### Task 2: A durable record of every reconciliation check

**Files:**
- Create: `migrations/0003_reconciliation_runs.sql`
- Modify: `src/verify/reconcile.js`
- Modify: `src/verify/reconcile.test.js`
- Modify: `workers/verification-reconciler/src/index.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `buildRunRow({ attestation, outcomes, sourceFailed, decision, checkedAt })` from `src/verify/reconcile.js`, returning a 7-element array of bind values in the column order of `reconciliation_runs`. Task 3 consumes `RUN_RETENTION_DAYS` and `runRetentionCutoff(nowMs)` from the same module.

**Why this is not an `audit_events` row:** that chain records *acts*, and a no-op check is not one; every row also lengthens the hash chain a verifier must walk. See §4.2 of the spec.

- [ ] **Step 1: Write the migration**

Create `migrations/0003_reconciliation_runs.sql`:

```sql
-- VERIFY_DB — a durable record of what was checked, when.
-- Spec: docs/superpowers/specs/2026-09-09-pilot-readiness-design.md section 4
--
-- The reconciler OVERWRITES attestation_facts.last_check_outcome and
-- attestations.last_verified_at, and writes an audit_events row only when the
-- status CHANGES. So a day on which everything checked out consistent left no
-- trace at all: we could state a last-checked date but never show continuity.
--
-- Deliberately NOT in audit_events: that chain is a record of acts, and a
-- no-op check is not one. Every row there also lengthens the hash chain that
-- verification has to walk.
--
-- source_failed is separate from an empty outcome map so that "we could not
-- check" is never legible as "we checked and found nothing wrong" — the same
-- distinction the reconciler already makes for last_verified_at.
CREATE TABLE reconciliation_runs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  attestation_id TEXT NOT NULL REFERENCES attestations(id),
  subject_id     TEXT NOT NULL REFERENCES subjects(subject_id),
  checked_at     TEXT NOT NULL,
  source_failed  INTEGER NOT NULL DEFAULT 0,
  outcomes       TEXT NOT NULL,               -- JSON: { fact_key: outcome }
  status_before  TEXT NOT NULL,
  status_after   TEXT NOT NULL
);

CREATE INDEX idx_reconciliation_runs_attestation
  ON reconciliation_runs(attestation_id, checked_at);

-- The purge in reconcileAll() scans by date across all attestations.
CREATE INDEX idx_reconciliation_runs_checked_at
  ON reconciliation_runs(checked_at);
```

- [ ] **Step 2: Write the failing tests**

Append to `src/verify/reconcile.test.js`:

```js
describe('buildRunRow', () => {
  const attestation = { id: 'att_1', subject_id: 's1', status: 'live' };

  it('records the outcome map, the status before and the status after', () => {
    const row = buildRunRow({
      attestation,
      outcomes: { address: 'consistent', officers: 'consistent' },
      sourceFailed: false,
      decision: { status: 'live' },
      checkedAt: '2026-09-10T04:15:00Z',
    });
    expect(row).toEqual([
      'att_1', 's1', '2026-09-10T04:15:00Z', 0,
      '{"address":"consistent","officers":"consistent"}', 'live', 'live',
    ]);
  });

  it('records an empty outcome map when the upstream read failed', () => {
    const row = buildRunRow({
      attestation, outcomes: {}, sourceFailed: true,
      decision: { status: null }, checkedAt: '2026-09-10T04:15:00Z',
    });
    expect(row[3]).toBe(1);
    expect(row[4]).toBe('{}');
  });

  it('carries the status forward when the decision changes nothing', () => {
    const row = buildRunRow({
      attestation, outcomes: { address: 'consistent' }, sourceFailed: false,
      decision: { status: null }, checkedAt: '2026-09-10T04:15:00Z',
    });
    expect(row[5]).toBe('live');
    expect(row[6]).toBe('live');
  });

  it('records a transition when the decision changes the status', () => {
    const row = buildRunRow({
      attestation, outcomes: { address: 'superseded_by_later_event' },
      sourceFailed: false, decision: { status: 'outdated' },
      checkedAt: '2026-09-10T04:15:00Z',
    });
    expect(row[5]).toBe('live');
    expect(row[6]).toBe('outdated');
  });
});
```

Add `buildRunRow` to the existing import at the top of that file.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/verify/reconcile.test.js`
Expected: FAIL — `buildRunRow is not a function`.

- [ ] **Step 4: Implement `buildRunRow`**

Append to `src/verify/reconcile.js`:

```js
/**
 * The bind values for one reconciliation_runs row, in column order.
 *
 * Lives here rather than in the Worker because the Worker moves data and this
 * decides what the record says — including the one distinction that matters:
 * a failed upstream read records source_failed=1 with an EMPTY outcome map, so
 * "we could not check" can never be read as "we checked and all was well".
 */
export function buildRunRow({ attestation, outcomes, sourceFailed, decision, checkedAt }) {
  return [
    attestation.id,
    attestation.subject_id,
    checkedAt,
    sourceFailed ? 1 : 0,
    JSON.stringify(sourceFailed ? {} : (outcomes || {})),
    attestation.status,
    decision.status || attestation.status,
  ];
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/verify/reconcile.test.js`
Expected: PASS.

- [ ] **Step 6: Write the row in the reconciler**

In `workers/verification-reconciler/src/index.js`, add `buildRunRow` to the existing import from `../../../src/verify/reconcile.js`:

```js
import { checkFact, nextStatus, isExpired, buildRunRow } from '../../../src/verify/reconcile.js';
```

Inside `reconcileOne`, immediately after `const statements = [...factUpdates];`, insert:

```js
  // The continuity record. Written on EVERY check, including a no-op and a
  // failed upstream read, because the value is showing that checks happened -
  // which the overwritten last_checked_at columns cannot.
  statements.push(env.VERIFY_DB.prepare(
    `INSERT INTO reconciliation_runs
      (attestation_id, subject_id, checked_at, source_failed, outcomes,
       status_before, status_after)
     VALUES (?,?,?,?,?,?,?)`)
    .bind(...buildRunRow({ attestation, outcomes, sourceFailed, decision, checkedAt: now })));
```

Note this sits **after** the `const decision = nextStatus({...})` line, which it depends on, and inside the same `batch()` — so a run row and the fact updates it describes commit together or not at all.

- [ ] **Step 7: Apply the migration locally and run the suite**

```bash
npx wrangler d1 execute mapasocietario-verify --local --file=migrations/0003_reconciliation_runs.sql
npm test
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add migrations/0003_reconciliation_runs.sql src/verify/reconcile.js src/verify/reconcile.test.js workers/verification-reconciler/src/index.js
git -c commit.gpgsign=false commit -m "feat(verify): record every reconciliation check, not just the last one

The reconciler overwrote last_checked_at and wrote an audit event only on
a status change, so a day where everything was consistent left no trace.
We could state a last-checked date but never show continuity.

Outside the audit chain on purpose: that chain records acts, and a no-op
check is not one. source_failed is stored separately so 'could not check'
is never legible as 'checked and found nothing wrong'."
```

---

### Task 3: Purge run rows older than two years

**Files:**
- Modify: `src/verify/reconcile.js`
- Modify: `src/verify/reconcile.test.js`
- Modify: `workers/verification-reconciler/src/index.js`

**Interfaces:**
- Consumes: `reconciliation_runs` (Task 2).
- Produces: `RUN_RETENTION_DAYS` (number, 730) and `runRetentionCutoff(nowMs)` (returns an ISO string) from `src/verify/reconcile.js`. Nothing later consumes these.

- [ ] **Step 1: Write the failing test**

Append to `src/verify/reconcile.test.js`:

```js
describe('runRetentionCutoff', () => {
  it('is two years before now, as an ISO string', () => {
    const now = Date.parse('2026-09-10T04:15:00Z');
    expect(RUN_RETENTION_DAYS).toBe(730);
    expect(runRetentionCutoff(now)).toBe(
      new Date(now - 730 * 86_400_000).toISOString());
  });
});
```

Add `RUN_RETENTION_DAYS` and `runRetentionCutoff` to the import at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/verify/reconcile.test.js`
Expected: FAIL — `runRetentionCutoff is not a function`.

- [ ] **Step 3: Implement it**

Append to `src/verify/reconcile.js`:

```js
// Two years. Long enough to show a counterparty a multi-year run of checks,
// short enough that the table cannot grow without bound.
export const RUN_RETENTION_DAYS = 730;

export const runRetentionCutoff = (nowMs = Date.now()) =>
  new Date(nowMs - RUN_RETENTION_DAYS * 86_400_000).toISOString();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/verify/reconcile.test.js`
Expected: PASS.

- [ ] **Step 5: Purge in the daily job**

In `workers/verification-reconciler/src/index.js`, add `runRetentionCutoff` to the import from `../../../src/verify/reconcile.js`.

In `reconcileAll`, change the report initialiser to carry a purge count:

```js
  const report = { checked: 0, changed: [], failures: [], nudge: [], anchored: null, purged: 0 };
```

Then, immediately before `return report;` at the end of `reconcileAll`, insert:

```js
  // Retention for the continuity record. Best-effort: losing a purge is a
  // storage cost, and failing the whole run over it would cost a day of checks.
  try {
    const purge = await env.VERIFY_DB
      .prepare('DELETE FROM reconciliation_runs WHERE checked_at < ?')
      .bind(runRetentionCutoff()).run();
    report.purged = purge?.meta?.changes || 0;
  } catch (e) {
    report.failures.push({ id: 'reconciliation_runs_purge', error: String(e.message || e) });
  }
```

- [ ] **Step 6: Report it in the daily mail**

In the `mail` function, in the `lines` array, insert this line immediately after the `Due for reconfirmation:` line:

```js
    `Check rows purged (older than ${RUN_RETENTION_DAYS} days): ${report.purged}`,
```

Add `RUN_RETENTION_DAYS` to the import from `../../../src/verify/reconcile.js`.

- [ ] **Step 7: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/verify/reconcile.js src/verify/reconcile.test.js workers/verification-reconciler/src/index.js
git -c commit.gpgsign=false commit -m "feat(verify): purge reconciliation runs older than two years

Best-effort inside the daily job: losing a purge costs storage, whereas
failing the run over it would cost a day of checks."
```

---

### Task 4: Preview grants

**Files:**
- Create: `migrations/0004_preview_grants.sql`
- Modify: `src/verify/grant.js`
- Create: `src/verify/grant.test.js`
- Modify: `functions/api/verify/admin/grant.js`
- Modify: `functions/verificacion/g/[token].js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, from `src/verify/grant.js`:
  - `GRANT_KINDS` — `['counterparty', 'preview']`
  - `normalizeGrantKind(raw)` — returns `'counterparty'` for undefined/null/empty, the kind if valid, `null` if invalid
  - `grantPath(kind, token)` — returns `/verificacion/p/<token>` for `'preview'`, `/verificacion/g/<token>` otherwise
  - `DEFAULT_TTL_DAYS` (90), `PREVIEW_TTL_DAYS` (14)
  - existing `grantState(row, nowMs)` unchanged

  Task 6 consumes `grantState` and `normalizeGrantKind`.

**A rule that must hold:** each token has exactly one meaning. A `preview` token opens **only** `/verificacion/p/`, and a `counterparty` token opens **only** `/verificacion/g/`. Existing rows default to `counterparty`, so nothing regresses.

- [ ] **Step 1: Write the migration**

Create `migrations/0004_preview_grants.sql`:

```sql
-- VERIFY_DB — preview grants.
-- Spec: docs/superpowers/specs/2026-09-09-pilot-readiness-design.md section 3
--
-- A pilot company cannot see its own badge: isBadgeVisible() renders one only
-- for PILOT_VISIBLE_GROUP_KEYS while VERIFY_VISIBILITY is private. That gate is
-- correct and stays. A 'preview' grant unlocks the badge for ITS OWN SUBJECT
-- ONLY, on its own route.
--
-- SQLite cannot add a CHECK constraint via ALTER TABLE, so the allowed values
-- are enforced in src/verify/grant.js (normalizeGrantKind). Existing rows
-- default to 'counterparty', so no grant changes meaning.
ALTER TABLE view_grants ADD COLUMN kind TEXT NOT NULL DEFAULT 'counterparty';
```

- [ ] **Step 2: Write the failing tests**

Create `src/verify/grant.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  grantState, normalizeGrantKind, grantPath,
  GRANT_KINDS, DEFAULT_TTL_DAYS, PREVIEW_TTL_DAYS,
} from './grant.js';

describe('grantState', () => {
  const now = Date.parse('2026-09-10T00:00:00Z');
  it('is missing for no row', () => expect(grantState(null, now)).toBe('missing'));
  it('is revoked when revoked_at is set', () =>
    expect(grantState({ revoked_at: '2026-09-09T00:00:00Z' }, now)).toBe('revoked'));
  it('is expired at or past the expiry', () =>
    expect(grantState({ expires_at: '2026-09-10T00:00:00Z' }, now)).toBe('expired'));
  it('is valid otherwise', () =>
    expect(grantState({ expires_at: '2026-09-11T00:00:00Z' }, now)).toBe('valid'));
});

describe('normalizeGrantKind', () => {
  it('defaults to counterparty when absent', () => {
    for (const absent of [undefined, null, '']) {
      expect(normalizeGrantKind(absent)).toBe('counterparty');
    }
  });
  it('accepts every declared kind', () => {
    for (const k of GRANT_KINDS) expect(normalizeGrantKind(k)).toBe(k);
  });
  it('rejects anything else with null, so the endpoint can 400', () => {
    for (const bad of ['admin', 'PREVIEW', 0, {}, 'counterparty ']) {
      expect(normalizeGrantKind(bad)).toBeNull();
    }
  });
});

describe('grantPath', () => {
  it('sends a preview to its own route', () =>
    expect(grantPath('preview', 'tok')).toBe('/verificacion/p/tok'));
  it('sends a counterparty grant to the attestation route', () =>
    expect(grantPath('counterparty', 'tok')).toBe('/verificacion/g/tok'));
});

describe('ttl defaults', () => {
  it('is 90 days for a counterparty and 14 for a preview', () => {
    expect(DEFAULT_TTL_DAYS).toBe(90);
    expect(PREVIEW_TTL_DAYS).toBe(14);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/verify/grant.test.js`
Expected: FAIL — `normalizeGrantKind` is not exported.

- [ ] **Step 4: Implement the grant helpers**

Append to `src/verify/grant.js`:

```js
/**
 * A grant's kind decides which ROUTE its token opens, and each token has
 * exactly one meaning: a preview token opens only /verificacion/p/, a
 * counterparty token only /verificacion/g/. Mixing them would let a link issued
 * to a company for a look at its own badge also address the attestation record.
 *
 * SQLite cannot add a CHECK via ALTER TABLE, so this is the enforcement.
 */
export const GRANT_KINDS = ['counterparty', 'preview'];

export const DEFAULT_TTL_DAYS = 90;
// Short on purpose: a preview is shown while a decision is being made, not
// retained. Revisit if the first pilot companies find it tight.
export const PREVIEW_TTL_DAYS = 14;

// null means INVALID (the caller should reject); absent means the default.
export function normalizeGrantKind(raw) {
  if (raw === undefined || raw === null || raw === '') return 'counterparty';
  return GRANT_KINDS.includes(raw) ? raw : null;
}

export const grantPath = (kind, token) =>
  `/verificacion/${kind === 'preview' ? 'p' : 'g'}/${token}`;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/verify/grant.test.js`
Expected: PASS.

- [ ] **Step 6: Issue preview grants from the admin endpoint**

In `functions/api/verify/admin/grant.js`:

Replace the import block and the TTL constants:

```js
import { newToken, tokenHash } from '../../../../src/verify/ids.js';
import {
  normalizeGrantKind, grantPath, GRANT_KINDS, DEFAULT_TTL_DAYS, PREVIEW_TTL_DAYS,
} from '../../../../src/verify/grant.js';
import { requireAdmin, jsonResponse, batchWithAudit } from '../_db.js';

const MIN_TTL_DAYS = 1;
const MAX_TTL_DAYS = 365;
```

(The local `const DEFAULT_TTL_DAYS = 90;` is removed — it now comes from `grant.js`, so the endpoint and the tests cannot drift apart.)

After the `not_publishable` check and before `const token = newToken();`, insert:

```js
  const kind = normalizeGrantKind(body.kind);
  if (kind === null) {
    return jsonResponse({ ok: false, error: 'invalid_kind', allowed: GRANT_KINDS }, 400);
  }
```

Change the ttl default line from `const ttlDays = body.ttl_days === undefined ? DEFAULT_TTL_DAYS : body.ttl_days;` to:

```js
  const ttlDays = body.ttl_days === undefined
    ? (kind === 'preview' ? PREVIEW_TTL_DAYS : DEFAULT_TTL_DAYS)
    : body.ttl_days;
```

Change the INSERT to carry the kind:

```js
    env.VERIFY_DB.prepare(
      `INSERT INTO view_grants (token_hash, attestation_id, label, issued_by, expires_at, kind)
       VALUES (?,?,?,'admin',?,?)`).bind(hash, attestationId, label, expiresAt, kind),
```

Change the audit detail to record it:

```js
    detail: JSON.stringify({ label, expires_at: expiresAt, kind }), public_summary: null,
```

Replace the three URL lines at the end with:

```js
  const base = `https://mapasocietario.es${grantPath(kind, token)}`;
  return jsonResponse({
    ok: true, token_hash: hash, expires_at: expiresAt, kind,
    url: base,
    // The stated audience is a foreign professional, so the English rendering
    // needs a reachable address. There is no /en/ grant route, so language is a
    // query parameter on the same resource.
    url_en: `${base}?lang=en`,
    local_url: `http://localhost:5173${grantPath(kind, token)}`,
  });
```

- [ ] **Step 7: Make the attestation route refuse a preview token**

In `functions/verificacion/g/[token].js`, change the grant validity check from `if (grantState(grant) !== 'valid') return notFound();` to:

```js
  // A preview token addresses /verificacion/p/ and nothing else. Each token has
  // exactly one meaning, so a link issued for a badge preview can never also
  // open the attestation record.
  if (grantState(grant) !== 'valid' || grant.kind === 'preview') return notFound();
```

- [ ] **Step 8: Apply the migration locally and run the suite**

```bash
npx wrangler d1 execute mapasocietario-verify --local --file=migrations/0004_preview_grants.sql
npm test
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add migrations/0004_preview_grants.sql src/verify/grant.js src/verify/grant.test.js functions/api/verify/admin/grant.js "functions/verificacion/g/[token].js"
git -c commit.gpgsign=false commit -m "feat(verify): grants carry a kind, and preview grants get their own route

A preview token opens /verificacion/p/ and nothing else; a counterparty
token opens /verificacion/g/ and nothing else. Existing rows default to
counterparty, so no grant changes meaning.

SQLite cannot add a CHECK via ALTER TABLE, so normalizeGrantKind is the
enforcement and it is tested."
```

---

### Task 5: `handleCompany` can render with an injected attestation, privately

**Files:**
- Create: `functions/empresa/_page_headers.js`
- Create: `functions/empresa/_page_headers.test.js`
- Modify: `functions/empresa/_lib.js:2358` (signature), `:2508` (attestation), `:2492` (noindex), and the response headers below it

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `companyPageHeaders({ noindex, privateResponse })` from `functions/empresa/_page_headers.js`, returning a plain headers object.
  - `handleCompany(ctx, lang, options)` where `options` is `{ attestationOverride?: object|null, privateResponse?: boolean }`. Task 6 calls this.

**Why a separate headers module:** `_lib.js` is past 2,700 lines and cannot be unit-tested without heavy mocking. Extracting the header decision gives the one new behaviour a real test, and it follows the existing `_slug.js` / `_page_href.js` pattern. Extracting anything more from `_lib.js` is out of scope.

- [ ] **Step 1: Write the failing test**

Create `functions/empresa/_page_headers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { companyPageHeaders } from './_page_headers.js';

describe('companyPageHeaders', () => {
  it('lets an indexable page sit in the shared cache for an hour', () => {
    const h = companyPageHeaders({});
    expect(h['cache-control']).toBe(
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    expect(h['x-robots-tag']).toBeUndefined();
  });

  it('shortens the shared cache for a noindex page', () => {
    expect(companyPageHeaders({ noindex: true })['cache-control'])
      .toBe('public, max-age=0, s-maxage=600');
  });

  it('never lets a private response reach a shared cache', () => {
    const h = companyPageHeaders({ privateResponse: true });
    expect(h['cache-control']).toBe('private, no-store');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['x-robots-tag']).toBe('noindex, nofollow, noarchive');
  });

  it('keeps a private response private even when noindex is false', () => {
    expect(companyPageHeaders({ noindex: false, privateResponse: true })['cache-control'])
      .toBe('private, no-store');
  });

  it('always sets the content type', () => {
    for (const opts of [{}, { noindex: true }, { privateResponse: true }]) {
      expect(companyPageHeaders(opts)['content-type']).toBe('text/html; charset=utf-8');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run functions/empresa/_page_headers.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the headers module**

Create `functions/empresa/_page_headers.js`:

```js
/**
 * Response headers for a rendered company page.
 *
 * Extracted from _lib.js so the one case that must never be got wrong has a
 * test: a private response (a badge preview) carries a token-bearing address
 * and MUST NOT reach a shared cache, or a badge that is not public yet would be
 * served to whoever asked next.
 *
 * The `_` prefix means Cloudflare Pages does not route this file.
 */

// One hour, not one day. The registry publishes daily and the officer tables
// are rendered from it: a 24h edge cache could keep serving a board that
// changed this morning. stale-while-revalidate is kept for origin trouble but
// bounded to a day, so a rarely-visited page cannot serve a week-old board.
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const NOINDEX_CACHE = 'public, max-age=0, s-maxage=600';

export function companyPageHeaders({ noindex = false, privateResponse = false } = {}) {
  if (privateResponse) {
    return {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    };
  }
  return {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': noindex ? NOINDEX_CACHE : PUBLIC_CACHE,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run functions/empresa/_page_headers.test.js`
Expected: PASS.

- [ ] **Step 5: Wire it into `handleCompany`**

In `functions/empresa/_lib.js`:

Add to the imports near the top, beside the other `./_` imports:

```js
import { companyPageHeaders } from './_page_headers.js';
```

Change the signature at line 2358 to:

```js
export async function handleCompany({ params, env, waitUntil }, lang = 'es', options = {}) {
```

Change the `noindex` declaration (currently `const noindex = isFallback || staleSlug;`) to:

```js
  // A private response is a preview: never indexable, whatever the slug resolved to.
  const noindex = isFallback || staleSlug || Boolean(options.privateResponse);
```

Change the attestation read (currently `const attestation = await liveAttestationFor(env, graphGroupKey(company, seed));`) to:

```js
    // An override is a badge preview: the caller has already validated a preview
    // grant for this subject, so isBadgeVisible() is bypassed BY THE CALLER, not
    // relaxed here. The public gate keeps exactly one meaning.
    const attestation = options.attestationOverride
      || await liveAttestationFor(env, graphGroupKey(company, seed));
```

Replace the whole `headers: { ... }` object of the 200 response with:

```js
      headers: companyPageHeaders({ noindex, privateResponse: options.privateResponse }),
```

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add functions/empresa/_page_headers.js functions/empresa/_page_headers.test.js functions/empresa/_lib.js
git -c commit.gpgsign=false commit -m "feat(empresa): handleCompany can render with an injected attestation, privately

Extracts the response headers so the case that must never be wrong has a
test: a preview carries a token-bearing address and must not reach a
shared cache.

isBadgeVisible is untouched. The caller validates the preview grant and
passes the attestation in, so the public gate keeps one meaning."
```

---

### Task 6: The preview route

**Files:**
- Create: `src/verify/preview.js`
- Create: `src/verify/preview.test.js`
- Create: `functions/verificacion/p/[token].js`

**Interfaces:**
- Consumes: `grantState`, `normalizeGrantKind` (Task 4); `handleCompany(ctx, lang, options)` (Task 5); `publicProjection`, `PUBLIC_REVIEWER` (Task 1); `nameToSlug` from `functions/empresa/_slug.js`; `tokenHash` from `src/verify/ids.js`.
- Produces, from `src/verify/preview.js`: `previewBanner(lang)`, `insertPreviewBanner(html, lang)`, `previewGrantAllows(grant, attestation, nowMs)` and `PREVIEWABLE_STATUSES`.

**Why `previewGrantAllows` is a separate pure function:** the spec requires that unknown, expired, revoked, wrong-kind and not-publishable all return the *same* 404. That rule cannot be tested through the route without stubbing D1 and `handleCompany`, so it lives in a function vitest can reach — the same split the rest of `src/verify/` already uses.

**Known limitation to preserve:** the slug is derived from `subjects.display_name` via `nameToSlug`. If a company has been renamed since its subject row was created, the derived slug will not resolve and the preview lands on the fallback page. The operator sees the URL in the console response and can click it before sending, so a bad link is caught immediately. Do not add a slug lookup to fix this speculatively.

- [ ] **Step 1: Write the failing tests**

Create `src/verify/preview.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  previewBanner, insertPreviewBanner, previewGrantAllows, PREVIEWABLE_STATUSES,
} from './preview.js';

describe('previewBanner', () => {
  it('says plainly that the badge is not public yet, in Spanish', () => {
    expect(previewBanner('es')).toContain('todavía no es pública');
  });
  it('says the same in English', () => {
    expect(previewBanner('en')).toContain('not public yet');
  });
  it('falls back to Spanish for an unknown language', () => {
    expect(previewBanner('fr')).toBe(previewBanner('es'));
  });
});

describe('previewGrantAllows', () => {
  const now = Date.parse('2026-09-10T00:00:00Z');
  const grant = (o = {}) => ({ kind: 'preview', expires_at: '2026-09-20T00:00:00Z',
                               revoked_at: null, ...o });
  const att = (status = 'live') => ({ status });

  it('allows a valid preview grant on a live attestation', () => {
    expect(previewGrantAllows(grant(), att('live'), now)).toBe(true);
  });
  it('allows an outdated attestation: the company should see the downgrade too', () => {
    expect(previewGrantAllows(grant(), att('outdated'), now)).toBe(true);
  });
  it('refuses a missing grant', () => {
    expect(previewGrantAllows(null, att(), now)).toBe(false);
  });
  it('refuses a revoked grant', () => {
    expect(previewGrantAllows(grant({ revoked_at: '2026-09-09T00:00:00Z' }), att(), now)).toBe(false);
  });
  it('refuses an expired grant', () => {
    expect(previewGrantAllows(grant({ expires_at: '2026-09-09T00:00:00Z' }), att(), now)).toBe(false);
  });
  it('refuses a counterparty grant: each token has exactly one meaning', () => {
    expect(previewGrantAllows(grant({ kind: 'counterparty' }), att(), now)).toBe(false);
  });
  it('refuses a missing attestation', () => {
    expect(previewGrantAllows(grant(), null, now)).toBe(false);
  });
  it('refuses a status that renders no badge, so nobody previews what they cannot get', () => {
    for (const status of ['pending_review', 'rejected', 'under_review',
                          'disputed', 'expired', 'revoked', 'superseded']) {
      expect(previewGrantAllows(grant(), att(status), now)).toBe(false);
    }
  });
});

describe('insertPreviewBanner', () => {
  it('puts the banner immediately after the opening body tag', () => {
    const out = insertPreviewBanner('<html><body><h1>ACME</h1></body></html>', 'es');
    expect(out.indexOf('vp-banner')).toBeLessThan(out.indexOf('<h1>ACME</h1>'));
  });

  it('handles a body tag carrying attributes', () => {
    const out = insertPreviewBanner('<body class="x"><h1>A</h1></body>', 'es');
    expect(out).toContain('vp-banner');
    expect(out.indexOf('vp-banner')).toBeLessThan(out.indexOf('<h1>A</h1>'));
  });

  it('prepends rather than dropping the banner when there is no body tag', () => {
    const out = insertPreviewBanner('<h1>A</h1>', 'es');
    expect(out.startsWith('<')).toBe(true);
    expect(out).toContain('vp-banner');
    expect(out).toContain('<h1>A</h1>');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/verify/preview.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the banner**

Create `src/verify/preview.js`:

```js
/**
 * The preview banner.
 *
 * A screenshot of a preview must not be mistakable for the live page, so the
 * banner is non-dismissable and sits above everything. It is injected into the
 * rendered HTML rather than threaded through renderCompanyPage(), which already
 * takes eleven positional parameters: the banner is preview-only chrome, not
 * part of the page.
 */
import { grantState } from './grant.js';

const COPY = {
  es: {
    title: 'Vista previa',
    body: 'Así se verá la insignia en su página pública. Esta insignia todavía no es pública: solo usted, con este enlace, la está viendo.',
  },
  en: {
    title: 'Preview',
    body: 'This is how the badge will look on your public page. The badge is not public yet: only you, with this link, can see it.',
  },
};

export function previewBanner(lang = 'es') {
  const t = COPY[lang] || COPY.es;
  return `<div class="vp-banner" role="status" style="position:sticky;top:0;z-index:9999;`
    + `background:#b45309;color:#fff;padding:.7rem 1rem;font:600 14px/1.4 system-ui,sans-serif">`
    + `<strong>${t.title}</strong> — ${t.body}</div>`;
}

/**
 * Every condition that must produce a 404, in one place so it can be tested.
 * Unknown, expired, revoked, wrong kind and not-publishable are deliberately
 * indistinguishable to the caller: a distinct response would confirm which of
 * them was true, and therefore that the record exists.
 */
export const PREVIEWABLE_STATUSES = ['live', 'outdated'];

export function previewGrantAllows(grant, attestation, nowMs = Date.now()) {
  if (grantState(grant, nowMs) !== 'valid') return false;
  // A counterparty token addresses /verificacion/g/ and nothing else.
  if (grant.kind !== 'preview') return false;
  // Only these render a badge on a company page (see _attestation.js), so
  // previewing anything else would show a company a badge it will never get.
  return Boolean(attestation) && PREVIEWABLE_STATUSES.includes(attestation.status);
}

const BODY_OPEN = /<body\b[^>]*>/i;

export function insertPreviewBanner(html, lang = 'es') {
  const banner = previewBanner(lang);
  const match = html.match(BODY_OPEN);
  // No body tag means we were handed something unexpected. Prepending still
  // shows the banner, which is the property that matters: a preview must never
  // render silently as if it were the live page.
  if (!match) return banner + html;
  const at = match.index + match[0].length;
  return html.slice(0, at) + banner + html.slice(at);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/verify/preview.test.js`
Expected: PASS.

- [ ] **Step 5: Write the route**

Create `functions/verificacion/p/[token].js`:

```js
/**
 * GET /verificacion/p/<token> — a pilot company's own /empresa page, rendered
 * with its badge visible before the badge is public.
 *
 * Why a route of its own rather than /empresa/<slug>?preview=<token>: /empresa
 * pages carry s-maxage=3600, so putting a token on that path is one missed
 * header away from a shared cache holding a badge that is not public yet. Here
 * the token stays inside the /verificacion/* family, which is private, no-store
 * and noindex, and the public /empresa handler never learns preview tokens
 * exist.
 *
 * Every invalid state returns the SAME 404 as the attestation route: unknown,
 * expired, revoked, wrong kind, or an attestation that is not publishable.
 */
import { tokenHash } from '../../../src/verify/ids.js';
import { publicProjection } from '../../../src/verify/projection.js';
import { insertPreviewBanner, previewGrantAllows } from '../../../src/verify/preview.js';
import { nameToSlug } from '../../empresa/_slug.js';
import { handleCompany } from '../../empresa/_lib.js';
import { privateHeaders } from '../../api/verify/_db.js';

const NOT_FOUND_BODY = JSON.stringify({ ok: false, error: 'not_found' });
const notFound = () => new Response(NOT_FOUND_BODY, { status: 404, headers: privateHeaders() });

export async function onRequestGet(ctx) {
  const { request, params, env } = ctx;
  const url = new URL(request.url);
  const raw = String(params.token || '');
  if (!raw || !env.VERIFY_DB) return notFound();

  const grant = await env.VERIFY_DB
    .prepare('SELECT * FROM view_grants WHERE token_hash = ?')
    .bind(await tokenHash(raw)).first();

  // Both are read before deciding, because the guard needs both and every
  // failing condition must produce the SAME 404.
  const attestation = grant ? await env.VERIFY_DB
    .prepare(`SELECT a.*, s.display_name FROM attestations a
                JOIN subjects s ON s.subject_id = a.subject_id
               WHERE a.id = ?`).bind(grant.attestation_id).first() : null;

  if (!previewGrantAllows(grant, attestation)) return notFound();

  const { results: facts } = await env.VERIFY_DB
    .prepare('SELECT * FROM attestation_facts WHERE attestation_id = ? ORDER BY id')
    .bind(attestation.id).all();

  const { results: history } = await env.VERIFY_DB
    .prepare(`SELECT seq, action, created_at, public_summary
                FROM audit_events
               WHERE attestation_id = ? AND public_summary IS NOT NULL
               ORDER BY seq`).bind(attestation.id).all();

  // Counts LINK ACCESSES, not viewers. Best-effort: a failed counter must never
  // break the read.
  try {
    await env.VERIFY_DB.prepare(
      `UPDATE view_grants SET access_count = access_count + 1, last_access_at = ?
        WHERE token_hash = ?`).bind(new Date().toISOString(), grant.token_hash).run();
  } catch { /* the preview matters more than the metric */ }

  const requested = (url.searchParams.get('lang') || '').toLowerCase();
  const lang = requested === 'en' ? 'en'
    : requested === 'es' ? 'es'
    : (request.headers.get('accept-language') || '').toLowerCase().startsWith('en') ? 'en'
    : 'es';

  // The slug is derived from the subject's display name. A company renamed
  // since its subject row was created will not resolve, and the preview lands
  // on the fallback page - which the operator sees when they open the link
  // themselves before sending it.
  const slug = nameToSlug(attestation.display_name);

  const response = await handleCompany(
    { params: { slug }, env, waitUntil: ctx.waitUntil }, lang,
    {
      attestationOverride: publicProjection(attestation, facts || [], history || []),
      privateResponse: true,
    },
  );

  const html = insertPreviewBanner(await response.text(), lang);
  return new Response(html, { status: response.status, headers: response.headers });
}
```

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/verify/preview.js src/verify/preview.test.js "functions/verificacion/p/[token].js"
git -c commit.gpgsign=false commit -m "feat(verify): a pilot company can preview its own badge

Its own route, not a query parameter on /empresa: those pages carry
s-maxage=3600, so a token there is one missed header away from a shared
cache holding a badge that is not public yet.

A preview grant renders only its own subject, only for a live or outdated
attestation, behind a non-dismissable banner, and every invalid state
returns the same 404."
```

---

### Task 7: Issue a preview link from the console

**Files:**
- Modify: `functions/admin/verificacion.js`

**Interfaces:**
- Consumes: `POST /api/verify/admin/grant` with `{ attestation_id, kind: 'preview', label }` (Task 4).
- Produces: nothing.

The console is a thin client over the JSON endpoints and holds no server-side auth of its own, so this is a button and a fetch — no new endpoint. Follow the file's existing conventions exactly: the outer template is a JS template literal inside a Function, so every nested backtick and `${` is already escaped as `\`` and `\${`.

- [ ] **Step 1: Add the preview button to each published attestation**

In `renderList`, find the `<div class="row">` holding the label input and the "Emitir enlace" button. Replace that whole `div` with:

```
      <div class="row">
        <input placeholder="etiqueta (p. ej. Banco X, onboarding)" id="lbl-\${esc(a.id)}">
        <button class="primary" onclick="issue('\${esc(a.id)}')">Emitir enlace</button>
        <button onclick="issue('\${esc(a.id)}','preview')">Vista previa (14 días)</button>
      </div>
```

Both buttons reuse the same label input: the label is an operator note either way.

- [ ] **Step 2: Teach `issue()` about the kind**

Replace the whole `issue` function with:

```js
async function issue(id, kind) {
  const r = await api('/api/verify/admin/grant', { method: 'POST',
    body: JSON.stringify({ attestation_id: id, label: $('lbl-' + id).value.trim(),
                           ...(kind ? { kind } : {}) }) });
  const preview = kind === 'preview';
  $('grantout').innerHTML = r.ok
    ? '<div class="card"><p><strong>'
      + (preview ? 'Vista previa emitida' : 'Enlace emitido')
      + ' — se muestra una sola vez.</strong></p>'
      + '<p>ES <code>' + esc(r.data.url) + '</code></p>'
      + '<p>EN <code>' + esc(r.data.url_en) + '</code></p>'
      + '<p class="muted">Caduca ' + esc(r.data.expires_at) + '.'
      + (preview ? ' Ábralo usted antes de enviarlo: la dirección se deriva del nombre '
                 + 'de la empresa, así que un cambio de denominación puede no resolver.' : '')
      + '</p></div>'
    : '<p class="bad">' + esc(r.data.error || r.status) + '</p>';
  if (r.ok) load();
}
window.issue = issue;
```

- [ ] **Step 3: Show the kind in the grants table**

`view_grants` now holds two kinds and the operator must be able to tell them apart. In `functions/api/verify/admin/attestations.js`, add `kind` to the grants `SELECT`:

```js
      `SELECT token_hash, label, kind, created_at, expires_at, revoked_at, access_count, last_access_at
         FROM view_grants WHERE attestation_id = ? ORDER BY created_at DESC`)
```

and to the mapped object:

```js
      grants: (grants || []).map((g) => ({
        token_hash: g.token_hash, label: g.label, kind: g.kind, created_at: g.created_at,
        expires_at: g.expires_at, revoked_at: g.revoked_at,
        access_count: g.access_count, last_access_at: g.last_access_at,
      })),
```

In `renderList`, change the grants table header row from `'<th>Etiqueta</th><th>Emitido</th><th>Accesos</th>'` to:

```
        '<table><thead><tr><th>Tipo</th><th>Etiqueta</th><th>Emitido</th><th>Accesos</th>' +
```

and prefix each row's cells by changing `"'<tr><td>' + esc(g.label || '—') + '</td><td>'"` to:

```js
          '<tr><td>' + (g.kind === 'preview' ? 'vista previa' : 'contraparte') +
          '</td><td>' + esc(g.label || '—') + '</td><td>' +
```

- [ ] **Step 4: Verify by hand**

```bash
npm run build && npx wrangler pages dev dist --port 5173
```

Open `http://localhost:5173/admin/verificacion`, paste the admin token, and confirm all four:
1. The preview button appears on a published attestation and returns a `/verificacion/p/<token>` URL.
2. Opening that URL shows the company page with the orange banner and the badge.
3. Putting that same token on `/verificacion/g/<token>` returns 404.
4. The grants table labels the new row "vista previa".

- [ ] **Step 5: Commit**

```bash
git add functions/admin/verificacion.js functions/api/verify/admin/attestations.js
git -c commit.gpgsign=false commit -m "feat(verify): issue a badge preview link from the console

The grants table now names the kind, because two kinds of link that open
different routes must not look identical in the operator's list.

The response tells the operator to open a preview themselves first: its
address is derived from the company name, so a renamed company will not
resolve."
```

---

### Task 8: The check history, in the console

**Files:**
- Modify: `src/verify/reconcile.js`
- Modify: `src/verify/reconcile.test.js`
- Create: `functions/api/verify/admin/checks.js`
- Modify: `functions/admin/verificacion.js`

**Interfaces:**
- Consumes: `reconciliation_runs` (Task 2); the console's `renderList` (Task 7).
- Produces: `summariseRuns(rows)` from `src/verify/reconcile.js`, returning `{ total, checked, failed, consistent, first, last }`.

**A table now, not a third timeline lane.** Spec §4.3 describes the check record as a third lane on `src/verify/timeline.js`. A table is the first increment: on day one there is nothing to draw, and the operator's question — *when did we check, and what did it say* — is answered better by dates than by pixels. Extending the SVG is deferred until there is enough history to be worth drawing.

**Internal only.** A public daily-check lane would invite the reading that each check independently confirmed the statement, which §4.1 of the pilot design forbids.

- [ ] **Step 1: Write the failing test**

Append to `src/verify/reconcile.test.js`:

```js
describe('summariseRuns', () => {
  // Rows arrive newest-first, as the endpoint orders them.
  const rows = [
    { checked_at: '2026-09-12T04:00:00Z', source_failed: 0,
      outcomes: '{"address":"consistent"}' },
    { checked_at: '2026-09-11T04:00:00Z', source_failed: 1, outcomes: '{}' },
    { checked_at: '2026-09-10T04:00:00Z', source_failed: 0,
      outcomes: '{"address":"consistent","officers":"superseded_by_later_event"}' },
  ];

  it('counts checks, failures and fully consistent days separately', () => {
    expect(summariseRuns(rows)).toEqual({
      total: 3, checked: 2, failed: 1, consistent: 1,
      first: '2026-09-10T04:00:00Z', last: '2026-09-12T04:00:00Z',
    });
  });

  it('never counts a failed read as consistent', () => {
    expect(summariseRuns([{ checked_at: 'x', source_failed: 1, outcomes: '{}' }]).consistent)
      .toBe(0);
  });

  it('does not count an empty outcome map as consistent', () => {
    expect(summariseRuns([{ checked_at: 'x', source_failed: 0, outcomes: '{}' }]).consistent)
      .toBe(0);
  });

  it('survives an unparseable outcomes column rather than throwing', () => {
    expect(summariseRuns([{ checked_at: 'x', source_failed: 0, outcomes: 'not json' }]).consistent)
      .toBe(0);
  });

  it('is all zeroes and nulls for no rows', () => {
    expect(summariseRuns([])).toEqual({
      total: 0, checked: 0, failed: 0, consistent: 0, first: null, last: null });
  });
});
```

Add `summariseRuns` to the import at the top of that file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/verify/reconcile.test.js`
Expected: FAIL — `summariseRuns is not a function`.

- [ ] **Step 3: Implement it**

Append to `src/verify/reconcile.js`:

```js
/**
 * A one-line summary of a run of checks, for the operator.
 *
 * "Consistent" means every fact came back consistent on a day the upstream read
 * SUCCEEDED. A failed read and an empty outcome map both count as neither
 * consistent nor contradicted: the whole point of storing source_failed is that
 * "we could not check" must never read as "we checked and all was well".
 *
 * Rows arrive newest-first, as the admin endpoint orders them.
 */
export function summariseRuns(rows) {
  const runs = rows || [];
  let checked = 0;
  let consistent = 0;
  for (const r of runs) {
    if (r.source_failed) continue;
    checked++;
    let outcomes;
    try { outcomes = JSON.parse(r.outcomes || '{}'); } catch { continue; }
    const values = Object.values(outcomes || {});
    if (values.length > 0 && values.every((v) => v === 'consistent')) consistent++;
  }
  return {
    total: runs.length,
    checked,
    failed: runs.length - checked,
    consistent,
    first: runs.length ? runs[runs.length - 1].checked_at : null,
    last: runs.length ? runs[0].checked_at : null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/verify/reconcile.test.js`
Expected: PASS.

- [ ] **Step 5: Add the admin endpoint**

Create `functions/api/verify/admin/checks.js`:

```js
/**
 * GET /api/verify/admin/checks?attestation_id=&limit= — the continuity record.
 *
 * INTERNAL ONLY, and it must stay that way. A public daily-check lane would
 * invite the reading that each check independently confirmed the statement,
 * which section 4.1 of the pilot design forbids: a check compares a declaration
 * against the registry; it does not establish that the declaration is true.
 */
import { requireAdmin, jsonResponse } from '../_db.js';

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 400;

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const id = (url.searchParams.get('attestation_id') || '').trim();
  if (!id) return jsonResponse({ ok: false, error: 'attestation_id_required' }, 400);

  const raw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(raw) && raw >= 1 && raw <= MAX_LIMIT
    ? Math.floor(raw) : DEFAULT_LIMIT;

  const { results } = await env.VERIFY_DB.prepare(
    `SELECT checked_at, source_failed, outcomes, status_before, status_after
       FROM reconciliation_runs
      WHERE attestation_id = ?
      ORDER BY checked_at DESC
      LIMIT ?`).bind(id, limit).all();

  return jsonResponse({ ok: true, count: (results || []).length, items: results || [] });
}
```

- [ ] **Step 6: Add a failing auth test**

Create `functions/api/verify/admin/checks.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { onRequestGet } from './checks.js';

const req = (url = 'https://x/api/verify/admin/checks?attestation_id=att_1', token = null) =>
  new Request(url, token ? { headers: { authorization: 'Bearer ' + token } } : undefined);

describe('GET /api/verify/admin/checks', () => {
  it('refuses without the admin token', async () => {
    const r = await onRequestGet({ request: req(), env: { VERIFY_ADMIN_TOKEN: 'secret' } });
    expect(r.status).toBe(401);
  });

  it('refuses a wrong token', async () => {
    const r = await onRequestGet({
      request: req(undefined, 'wrongwr'), env: { VERIFY_ADMIN_TOKEN: 'secret' } });
    expect(r.status).toBe(401);
  });

  it('requires an attestation_id', async () => {
    const r = await onRequestGet({
      request: req('https://x/api/verify/admin/checks', 'secret'),
      env: { VERIFY_ADMIN_TOKEN: 'secret' } });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('attestation_id_required');
  });
});
```

- [ ] **Step 7: Run it**

Run: `npx vitest run functions/api/verify/admin/checks.test.js`
Expected: PASS.

- [ ] **Step 8: Render it in the console**

In `functions/admin/verificacion.js`, inside `renderList`, add this immediately after the `<p class="muted"><code>\${esc(a.id)}</code></p>` line:

```
      <div class="row">
        <button onclick="checks('\${esc(a.id)}')">Comprobaciones</button>
      </div>
      <div id="checks-\${esc(a.id)}"></div>
```

Then add this function beside `issue`:

```js
async function checks(id) {
  const box = $('checks-' + id);
  box.innerHTML = '<p class="muted">Cargando…</p>';
  const r = await api('/api/verify/admin/checks?attestation_id=' + encodeURIComponent(id));
  if (!r.ok) { box.innerHTML = '<p class="bad">' + esc(r.data.error || r.status) + '</p>'; return; }
  const items = r.data.items || [];
  if (!items.length) {
    box.innerHTML = '<p class="muted">Sin comprobaciones registradas todavía. '
      + 'El registro empieza el día en que se despliega, no puede reconstruirse hacia atrás.</p>';
    return;
  }
  box.innerHTML = '<table><thead><tr><th>Fecha</th><th>Resultado</th><th>Estado</th>'
    + '</tr></thead><tbody>' + items.map((c) =>
      '<tr><td>' + esc((c.checked_at || '').slice(0, 10)) + '</td><td>'
      + (c.source_failed
          ? '<span class="bad">no se pudo comprobar</span>'
          : esc(c.outcomes))
      + '</td><td>' + esc(c.status_before === c.status_after
          ? c.status_after : c.status_before + ' → ' + c.status_after)
      + '</td></tr>').join('') + '</tbody></table>';
}
window.checks = checks;
```

- [ ] **Step 9: Run the full suite and commit**

```bash
npm test
git add src/verify/reconcile.js src/verify/reconcile.test.js functions/api/verify/admin/checks.js functions/api/verify/admin/checks.test.js functions/admin/verificacion.js
git -c commit.gpgsign=false commit -m "feat(verify): show the check history in the console

Internal only: a public daily-check lane would invite the reading that
each check independently confirmed the statement, which section 4.1
forbids.

A table rather than a third timeline lane, for now. On day one there is
nothing to draw, and the operator's question is when we checked and what
it said, which dates answer better than pixels."
```

---

## Deployment

Not part of any task — run once, after all tasks are reviewed and merged.

- [ ] Apply both migrations to the remote database:

```bash
npx wrangler d1 execute mapasocietario-verify --remote --file=migrations/0003_reconciliation_runs.sql
npx wrangler d1 execute mapasocietario-verify --remote --file=migrations/0004_preview_grants.sql
```

- [ ] Deploy the reconciler Worker (it deploys manually, not through CI):

```bash
cd workers/verification-reconciler && npx wrangler deploy
```

- [ ] Let the Pages deploy run through its GitHub Action — never `wrangler pages deploy` from a laptop.
- [ ] Confirm the next daily run's mail reports a purge count and that `reconciliation_runs` has one row per current attestation.
