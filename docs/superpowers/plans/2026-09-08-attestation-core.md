# Attestation Core (Plan A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce attestation #1 end to end — invite, draft, edit, accept, review, publish — readable only through a grant link, for Nürnberg Consulting SL.

**Architecture:** All decision logic is pure and lives in `src/verify/` where vitest can reach it. Pages Functions under `functions/api/verify/` are thin adapters over D1, R2 and the BORME API. Evidence splits across two R2 prefixes (sealed, locked; personal, unlocked). Single-acceptance is enforced by a `UNIQUE` constraint, never by inspecting a row count.

**Tech Stack:** Cloudflare Pages Functions, D1 (SQLite), R2, WebCrypto (`crypto.subtle`), React 19 + MUI for the acceptance page, vitest for pure logic, `node --test` for schema constraints.

**Spec:** `docs/superpowers/specs/2026-09-08-company-attestation-pilot-design.md`

**Out of scope for this plan (Plan B):** the reconciliation cron worker, the `/empresa` badge migration off `_confirmations.js`, the two-lane timeline, and the admin UI beyond the two JSON endpoints. None are needed to produce attestation #1.

## Global Constraints

Copied verbatim from the spec. Every task inherits these.

- **Never write "identity verified" or an unqualified "authority verified"** in any user-facing string. The permitted form is: *the representative named below holds the registry-recorded position stated, and their authority to make this statement was reviewed on `<date>` by `<reviewer>`* (§4.1).
- **Never write "immutable"** about the audit trail. The permitted form is *tamper-evident, with daily external checkpoints* (§4.2).
- **Never assert accuracy.** Use *"accepted on `<date>` and consistent with the registry evidence checked at that time"*, never *"was accurate when made"* (§8).
- **Never say "as of right now"** about status. Display `last_verified_at`, the last *successful* check (§8).
- **VIES changes no status, ever.** It tests intra-EU trade registration, not NIF validity (§5.4).
- **`reviewer` IS published**; the redaction set is `claimants.email`, `identification_note`, `audit_events.detail`, evidence keys and grant tokens (§8).
- Every `/verificacion/*` response: `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`. Token-bearing URLs never reach analytics (§7).
- An unknown, expired or revoked grant returns **404, never 403** (§7).
- Any call to `api.ncdata.eu` from a batch context sends `X-Internal-Key` (§6).
- Joint administrators (`mancomunados`) are refused at the invite endpoint (§4.3).
- Files stay under ~400 lines; pure logic never imports from `functions/`.

## File Structure

| File | Responsibility |
|---|---|
| `migrations/0002_verification.sql` | Create the eight `VERIFY_DB` tables and their indexes |
| `test/verify-schema.test.mjs` | Prove the constraints actually fire against local D1 |
| `src/verify/hash.js` | Canonical JSON + `sha256Hex` |
| `src/verify/hash.test.js` | Determinism, key-order independence |
| `src/verify/chain.js` | Audit-chain entry construction and verification |
| `src/verify/chain.test.js` | Append, verify, detect a tampered middle row |
| `src/verify/seat.js` | Officer-seat matching (replaces `nameIsOfficer`) |
| `src/verify/seat.test.js` | Rejects subsets, accepts rotations, handles accents |
| `src/verify/assertion.js` | Build an assertion from a registry read; build an acceptance receipt |
| `src/verify/assertion.test.js` | Hash stability across acceptance; the `valid_for_days` rule |
| `src/verify/projection.js` | The public projection — the only thing a reader ever sees |
| `src/verify/projection.test.js` | Property test: no private field can escape |
| `src/verify/ids.js` | Unguessable public ids and tokens |
| `functions/api/verify/_db.js` | Shared D1 helpers and the `X-Internal-Key` registry fetch |
| `functions/api/verify/invite.js` | `POST` — operator issues an invitation |
| `functions/api/verify/session.js` | `GET` — build and persist the first draft |
| `functions/api/verify/draft.js` | `POST` — persist an edited draft |
| `functions/api/verify/submit.js` | `POST` — evidence to R2, then one D1 batch |
| `functions/api/verify/admin/queue.js` | `GET` — pending review, as a diff |
| `functions/api/verify/admin/decide.js` | `POST` — approve or reject |
| `functions/verificacion/g/[token].js` | Grant-gated read, HTML and JSON |
| `src/components/VerificationConfirmPage.jsx` | The representative's acceptance screen |

---

### Task 1: Schema, with constraints proven to fire

**Files:**
- Create: `migrations/0002_verification.sql`
- Create: `test/verify-schema.test.mjs`
- Modify: `wrangler.toml`

**Interfaces:**
- Consumes: nothing.
- Produces: the `VERIFY_DB` binding and the eight tables every later task writes to.

- [ ] **Step 1: Write the failing test**

`test/verify-schema.test.mjs` — runs against local D1 through wrangler, because the guarantees under test are SQL constraints, not JavaScript.

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const DB = 'mapasocietario-verify';

function sql(command) {
  return execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, '--local', '--command', command],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

function expectFailure(command, fragment) {
  try {
    sql(command);
    assert.fail(`expected failure containing "${fragment}"`);
  } catch (e) {
    const output = `${e.stdout || ''}${e.stderr || ''}${e.message}`;
    assert.match(output, new RegExp(fragment, 'i'));
  }
}

test('setup: a subject and an invitation exist', () => {
  sql(`INSERT INTO subjects (subject_id, display_name) VALUES ('s1','Test SL')`);
  sql(`INSERT INTO claimants (id, subject_id, declared_name, email, claimed_role, email_domain_basis)
       VALUES ('c1','s1','A B','a@b.es','Administrador único','website')`);
  sql(`INSERT INTO invitations (id, token_hash, claimant_id, subject_id, expires_at)
       VALUES ('i1','h1','c1','s1','2030-01-01')`);
  sql(`INSERT INTO draft_assertions (hash, invitation_id, subject_id, canonical_json, registry_snapshot)
       VALUES ('d1','i1','s1','{}','{}')`);
});

test('a second attestation for the same invitation is refused', () => {
  const row = (id) => `INSERT INTO attestations
    (id, subject_id, claimant_id, invitation_id, method, status, representation_basis,
     identity_snapshot, assertion_hash, registry_snapshot, sealed_key, sealed_hash,
     accepted_at, expires_at)
    VALUES ('${id}','s1','c1','i1','email-confirmed','pending_review','sole_admin',
     '{}','d1','{}','k','kh','2026-09-08','2027-03-07')`;
  sql(row('a1'));
  expectFailure(row('a2'), 'UNIQUE constraint failed');
});

test('two current attestations for one subject are refused', () => {
  sql(`UPDATE attestations SET status='live' WHERE id='a1'`);
  sql(`INSERT INTO invitations (id, token_hash, claimant_id, subject_id, expires_at)
       VALUES ('i2','h2','c1','s1','2030-01-01')`);
  expectFailure(
    `INSERT INTO attestations
      (id, subject_id, claimant_id, invitation_id, method, status, representation_basis,
       identity_snapshot, assertion_hash, registry_snapshot, sealed_key, sealed_hash,
       accepted_at, expires_at)
      VALUES ('a3','s1','c1','i2','email-confirmed','outdated','sole_admin',
       '{}','d1','{}','k','kh','2026-09-08','2027-03-07')`,
    'UNIQUE constraint failed',
  );
});

test('mancomunados is not an accepted representation basis', () => {
  expectFailure(
    `UPDATE claimants SET representation_basis='joint_admin_pair' WHERE id='c1'`,
    'CHECK constraint failed',
  );
});

test('the audit chain cannot fork on the same previous hash', () => {
  sql(`INSERT INTO audit_events (action, actor, prev_hash, hash)
       VALUES ('created','operator','0','h_a')`);
  expectFailure(
    `INSERT INTO audit_events (action, actor, prev_hash, hash)
     VALUES ('created','operator','0','h_b')`,
    'UNIQUE constraint failed',
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx wrangler d1 create mapasocietario-verify
node --test test/verify-schema.test.mjs
```

Expected: every test fails — `no such table: subjects`.

- [ ] **Step 3: Write the migration**

`migrations/0002_verification.sql` — transcribe §5.1–§5.6 of the spec exactly. The two constraints the tests exercise are the load-bearing ones:

```sql
CREATE TABLE subjects (
  subject_id   TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subject_identifiers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id TEXT NOT NULL REFERENCES subjects(subject_id),
  kind       TEXT NOT NULL CHECK (kind IN ('group_key','nif','hoja','slug')),
  value      TEXT NOT NULL,
  valid_from TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_to   TEXT,
  note       TEXT
);
CREATE INDEX idx_subject_identifiers_lookup
  ON subject_identifiers(kind, value, valid_to);

CREATE TABLE claimants (
  id                   TEXT PRIMARY KEY,
  subject_id           TEXT NOT NULL REFERENCES subjects(subject_id),
  declared_name        TEXT NOT NULL,
  email                TEXT NOT NULL,
  claimed_role         TEXT NOT NULL,
  representation_basis TEXT CHECK (representation_basis IN
                         ('sole_admin','joint_several_admin',
                          'delegated_board_member','apoderado')),
  identification_note  TEXT,
  email_domain_basis   TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'attester'
                         CHECK (role IN ('attester','preparer')),
  created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invitations (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  claimant_id TEXT NOT NULL REFERENCES claimants(id),
  subject_id  TEXT NOT NULL REFERENCES subjects(subject_id),
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE draft_assertions (
  hash              TEXT PRIMARY KEY,
  invitation_id     TEXT NOT NULL REFERENCES invitations(id),
  subject_id        TEXT NOT NULL REFERENCES subjects(subject_id),
  canonical_json    TEXT NOT NULL,
  registry_snapshot TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  superseded_by     TEXT REFERENCES draft_assertions(hash)
);

CREATE TABLE attestations (
  id                       TEXT PRIMARY KEY,
  subject_id               TEXT NOT NULL REFERENCES subjects(subject_id),
  claimant_id              TEXT NOT NULL REFERENCES claimants(id),
  invitation_id            TEXT NOT NULL UNIQUE REFERENCES invitations(id),
  method                   TEXT NOT NULL CHECK (method IN ('email-confirmed','qes-signed')),
  status                   TEXT NOT NULL CHECK (status IN
                             ('pending_review','rejected','live','outdated',
                              'under_review','disputed','expired','revoked','superseded')),
  representation_basis     TEXT NOT NULL,
  seat_officer_name        TEXT,
  seat_position            TEXT,
  seat_appointed_date      TEXT,
  identity_snapshot        TEXT NOT NULL,
  assertion_hash           TEXT NOT NULL REFERENCES draft_assertions(hash),
  registry_snapshot        TEXT NOT NULL,
  sealed_key               TEXT NOT NULL,
  sealed_hash              TEXT NOT NULL,
  personal_key             TEXT,
  personal_hash            TEXT,
  accepted_at              TEXT NOT NULL,
  expires_at               TEXT NOT NULL,
  last_verified_at         TEXT,
  consecutive_inconclusive INTEGER NOT NULL DEFAULT 0,
  approved_at              TEXT,
  reviewer                 TEXT,
  reviewed_at              TEXT,
  decision_note            TEXT,
  status_reason            TEXT,
  superseded_by            TEXT REFERENCES attestations(id)
);

CREATE UNIQUE INDEX idx_attestations_live
  ON attestations(subject_id) WHERE status = 'live';

CREATE UNIQUE INDEX idx_attestations_current
  ON attestations(subject_id)
  WHERE status IN ('live','outdated','under_review','disputed','expired');

CREATE TABLE attestation_facts (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  attestation_id          TEXT NOT NULL REFERENCES attestations(id),
  fact_key                TEXT NOT NULL CHECK (fact_key IN
                            ('representation','officers','address','insolvency',
                             'nif','vat_intraeu','operational')),
  declared_status         TEXT NOT NULL CHECK (declared_status IN
                            ('current','none','corrected','not_applicable')),
  declared_value          TEXT,
  registry_value_at_issue TEXT,
  check_source            TEXT NOT NULL CHECK (check_source IN ('borme','vies','none')),
  last_checked_at         TEXT,
  last_check_outcome      TEXT CHECK (last_check_outcome IN
                            ('consistent','superseded_by_later_event',
                             'contradicted_at_issue','pending_publication','inconclusive'))
);

CREATE TABLE audit_events (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  attestation_id TEXT,
  subject_id     TEXT,
  action         TEXT NOT NULL,
  actor          TEXT NOT NULL,
  detail         TEXT,
  public_summary TEXT,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  prev_hash      TEXT NOT NULL,
  hash           TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_audit_events_prev_hash ON audit_events(prev_hash);

CREATE TABLE view_grants (
  token_hash     TEXT PRIMARY KEY,
  attestation_id TEXT NOT NULL REFERENCES attestations(id),
  label          TEXT,
  issued_by      TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     TEXT,
  revoked_at     TEXT,
  access_count   INTEGER NOT NULL DEFAULT 0,
  last_access_at TEXT
);

CREATE TABLE chain_anchors (
  day           TEXT PRIMARY KEY,
  head_seq      INTEGER NOT NULL,
  head_hash     TEXT NOT NULL,
  published_at  TEXT NOT NULL,
  dispatched_to TEXT
);
```

- [ ] **Step 4: Add the binding**

Append to `wrangler.toml`, alongside the existing `SEO_DB` block (paste the real `database_id` printed by `wrangler d1 create`):

```toml
[[d1_databases]]
binding = "VERIFY_DB"
database_name = "mapasocietario-verify"
database_id = "PASTE_FROM_WRANGLER_D1_CREATE"

[[r2_buckets]]
binding = "VERIFY_EVIDENCE"
bucket_name = "mapasocietario-verify-evidence"
```

- [ ] **Step 5: Apply and run the tests**

```bash
npx wrangler d1 execute mapasocietario-verify --local --file migrations/0002_verification.sql
node --test test/verify-schema.test.mjs
```

Expected: all five pass. If "a second attestation for the same invitation is refused" passes without the `UNIQUE` on `invitation_id`, the test is wrong — that constraint is the only thing standing between a replayed link and a duplicate attestation.

- [ ] **Step 6: Commit**

```bash
git add migrations/0002_verification.sql test/verify-schema.test.mjs wrangler.toml
git commit -m "feat(verify): schema with enforced single-acceptance and single-current invariants"
```

---

### Task 2: Canonical JSON and hashing

**Files:**
- Create: `src/verify/hash.js`, `src/verify/hash.test.js`

**Interfaces:**
- Produces: `canonicalJson(value): string`, `sha256Hex(text): Promise<string>`, `hashCanonical(value): Promise<string>`.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { canonicalJson, sha256Hex, hashCanonical } from './hash.js';

describe('canonicalJson', () => {
  it('is independent of key insertion order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('sorts nested keys too', () => {
    expect(canonicalJson({ x: { z: 1, y: 2 } })).toBe('{"x":{"y":2,"z":1}}');
  });

  it('preserves array order, which is meaningful', () => {
    expect(canonicalJson([2, 1])).toBe('[2,1]');
  });

  it('omits undefined but keeps null, which is a declared value', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe('sha256Hex', () => {
  it('matches the known digest of the empty string', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('hashCanonical', () => {
  it('gives one hash for two orderings of the same object', async () => {
    expect(await hashCanonical({ b: 1, a: 2 })).toBe(await hashCanonical({ a: 2, b: 1 }));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/hash.test.js`
Expected: FAIL — `Failed to resolve import "./hash.js"`.

- [ ] **Step 3: Implement**

```javascript
/**
 * Canonical serialisation and hashing for attestation assertions and audit
 * events. Determinism is the whole point: the same statement must produce the
 * same hash on any runtime, in any key order, or accept-by-hash breaks.
 * Pure — safe to import from both Pages Functions and the browser bundle.
 */

// Sorted-key JSON. Arrays keep their order (a list of facts is ordered data),
// objects do not (key order is an accident of construction).
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.keys(value)
    .sort()
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`);
  return `{${entries.join(',')}}`;
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const hashCanonical = (value) => sha256Hex(canonicalJson(value));
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/verify/hash.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/verify/hash.js src/verify/hash.test.js
git commit -m "feat(verify): deterministic canonical JSON and sha256"
```

---

### Task 3: The audit chain

**Files:**
- Create: `src/verify/chain.js`, `src/verify/chain.test.js`

**Interfaces:**
- Consumes: `canonicalJson`, `sha256Hex` from `src/verify/hash.js`.
- Produces: `GENESIS_HASH`, `buildAuditEvent(prevHash, event): Promise<{...event, prev_hash, hash}>`, `verifyChain(rows): Promise<{ok: boolean, brokenAtSeq: number|null}>`.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { GENESIS_HASH, buildAuditEvent, verifyChain } from './chain.js';

const base = { attestation_id: 'a1', subject_id: 's1', actor: 'operator', detail: null,
               public_summary: null, created_at: '2026-09-08T10:00:00Z' };

async function chainOf(actions) {
  const rows = [];
  let prev = GENESIS_HASH;
  for (const [i, action] of actions.entries()) {
    const row = await buildAuditEvent(prev, { ...base, action });
    rows.push({ ...row, seq: i + 1 });
    prev = row.hash;
  }
  return rows;
}

describe('buildAuditEvent', () => {
  it('links each event to the previous hash', async () => {
    const rows = await chainOf(['created', 'accepted']);
    expect(rows[0].prev_hash).toBe(GENESIS_HASH);
    expect(rows[1].prev_hash).toBe(rows[0].hash);
  });

  it('gives different hashes to different actions', async () => {
    const a = await buildAuditEvent(GENESIS_HASH, { ...base, action: 'created' });
    const b = await buildAuditEvent(GENESIS_HASH, { ...base, action: 'accepted' });
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('verifyChain', () => {
  it('accepts an untouched chain', async () => {
    expect(await verifyChain(await chainOf(['created', 'accepted', 'approved'])))
      .toEqual({ ok: true, brokenAtSeq: null });
  });

  it('accepts an empty chain', async () => {
    expect(await verifyChain([])).toEqual({ ok: true, brokenAtSeq: null });
  });

  it('detects a tampered MIDDLE row', async () => {
    const rows = await chainOf(['created', 'accepted', 'approved']);
    rows[1] = { ...rows[1], action: 'rejected' };   // rewrite history, keep the hashes
    expect(await verifyChain(rows)).toEqual({ ok: false, brokenAtSeq: 2 });
  });

  it('detects a removed row', async () => {
    const rows = await chainOf(['created', 'accepted', 'approved']);
    const { ok } = await verifyChain([rows[0], rows[2]]);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/chain.test.js`
Expected: FAIL — cannot resolve `./chain.js`.

- [ ] **Step 3: Implement**

```javascript
/**
 * Tamper-EVIDENT audit chain. Each event commits to its predecessor's hash, so
 * rewriting any row invalidates every hash after it. This does NOT make the log
 * immutable — whoever holds database access can rewrite rows and recompute the
 * chain. Its value comes from the daily head being checkpointed off-system.
 * Never describe the result as immutable (spec §4.2).
 */
import { canonicalJson, sha256Hex } from './hash.js';

export const GENESIS_HASH = '0'.repeat(64);

// Only these fields are committed to. `seq` is excluded on purpose: it is
// assigned by the database after the hash is computed.
const COMMITTED = ['attestation_id', 'subject_id', 'action', 'actor',
                   'detail', 'public_summary', 'created_at'];

const payload = (event) =>
  Object.fromEntries(COMMITTED.map((k) => [k, event[k] === undefined ? null : event[k]]));

export async function buildAuditEvent(prevHash, event) {
  const hash = await sha256Hex(`${prevHash}|${canonicalJson(payload(event))}`);
  return { ...event, prev_hash: prevHash, hash };
}

// Rows must arrive in ascending seq order.
export async function verifyChain(rows) {
  let prev = GENESIS_HASH;
  for (const row of rows) {
    if (row.prev_hash !== prev) return { ok: false, brokenAtSeq: row.seq ?? null };
    const expected = await sha256Hex(`${prev}|${canonicalJson(payload(row))}`);
    if (expected !== row.hash) return { ok: false, brokenAtSeq: row.seq ?? null };
    prev = row.hash;
  }
  return { ok: true, brokenAtSeq: null };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/verify/chain.test.js`
Expected: PASS (6 tests). The "tampered MIDDLE row" case is the one that matters — a chain that only detects tampering at the tail is not a chain.

- [ ] **Step 5: Commit**

```bash
git add src/verify/chain.js src/verify/chain.test.js
git commit -m "feat(verify): hash-chained audit events with tamper detection"
```

---

### Task 4: Officer-seat matching

**Files:**
- Create: `src/verify/seat.js`, `src/verify/seat.test.js`

**Interfaces:**
- Produces: `nameTokens(name): string[]`, `matchSeat(declaredName, officersActive): {name, position, appointed_date}|null`.

**Why this replaces `nameIsOfficer`:** the existing matcher in `functions/empresa/_confirmation.js` accepts a representative whose tokens are a *subset* of an officer's name, so "Alessandro Nürnberg" matches "Alessandro Nürnberg García". Sorted-token *equality* is both stricter and simpler than rotation handling, and it is what this must use.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { nameTokens, matchSeat } from './seat.js';

const OFFICERS = [
  { name: 'NURNBERG ALESSANDRO', position_normalized: 'ADM. UNICO', appointed_date: '2013-10-16' },
  { name: 'GARCIA LOPEZ MARIA', position_normalized: 'APODERADO', appointed_date: '2020-01-05' },
];

describe('nameTokens', () => {
  it('strips accents and punctuation and uppercases', () => {
    expect(nameTokens('Alessandro Nürnberg')).toEqual(['ALESSANDRO', 'NURNBERG']);
  });
  it('handles ñ', () => {
    expect(nameTokens('Muñoz')).toEqual(['MUNOZ']);
  });
});

describe('matchSeat', () => {
  it('matches regardless of surname-first ordering', () => {
    expect(matchSeat('Alessandro Nürnberg', OFFICERS)).toEqual({
      name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO', appointed_date: '2013-10-16',
    });
  });

  it('REJECTS a subset match — the bug in the old matcher', () => {
    expect(matchSeat('Maria Garcia', OFFICERS)).toBeNull();
  });

  it('rejects a superset', () => {
    expect(matchSeat('Alessandro Nurnberg Garcia', OFFICERS)).toBeNull();
  });

  it('returns null for an empty name rather than matching anything', () => {
    expect(matchSeat('', OFFICERS)).toBeNull();
    expect(matchSeat('  ', OFFICERS)).toBeNull();
  });

  it('returns null when there are no officers', () => {
    expect(matchSeat('Alessandro Nürnberg', [])).toBeNull();
    expect(matchSeat('Alessandro Nürnberg', undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/seat.test.js`
Expected: FAIL — cannot resolve `./seat.js`.

- [ ] **Step 3: Implement**

```javascript
/**
 * Binds an attester to a ROW in officers_active, not to a name string.
 *
 * Matching is sorted-token EQUALITY, which is stricter than the subset match it
 * replaces and simpler than rotation handling: BORME writes surnames first, and
 * a person may introduce themselves either way, but the token multiset is the
 * same. A subset match would let "Maria Garcia" claim the seat of "GARCIA LOPEZ
 * MARIA", who is a different person.
 *
 * A match is NECESSARY to invite an attester. It is never SUFFICIENT: holding a
 * registry position is not the same as holding power to represent the company
 * (spec §4.3), which only a reviewer establishes.
 */
export function nameTokens(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const sortedKey = (name) => nameTokens(name).sort().join(' ');

export function matchSeat(declaredName, officersActive) {
  const key = sortedKey(declaredName);
  if (!key) return null;
  const hit = (officersActive || []).find(
    (o) => sortedKey(o.name || o.name_normalized) === key,
  );
  if (!hit) return null;
  return {
    name: hit.name || hit.name_normalized,
    position: hit.position_normalized || hit.position || null,
    appointed_date: hit.appointed_date || null,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/verify/seat.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/verify/seat.js src/verify/seat.test.js
git commit -m "feat(verify): seat matching bound to an officer row, subset matches rejected"
```

---

### Task 5: Assertions and acceptance receipts

**Files:**
- Create: `src/verify/assertion.js`, `src/verify/assertion.test.js`

**Interfaces:**
- Consumes: `hashCanonical` from `src/verify/hash.js`.
- Produces: `VALID_FOR_DAYS`, `buildAssertion({identity, seat, representationBasis, facts, registrySnapshotDigest, consents, nonce, draftedAt}): object`, `buildAcceptanceReceipt(assertionHash, acceptedAtIso, method): {assertion_hash, accepted_at, expires_at, method}`, `addDays(iso, n): string`.

**The invariant under test:** the assertion is built *before* acceptance, so it cannot contain the acceptance time or an expiry derived from it. It carries `valid_for_days` as a **rule**. Otherwise the hash would move at the moment of acceptance and accept-by-hash would be impossible.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { hashCanonical } from './hash.js';
import { buildAssertion, buildAcceptanceReceipt, addDays, VALID_FOR_DAYS } from './assertion.js';

const INPUT = {
  identity: { subject_id: 's1', group_key: 'H:M-566914', nif: 'B86829538', hoja: 'M-566914',
              canonical_name: 'NURNBERG CONSULTING SL' },
  seat: { name: 'NURNBERG ALESSANDRO', position: 'ADM. UNICO', appointed_date: '2013-10-16' },
  representationBasis: 'sole_admin',
  facts: [{ fact_key: 'address', declared_status: 'current', declared_value: 'C/ ARZOBISPO COS 10' }],
  registrySnapshotDigest: 'abc123',
  consents: { authority: true, publication: true, reconfirmation: true },
  nonce: 'n-1',
  draftedAt: '2026-09-08T10:00:00Z',
};

describe('buildAssertion', () => {
  it('carries the validity RULE, never a computed expiry', () => {
    const a = buildAssertion(INPUT);
    expect(a.valid_for_days).toBe(VALID_FOR_DAYS);
    expect(a).not.toHaveProperty('expires_at');
    expect(a).not.toHaveProperty('accepted_at');
  });

  it('hashes identically before and after acceptance', async () => {
    const before = await hashCanonical(buildAssertion(INPUT));
    const receipt = buildAcceptanceReceipt(before, '2026-09-08T11:30:00Z', 'email-confirmed');
    const after = await hashCanonical(buildAssertion(INPUT));
    expect(after).toBe(before);
    expect(receipt.assertion_hash).toBe(before);
  });

  it('changes hash when a declared fact changes', async () => {
    const edited = { ...INPUT, facts: [{ ...INPUT.facts[0], declared_value: 'C/ OTRA 1' }] };
    expect(await hashCanonical(buildAssertion(edited)))
      .not.toBe(await hashCanonical(buildAssertion(INPUT)));
  });
});

describe('buildAcceptanceReceipt', () => {
  it('computes expiry by applying the rule to the real acceptance time', () => {
    const r = buildAcceptanceReceipt('h', '2026-09-08T11:30:00Z', 'email-confirmed');
    expect(r.accepted_at).toBe('2026-09-08T11:30:00Z');
    expect(r.expires_at).toBe('2027-03-07T11:30:00Z');
  });
});

describe('addDays', () => {
  it('crosses a leap day correctly', () => {
    expect(addDays('2028-02-28T00:00:00Z', 2)).toBe('2028-03-01T00:00:00Z');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/assertion.test.js`
Expected: FAIL — cannot resolve `./assertion.js`.

- [ ] **Step 3: Implement**

```javascript
/**
 * An assertion is the exact statement a representative is shown. It is built
 * BEFORE acceptance, so it must not contain the acceptance time or an expiry
 * derived from it — including either would change the hash at the moment of
 * acceptance and break accept-by-hash. It carries `valid_for_days` as a RULE.
 *
 * The acceptance receipt is the separate record of the act: the assertion hash,
 * the real acceptance time, the expiry computed by applying the rule, and the
 * method. The receipt is what the audit chain records (spec §5.9).
 */
export const VALID_FOR_DAYS = 180;

export function buildAssertion({
  identity, seat, representationBasis, facts,
  registrySnapshotDigest, consents, nonce, draftedAt,
}) {
  return {
    version: 1,
    nonce,
    drafted_at: draftedAt,
    valid_for_days: VALID_FOR_DAYS,
    identity,
    seat,
    representation_basis: representationBasis,
    registry_snapshot_digest: registrySnapshotDigest,
    consents,
    facts: facts.map((f) => ({
      fact_key: f.fact_key,
      declared_status: f.declared_status,
      declared_value: f.declared_value ?? null,
    })),
  };
}

export function addDays(iso, days) {
  const t = new Date(iso);
  t.setUTCDate(t.getUTCDate() + days);
  return `${t.toISOString().slice(0, 19)}Z`;
}

export function buildAcceptanceReceipt(assertionHash, acceptedAtIso, method) {
  return {
    assertion_hash: assertionHash,
    accepted_at: acceptedAtIso,
    expires_at: addDays(acceptedAtIso, VALID_FOR_DAYS),
    method,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/verify/assertion.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/verify/assertion.js src/verify/assertion.test.js
git commit -m "feat(verify): separate assertion from acceptance receipt so the hash is stable"
```

---

### Task 6: The public projection

**Files:**
- Create: `src/verify/projection.js`, `src/verify/projection.test.js`

**Interfaces:**
- Produces: `publicProjection(attestation, facts, auditRows): object`.

**The rule:** `reviewer` IS published — that is the accountability the design rests on. Everything in `PRIVATE_FIELDS` must never appear. The test is a property test because this is the failure that would actually hurt.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { publicProjection } from './projection.js';

const record = (overrides = {}) => ({
  id: 'att_abc', subject_id: 's1', status: 'live', method: 'email-confirmed',
  representation_basis: 'sole_admin', seat_officer_name: 'NURNBERG ALESSANDRO',
  seat_position: 'ADM. UNICO', accepted_at: '2026-09-08T11:30:00Z',
  expires_at: '2027-03-07T11:30:00Z', last_verified_at: '2026-10-07T03:00:00Z',
  approved_at: '2026-09-09T09:00:00Z', reviewer: 'Alessandro Nürnberg',
  // everything below must never surface:
  claimant_email: 'ceo@example.es', identification_note: 'video call 2026-09-07',
  email_domain_basis: 'company website', sealed_key: 'evidence/sealed/abc.json',
  personal_key: 'evidence/personal/abc.json', sealed_hash: 'deadbeef',
  decision_note: 'internal: checked poder', ...overrides,
});

const audit = [
  { seq: 1, action: 'accepted', created_at: '2026-09-08T11:30:00Z',
    public_summary: 'Accepted by the representative', detail: '{"ip":"1.2.3.4"}' },
  { seq: 2, action: 'reviewed', created_at: '2026-09-09T09:00:00Z',
    public_summary: null, detail: '{"note":"private"}' },
];

describe('publicProjection', () => {
  it('publishes the reviewer, deliberately', () => {
    expect(publicProjection(record(), [], []).reviewer).toBe('Alessandro Nürnberg');
  });

  it('publishes last_verified_at rather than a "right now" claim', () => {
    expect(publicProjection(record(), [], []).last_verified_at).toBe('2026-10-07T03:00:00Z');
  });

  it('includes only audit rows carrying a public_summary', () => {
    const history = publicProjection(record(), [], audit).history;
    expect(history).toHaveLength(1);
    expect(history[0].summary).toBe('Accepted by the representative');
    expect(JSON.stringify(history)).not.toMatch(/1\.2\.3\.4/);
  });

  it('never leaks any private field, for any generated value', () => {
    const secrets = ['ceo@example.es', 'video call 2026-09-07', 'company website',
                     'evidence/sealed/abc.json', 'evidence/personal/abc.json',
                     'deadbeef', 'internal: checked poder'];
    for (let i = 0; i < 200; i++) {
      const marker = `SECRET-${i}-${Math.random().toString(36).slice(2)}`;
      const poisoned = record({
        claimant_email: marker, identification_note: marker, email_domain_basis: marker,
        sealed_key: marker, personal_key: marker, sealed_hash: marker, decision_note: marker,
      });
      const out = JSON.stringify(publicProjection(poisoned, [], audit));
      expect(out).not.toContain(marker);
    }
    const clean = JSON.stringify(publicProjection(record(), [], audit));
    for (const s of secrets) expect(clean).not.toContain(s);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/projection.test.js`
Expected: FAIL — cannot resolve `./projection.js`.

- [ ] **Step 3: Implement**

Build the projection by **allow-list**, never by deleting fields from the record. A deny-list silently leaks every column added later.

```javascript
/**
 * The ONLY shape a reader ever sees. Built by allow-list: a deny-list would
 * leak every column added after it was written.
 *
 * `reviewer` is published deliberately — the reviewer is the operator taking
 * public accountability for the decision, which is the point (spec §8). The
 * redaction set is claimant email, identification_note, email_domain_basis,
 * audit detail, evidence keys and hashes, and grant tokens.
 */
const HISTORY_FIELDS = ['seq', 'action', 'created_at'];

export function publicProjection(attestation, facts, auditRows) {
  return {
    id: attestation.id,
    status: attestation.status,
    method: attestation.method,
    representation_basis: attestation.representation_basis,
    representative: {
      name: attestation.seat_officer_name,
      position: attestation.seat_position,
    },
    accepted_at: attestation.accepted_at,
    expires_at: attestation.expires_at,
    approved_at: attestation.approved_at,
    // The last SUCCESSFUL check. A daily job cannot support "as of right now".
    last_verified_at: attestation.last_verified_at,
    reviewer: attestation.reviewer,
    status_reason: attestation.status_reason,
    facts: (facts || []).map((f) => ({
      fact_key: f.fact_key,
      declared_status: f.declared_status,
      declared_value: f.declared_value,
      registry_value_at_issue: f.registry_value_at_issue,
      last_check_outcome: f.last_check_outcome,
      last_checked_at: f.last_checked_at,
    })),
    history: (auditRows || [])
      .filter((r) => r.public_summary)
      .map((r) => ({
        ...Object.fromEntries(HISTORY_FIELDS.map((k) => [k, r[k]])),
        summary: r.public_summary,
      })),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/verify/projection.test.js`
Expected: PASS (4 tests, the last running 200 generated cases).

- [ ] **Step 5: Commit**

```bash
git add src/verify/projection.js src/verify/projection.test.js
git commit -m "feat(verify): allow-list public projection with a leak property test"
```

---

### Task 7: Ids, tokens and shared adapters

**Files:**
- Create: `src/verify/ids.js`, `src/verify/ids.test.js`, `functions/api/verify/_db.js`

**Interfaces:**
- Produces: `newId(prefix): string`, `newToken(): string`, `tokenHash(token): Promise<string>` from `ids.js`; and from `_db.js`: `requireAdmin(request, env)`, `fetchCompanyByGroupKey(groupKey, env)`, `auditStatement(env, event): Promise<D1PreparedStatement>`, `jsonResponse(payload, status)`, `privateHeaders()`.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { newId, newToken, tokenHash } from './ids.js';

describe('newId', () => {
  it('prefixes and is long enough not to be guessed', () => {
    const id = newId('att');
    expect(id.startsWith('att_')).toBe(true);
    expect(id.length).toBeGreaterThanOrEqual(26);
  });
  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => newId('att')));
    expect(seen.size).toBe(5000);
  });
});

describe('newToken / tokenHash', () => {
  it('stores a hash, never the token', async () => {
    const t = newToken();
    const h = await tokenHash(t);
    expect(h).toHaveLength(64);
    expect(h).not.toContain(t);
  });
  it('is stable for the same token', async () => {
    const t = newToken();
    expect(await tokenHash(t)).toBe(await tokenHash(t));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/ids.test.js`
Expected: FAIL — cannot resolve `./ids.js`.

- [ ] **Step 3: Implement `src/verify/ids.js`**

```javascript
/**
 * Unguessable identifiers. The attestation id is public and the grant token IS
 * the address of a private page, so both must come from a CSPRNG — 16 bytes of
 * crypto.getRandomValues, base32-encoded to stay URL-safe and case-insensitive.
 */
import { sha256Hex } from './hash.js';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function base32(bytes) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

const random = (n) => base32(crypto.getRandomValues(new Uint8Array(n)));

export const newId = (prefix) => `${prefix}_${random(16)}`;
export const newToken = () => random(32);
export const tokenHash = (token) => sha256Hex(token);
```

- [ ] **Step 4: Implement `functions/api/verify/_db.js`**

```javascript
/**
 * Thin shared adapters for the verification endpoints. All decision logic lives
 * in src/verify/ where vitest can reach it (vitest only scans src/**\/*.test.js,
 * functions/**\/*.test.js and scripts/**\/*.test.js); this file only moves data.
 */
import { buildAuditEvent, GENESIS_HASH } from '../../../src/verify/chain.js';

const API_BASE = 'https://api.ncdata.eu';

export const privateHeaders = () => ({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow, noarchive',
});

export const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: privateHeaders() });

// Constant-time-ish comparison so the admin token cannot be probed byte by byte.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function requireAdmin(request, env) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return Boolean(env.VERIFY_ADMIN_TOKEN) && safeEqual(token, env.VERIFY_ADMIN_TOKEN);
}

// Every call carries X-Internal-Key: the upstream rate limiter keys on the nginx
// loopback address, so an unkeyed caller consumes the site-wide per-worker
// bucket and can take the public site down with it (spec §6).
export async function fetchCompanyByGroupKey(groupKey, env) {
  const response = await fetch(
    `${API_BASE}/bormes/v3/company?group_key=${encodeURIComponent(groupKey)}`,
    { headers: env.INTERNAL_API_KEY ? { 'X-Internal-Key': env.INTERNAL_API_KEY } : {} },
  );
  if (!response.ok) throw new Error(`registry_fetch_failed_${response.status}`);
  const data = await response.json();
  if (!data || !data.company) throw new Error('registry_no_company');
  return data.company;
}

// Returns a PREPARED statement so the caller can put it inside their own batch.
// The unique index on prev_hash makes a concurrent append fail rather than fork
// the chain; the caller retries against the new head.
export async function auditStatement(env, event) {
  const head = await env.VERIFY_DB
    .prepare('SELECT hash FROM audit_events ORDER BY seq DESC LIMIT 1')
    .first();
  const row = await buildAuditEvent(head ? head.hash : GENESIS_HASH, {
    created_at: new Date().toISOString(), ...event,
  });
  return env.VERIFY_DB
    .prepare(`INSERT INTO audit_events
      (attestation_id, subject_id, action, actor, detail, public_summary, created_at, prev_hash, hash)
      VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(row.attestation_id ?? null, row.subject_id ?? null, row.action, row.actor,
          row.detail ?? null, row.public_summary ?? null, row.created_at,
          row.prev_hash, row.hash);
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/verify/`
Expected: PASS — all suites from Tasks 2–7 green.

- [ ] **Step 6: Commit**

```bash
git add src/verify/ids.js src/verify/ids.test.js functions/api/verify/_db.js
git commit -m "feat(verify): unguessable ids and shared endpoint adapters"
```

---

### Task 8: Invite endpoint

**Files:**
- Create: `functions/api/verify/invite.js`
- Create: `functions/api/verify/invite.test.js`

**Interfaces:**
- Consumes: `matchSeat`, `newId`, `newToken`, `tokenHash`, `requireAdmin`, `fetchCompanyByGroupKey`, `auditStatement`, `jsonResponse`.
- Produces: `validateInvitePayload(body): {ok, value|reason}` — exported for unit testing without a network or database.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { validateInvitePayload } from './invite.js';

const good = {
  group_key: 'H:M-566914', declared_name: 'Alessandro Nürnberg',
  email: 'a@nurnbergconsulting.com', claimed_role: 'Administrador único',
  representation_basis: 'sole_admin', identification_note: 'known personally since 2019',
  email_domain_basis: 'company website nurnbergconsulting.com',
};

describe('validateInvitePayload', () => {
  it('accepts a complete payload', () => {
    expect(validateInvitePayload(good).ok).toBe(true);
  });

  it('REFUSES mancomunados by name', () => {
    const r = validateInvitePayload({ ...good, representation_basis: 'joint_admin_pair' });
    expect(r).toEqual({ ok: false, reason: 'joint_administrators_excluded' });
  });

  it('requires the reviewer to record how the person was identified', () => {
    expect(validateInvitePayload({ ...good, identification_note: '' }))
      .toEqual({ ok: false, reason: 'missing_identification_note' });
  });

  it('requires the basis for tying the domain to the company', () => {
    expect(validateInvitePayload({ ...good, email_domain_basis: '  ' }))
      .toEqual({ ok: false, reason: 'missing_email_domain_basis' });
  });

  it('rejects an unknown representation basis', () => {
    expect(validateInvitePayload({ ...good, representation_basis: 'ceo' }))
      .toEqual({ ok: false, reason: 'invalid_representation_basis' });
  });

  it('rejects a malformed email', () => {
    expect(validateInvitePayload({ ...good, email: 'nope' }))
      .toEqual({ ok: false, reason: 'invalid_email' });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run functions/api/verify/invite.test.js`
Expected: FAIL — cannot resolve `./invite.js`.

- [ ] **Step 3: Implement**

```javascript
/**
 * POST /api/verify/invite — the operator issues one invitation.
 *
 * Two things this endpoint will not do. It will not invite someone the registry
 * does not place in the company (matchSeat must hit). And it will not accept a
 * joint administrator: mancomunados must act together, so a single signature
 * would misstate LSC art. 233 — the pilot refuses them by name rather than
 * approximating (spec §4.3).
 *
 * representation_basis and identification_note are operator judgements the
 * system cannot infer, and both are mandatory: an undocumented identification
 * is worse than a weak one.
 */
import { matchSeat } from '../../../src/verify/seat.js';
import { newId, newToken, tokenHash } from '../../../src/verify/ids.js';
import { requireAdmin, fetchCompanyByGroupKey, auditStatement, jsonResponse } from './_db.js';

const BASES = new Set(['sole_admin', 'joint_several_admin', 'delegated_board_member', 'apoderado']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_HOURS = 72;

const text = (v) => (typeof v === 'string' ? v.trim() : '');

export function validateInvitePayload(body) {
  const b = body || {};
  const value = {
    group_key: text(b.group_key),
    declared_name: text(b.declared_name),
    email: text(b.email).toLowerCase(),
    claimed_role: text(b.claimed_role),
    representation_basis: text(b.representation_basis),
    identification_note: text(b.identification_note),
    email_domain_basis: text(b.email_domain_basis),
  };
  if (!value.group_key) return { ok: false, reason: 'missing_group_key' };
  if (!value.declared_name) return { ok: false, reason: 'missing_declared_name' };
  if (!EMAIL_RE.test(value.email)) return { ok: false, reason: 'invalid_email' };
  if (!value.claimed_role) return { ok: false, reason: 'missing_claimed_role' };
  if (value.representation_basis === 'joint_admin_pair') {
    return { ok: false, reason: 'joint_administrators_excluded' };
  }
  if (!BASES.has(value.representation_basis)) {
    return { ok: false, reason: 'invalid_representation_basis' };
  }
  if (!value.identification_note) return { ok: false, reason: 'missing_identification_note' };
  if (!value.email_domain_basis) return { ok: false, reason: 'missing_email_domain_basis' };
  return { ok: true, value };
}

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const parsed = validateInvitePayload(body);
  if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.reason }, 400);
  const v = parsed.value;

  let company;
  try { company = await fetchCompanyByGroupKey(v.group_key, env); }
  catch (e) { return jsonResponse({ ok: false, error: e.message }, 502); }

  const seat = matchSeat(v.declared_name, company.officers_active);
  if (!seat) {
    return jsonResponse({
      ok: false, error: 'no_matching_officer_seat',
      officers: (company.officers_active || []).map((o) => o.name || o.name_normalized),
    }, 422);
  }

  const existing = await env.VERIFY_DB
    .prepare(`SELECT subject_id FROM subject_identifiers
              WHERE kind = 'group_key' AND value = ? AND valid_to IS NULL`)
    .bind(v.group_key).first();

  const subjectId = existing ? existing.subject_id : newId('sub');
  const claimantId = newId('clm');
  const invitationId = newId('inv');
  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600_000).toISOString();

  const statements = [];
  if (!existing) {
    statements.push(
      env.VERIFY_DB.prepare('INSERT INTO subjects (subject_id, display_name) VALUES (?,?)')
        .bind(subjectId, company.company_name),
      env.VERIFY_DB.prepare(
        `INSERT INTO subject_identifiers (subject_id, kind, value) VALUES (?,'group_key',?)`)
        .bind(subjectId, v.group_key),
    );
    const nif = company.nif || company.enriched_nif;
    if (nif) {
      statements.push(env.VERIFY_DB.prepare(
        `INSERT INTO subject_identifiers (subject_id, kind, value) VALUES (?,'nif',?)`)
        .bind(subjectId, nif));
    }
    for (const hoja of company.hojas || []) {
      statements.push(env.VERIFY_DB.prepare(
        `INSERT INTO subject_identifiers (subject_id, kind, value) VALUES (?,'hoja',?)`)
        .bind(subjectId, hoja));
    }
  }

  statements.push(
    env.VERIFY_DB.prepare(
      `INSERT INTO claimants (id, subject_id, declared_name, email, claimed_role,
        representation_basis, identification_note, email_domain_basis, role)
       VALUES (?,?,?,?,?,?,?,?,'attester')`)
      .bind(claimantId, subjectId, v.declared_name, v.email, v.claimed_role,
            v.representation_basis, v.identification_note, v.email_domain_basis),
    env.VERIFY_DB.prepare(
      `INSERT INTO invitations (id, token_hash, claimant_id, subject_id, expires_at)
       VALUES (?,?,?,?,?)`)
      .bind(invitationId, await tokenHash(token), claimantId, subjectId, expiresAt),
    await auditStatement(env, {
      subject_id: subjectId, action: 'invitation_issued', actor: 'operator',
      detail: JSON.stringify({ claimant_id: claimantId, seat, basis: v.representation_basis }),
      public_summary: null,
    }),
  );

  await env.VERIFY_DB.batch(statements);

  // The token is returned ONCE, to the operator, and never stored in the clear.
  return jsonResponse({
    ok: true, subject_id: subjectId, invitation_id: invitationId, seat,
    confirm_url: `https://mapasocietario.es/verificacion/confirmar?t=${token}`,
    expires_at: expiresAt,
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run functions/api/verify/invite.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/api/verify/invite.js functions/api/verify/invite.test.js
git commit -m "feat(verify): invite endpoint bound to an officer seat, mancomunados refused"
```

---

### Task 9: Draft build and edit

**Files:**
- Create: `functions/api/verify/session.js`, `functions/api/verify/draft.js`
- Create: `src/verify/facts.js`, `src/verify/facts.test.js`

**Interfaces:**
- Produces: `FACT_KEYS`, `factsFromRegistry(company): fact[]`, `applyEdits(baseFacts, edits): fact[]` from `facts.js`.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { FACT_KEYS, factsFromRegistry, applyEdits } from './facts.js';

const COMPANY = {
  company_name: 'NURNBERG CONSULTING SL',
  current_address: 'C/ ARZOBISPO COS 10, BAJO (MADRID)',
  is_in_concurso: false, is_dissolved: false, enriched_nif: 'B86829538',
  officers_active: [{ name: 'NURNBERG ALESSANDRO', position_normalized: 'ADM. UNICO' }],
};

describe('factsFromRegistry', () => {
  it('produces exactly the seven fact keys, in a stable order', () => {
    expect(factsFromRegistry(COMPANY).map((f) => f.fact_key)).toEqual(FACT_KEYS);
  });

  it('gives vat_intraeu the vies source and operational NO source', () => {
    const by = Object.fromEntries(factsFromRegistry(COMPANY).map((f) => [f.fact_key, f]));
    expect(by.vat_intraeu.check_source).toBe('vies');
    expect(by.operational.check_source).toBe('none');
    expect(by.address.check_source).toBe('borme');
  });

  it('does NOT infer operational from is_dissolved', () => {
    const by = Object.fromEntries(factsFromRegistry(COMPANY).map((f) => [f.fact_key, f]));
    expect(by.operational.registry_value_at_issue).toBeNull();
    expect(by.operational.declared_status).toBe('not_applicable');
  });
});

describe('applyEdits', () => {
  it('marks an edited value corrected and keeps the registry value', () => {
    const edited = applyEdits(factsFromRegistry(COMPANY),
      [{ fact_key: 'address', declared_status: 'corrected', declared_value: 'C/ NUEVA 5' }]);
    const address = edited.find((f) => f.fact_key === 'address');
    expect(address.declared_status).toBe('corrected');
    expect(address.declared_value).toBe('C/ NUEVA 5');
    expect(address.registry_value_at_issue).toBe('C/ ARZOBISPO COS 10, BAJO (MADRID)');
  });

  it('ignores an unknown fact key rather than inventing a fact', () => {
    const edited = applyEdits(factsFromRegistry(COMPANY),
      [{ fact_key: 'revenue', declared_status: 'current', declared_value: '1M' }]);
    expect(edited.map((f) => f.fact_key)).toEqual(FACT_KEYS);
  });

  it('leaves untouched facts alone', () => {
    const base = factsFromRegistry(COMPANY);
    expect(applyEdits(base, [])).toEqual(base);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/facts.test.js`
Expected: FAIL — cannot resolve `./facts.js`.

- [ ] **Step 3: Implement `src/verify/facts.js`**

```javascript
/**
 * The seven facts and where each is checked. Two carry deliberate limits:
 *
 * - vat_intraeu is checked against VIES, which tests registration for intra-EU
 *   TRADE, not NIF validity. A legitimate Spanish company not enrolled in the
 *   ROI returns invalid — our own NIF crawler verified only 34% of real
 *   companies this way — so it changes no status, ever (spec §5.4).
 * - operational has NO check source. `is_dissolved === false` does not
 *   establish that a company trades, so it is a declaration and is labelled as
 *   one rather than being inferred from the registry.
 */
export const FACT_KEYS = ['representation', 'officers', 'address', 'insolvency',
                          'nif', 'vat_intraeu', 'operational'];

const SOURCES = {
  representation: 'borme', officers: 'borme', address: 'borme',
  insolvency: 'borme', nif: 'borme', vat_intraeu: 'vies', operational: 'none',
};

export function factsFromRegistry(company) {
  const officers = (company.officers_active || [])
    .map((o) => `${o.name || o.name_normalized} (${o.position_normalized || ''})`.trim())
    .join('; ');

  const registryValues = {
    representation: officers || null,
    officers: officers || null,
    address: company.current_address || null,
    insolvency: company.is_in_concurso ? 'concurso' : 'none',
    nif: company.nif || company.enriched_nif || null,
    vat_intraeu: null,     // filled only by an explicit VIES check
    operational: null,     // never inferred
  };

  return FACT_KEYS.map((fact_key) => ({
    fact_key,
    check_source: SOURCES[fact_key],
    registry_value_at_issue: registryValues[fact_key],
    declared_value: registryValues[fact_key],
    declared_status:
      fact_key === 'insolvency' ? 'none'
      : registryValues[fact_key] === null ? 'not_applicable'
      : 'current',
  }));
}

// Edits never add facts — an unknown key is dropped rather than invented.
export function applyEdits(baseFacts, edits) {
  const byKey = new Map((edits || []).map((e) => [e.fact_key, e]));
  return baseFacts.map((f) => {
    const edit = byKey.get(f.fact_key);
    if (!edit) return f;
    return {
      ...f,
      declared_status: edit.declared_status,
      declared_value: edit.declared_value ?? null,
      // registry_value_at_issue is NEVER overwritten by an edit: it is the
      // evidence the declaration is compared against.
    };
  });
}
```

- [ ] **Step 4: Implement the two endpoints**

`functions/api/verify/session.js` — `GET /api/verify/session?t=<token>`:

1. Hash the token, look up a non-expired, unused invitation; **404** if absent (never 403).
2. `fetchCompanyByGroupKey` for the subject's current `group_key`.
3. `matchSeat` against the claimant's declared name; **409** if the seat has vanished since the invitation.
4. Build the identity snapshot and `factsFromRegistry(company)`.
5. `buildAssertion({ ..., nonce: newId('non'), draftedAt: new Date().toISOString() })`, hash it with `hashCanonical`.
6. `INSERT OR IGNORE` into `draft_assertions` (hash, invitation_id, subject_id, canonical_json, registry_snapshot).
7. Return `{ ok: true, draft_hash, assertion, company_name, seat }`.

`functions/api/verify/draft.js` — `POST /api/verify/draft` with `{ t, base_hash, edits }`:

1. Same token lookup; **404** if absent.
2. Load `base_hash` from `draft_assertions`, scoped to this invitation; **404** if it is not this invitation's draft.
3. Rebuild the fact list. **The stored `canonical_json` cannot supply it** — `buildAssertion` keeps only `fact_key`, `declared_status` and `declared_value`, deliberately dropping `registry_value_at_issue`, which the edit path needs as the evidence a declaration is compared against. So derive base facts from the draft's own `registry_snapshot`, replay the declarations already made, then apply the new edits:

```javascript
const snapshot = JSON.parse(row.registry_snapshot);
const priorDeclared = JSON.parse(row.canonical_json).facts;
const facts = applyEdits(applyEdits(factsFromRegistry(snapshot), priorDeclared), edits);
```

   Then rebuild the assertion with a **new nonce and `drafted_at`** and hash it.
4. In one `batch()`: insert the new draft and `UPDATE draft_assertions SET superseded_by = ? WHERE hash = ?`.
5. Return `{ ok: true, draft_hash, assertion }`.

**The rule both endpoints enforce:** acceptance always references a persisted draft that was rendered in full. A client-assembled payload is never accepted, because the representative would then be accepting something no one recorded showing them.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/verify/facts.test.js`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/verify/facts.js src/verify/facts.test.js functions/api/verify/session.js functions/api/verify/draft.js
git commit -m "feat(verify): registry-derived facts, persisted drafts, and an edit that supersedes"
```

---

### Task 10: Submit — evidence to R2, then one batch

**Files:**
- Create: `functions/api/verify/submit.js`
- Create: `src/verify/evidence.js`, `src/verify/evidence.test.js`

**Interfaces:**
- Produces: `evidenceKeys(draftHash): {sealed, personal}`, `buildSealedEvidence(...)`, `buildPersonalEvidence(...)`, `putEvidenceOnce(bucket, key, body): Promise<'created'|'verified'>`.

**The two guarantees this task must actually deliver:**

1. **One acceptance per invitation, enforced by `UNIQUE(invitation_id)`.** A conditional `UPDATE ... WHERE used_at IS NULL` is *not* a mechanism: an update matching zero rows is a **successful** statement in SQLite, and D1 rolls a batch back only when a statement **fails**. The insert failing is what rolls the batch back.
2. **Retry-safe evidence writes.** A hash-derived key prevents duplicate names; it does not by itself make the write retry-safe. Use a conditional put, and verify the digest of anything already there.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { evidenceKeys, putEvidenceOnce } from './evidence.js';

function fakeBucket(initial = {}) {
  const store = { ...initial };
  return {
    store,
    async put(key, body, options) {
      if (options?.onlyIf?.etagDoesNotMatch === '*' && key in store) return null;
      store[key] = body;
      return { key };
    },
    async get(key) {
      if (!(key in store)) return null;
      return { text: async () => store[key] };
    },
  };
}

describe('evidenceKeys', () => {
  it('splits sealed from personal under separate prefixes', () => {
    expect(evidenceKeys('abc')).toEqual({
      sealed: 'evidence/sealed/abc.json',
      personal: 'evidence/personal/abc.json',
    });
  });
});

describe('putEvidenceOnce', () => {
  it('creates an object that is not there', async () => {
    const bucket = fakeBucket();
    expect(await putEvidenceOnce(bucket, 'k', '{"a":1}')).toBe('created');
    expect(bucket.store.k).toBe('{"a":1}');
  });

  it('verifies and continues when the same body is already there (a retry)', async () => {
    const bucket = fakeBucket({ k: '{"a":1}' });
    expect(await putEvidenceOnce(bucket, 'k', '{"a":1}')).toBe('verified');
  });

  it('THROWS when a different body already occupies a hash-derived key', async () => {
    const bucket = fakeBucket({ k: '{"a":2}' });
    await expect(putEvidenceOnce(bucket, 'k', '{"a":1}'))
      .rejects.toThrow('evidence_digest_mismatch');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/evidence.test.js`
Expected: FAIL — cannot resolve `./evidence.js`.

- [ ] **Step 3: Implement `src/verify/evidence.js`**

```javascript
/**
 * Evidence lives in two R2 prefixes with very different risk (spec §9.1):
 *
 *   evidence/sealed/   assertion, registry snapshot, timestamps, the attester's
 *                      name and position. Bucket-locked. No contact details.
 *   evidence/personal/ email, identification_note. NEVER locked — a lock would
 *                      obstruct an erasure request for as long as it is active.
 *
 * Both keys derive from the draft hash so a retry addresses the same objects.
 * That prevents duplicate NAMES; retry safety comes from the conditional put
 * plus digest verification below.
 */
export const evidenceKeys = (draftHash) => ({
  sealed: `evidence/sealed/${draftHash}.json`,
  personal: `evidence/personal/${draftHash}.json`,
});

export function buildSealedEvidence({ assertion, registrySnapshot, seat, identity, acceptedAt }) {
  return JSON.stringify({ assertion, registry_snapshot: registrySnapshot, seat, identity,
                          accepted_at: acceptedAt });
}

export function buildPersonalEvidence({ email, identificationNote, emailDomainBasis, acceptedAt }) {
  return JSON.stringify({ email, identification_note: identificationNote,
                          email_domain_basis: emailDomainBasis, accepted_at: acceptedAt });
}

/**
 * Create-if-absent. If something is already there, read it back and compare:
 * an identical body means a previous attempt got this far and we continue; a
 * DIFFERENT body under a hash-derived key means something is badly wrong, so it
 * aborts loudly rather than overwriting evidence.
 */
export async function putEvidenceOnce(bucket, key, body) {
  const created = await bucket.put(key, body, { onlyIf: { etagDoesNotMatch: '*' } });
  if (created) return 'created';
  const existing = await bucket.get(key);
  if (!existing) throw new Error('evidence_put_raced');
  if ((await existing.text()) !== body) throw new Error('evidence_digest_mismatch');
  return 'verified';
}
```

- [ ] **Step 4: Implement `functions/api/verify/submit.js`**

`POST /api/verify/submit` with `{ t, draft_hash, consents }`:

1. Token lookup → invitation; **404** if unknown or expired.
2. **Post-commit retry check.** `SELECT id FROM attestations WHERE invitation_id = ?`. If a row exists and its `assertion_hash` equals `draft_hash`, return `{ ok: true, attestation_id, status: 'pending_review' }` with **200** — from the representative's side the submission did succeed. If it exists with a *different* hash, return **409**.
3. Load the draft, scoped to this invitation; **404** otherwise. Reject a draft that has been superseded — the representative is looking at a stale screen.
4. Re-read the registry and rebuild the assertion, carrying the representative's declarations across to the fresh snapshot — the same two-step derivation as the edit path, because `canonical_json` alone cannot supply `registry_value_at_issue`:

```javascript
const fresh = await fetchCompanyByGroupKey(groupKey, env);
const declared = JSON.parse(draftRow.canonical_json).facts;
const facts = applyEdits(factsFromRegistry(fresh), declared);
const rebuiltHash = await hashCanonical(buildAssertion({ ...draftInput, facts,
  registrySnapshotDigest: await sha256Hex(canonicalJson(fresh)) }));
```

   If `rebuiltHash !== draft_hash`, persist the rebuilt draft, mark the old one superseded, and return **409** with the new draft for fresh acceptance. **This is the reverse of re-reading and calling the result "what they saw"** — a fresh read at submit time proves nothing about what was on screen.
5. `acceptedAt = new Date().toISOString()`; `buildAcceptanceReceipt(draft_hash, acceptedAt, 'email-confirmed')`.
6. `putEvidenceOnce` for the sealed object, then the personal object. A thrown `evidence_digest_mismatch` returns **500** and alerts; nothing is written to D1.
7. One `env.VERIFY_DB.batch([...])`:
   - `INSERT INTO attestations (...)` — **this is the gate**; its `UNIQUE(invitation_id)` fails a replay and rolls the batch back.
   - `INSERT INTO attestation_facts` per fact.
   - `UPDATE invitations SET used_at = ? WHERE id = ?` — a *record*, never the enforcement.
   - `auditStatement(env, { action: 'accepted', actor: 'representative', public_summary: 'Accepted by the representative', detail: JSON.stringify({ draft_hash, receipt }) })`.
8. Return **received, under review** — never the word *verified*.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/verify/evidence.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/verify/evidence.js src/verify/evidence.test.js functions/api/verify/submit.js
git commit -m "feat(verify): submission with constraint-enforced single acceptance and retry-safe evidence"
```

---

### Task 11: Review endpoints

**Files:**
- Create: `functions/api/verify/admin/queue.js`, `functions/api/verify/admin/decide.js`
- Create: `src/verify/diff.js`, `src/verify/diff.test.js`

**Interfaces:**
- Produces: `factDiff(facts): {fact_key, declared, registry, differs}[]` from `diff.js`.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { factDiff } from './diff.js';

describe('factDiff', () => {
  it('flags a corrected value as differing', () => {
    const [row] = factDiff([{ fact_key: 'address', declared_status: 'corrected',
      declared_value: 'C/ NUEVA 5', registry_value_at_issue: 'C/ VIEJA 1' }]);
    expect(row).toEqual({ fact_key: 'address', declared: 'C/ NUEVA 5',
      registry: 'C/ VIEJA 1', differs: true });
  });

  it('does not flag an unchanged confirmation', () => {
    expect(factDiff([{ fact_key: 'address', declared_status: 'current',
      declared_value: 'C/ VIEJA 1', registry_value_at_issue: 'C/ VIEJA 1' }])[0].differs)
      .toBe(false);
  });

  it('treats a null registry value with a declared value as differing', () => {
    expect(factDiff([{ fact_key: 'operational', declared_status: 'current',
      declared_value: 'trading', registry_value_at_issue: null }])[0].differs).toBe(true);
  });

  it('does not flag two nulls', () => {
    expect(factDiff([{ fact_key: 'vat_intraeu', declared_status: 'not_applicable',
      declared_value: null, registry_value_at_issue: null }])[0].differs).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/diff.test.js`
Expected: FAIL — cannot resolve `./diff.js`.

- [ ] **Step 3: Implement `src/verify/diff.js`**

```javascript
/**
 * Review is a comparison, not a reading: the queue shows declared beside
 * registry with the differences marked, so the reviewer's attention lands on
 * the rows where a judgement is actually required.
 */
export const factDiff = (facts) =>
  (facts || []).map((f) => ({
    fact_key: f.fact_key,
    declared: f.declared_value ?? null,
    registry: f.registry_value_at_issue ?? null,
    differs: (f.declared_value ?? null) !== (f.registry_value_at_issue ?? null),
  }));
```

- [ ] **Step 4: Implement the endpoints**

`functions/api/verify/admin/queue.js` — `GET`, admin-guarded: every `pending_review` attestation with its claimant, seat, and `factDiff(facts)`.

`functions/api/verify/admin/decide.js` — `POST { attestation_id, decision, reviewer, note }`, admin-guarded:

- **Reject:** set `status = 'rejected'`, `reviewer`, `reviewed_at`, `decision_note`; append an audit event with **no** `public_summary`.
- **Approve**, in this order:
  1. Re-read **both** evidence objects and verify their bodies against `sealed_hash` / `personal_hash`. A missing or altered object aborts with **409** — an attestation whose evidence cannot be produced must never go live.
  2. One `batch()`:
     - `UPDATE attestations SET status='superseded', superseded_by=? WHERE subject_id=? AND status IN ('live','outdated','under_review','disputed','expired')` — demotes **whatever the incumbent is**. `idx_attestations_current` makes the promotion fail if this is skipped.
     - `UPDATE attestations SET status='live', approved_at=?, reviewer=?, reviewed_at=?, decision_note=?, last_verified_at=? WHERE id=?`.
     - `auditStatement` with `public_summary: 'Reviewed and published'`.

**`expires_at` is never recomputed here.** It was written once at acceptance, from `accepted_at`. Statement age runs from when the representative accepted, not from when the operator got round to approving.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/verify/diff.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/verify/diff.js src/verify/diff.test.js functions/api/verify/admin/
git commit -m "feat(verify): review queue as a diff, approval that supersedes any incumbent"
```

---

### Task 12: Grant-gated read

**Files:**
- Create: `functions/verificacion/g/[token].js`
- Create: `src/verify/grant.js`, `src/verify/grant.test.js`

**Interfaces:**
- Produces: `grantState(row, nowMs): 'valid'|'missing'|'expired'|'revoked'` from `grant.js`.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { grantState } from './grant.js';

const NOW = Date.parse('2026-09-08T12:00:00Z');

describe('grantState', () => {
  it('is valid with no expiry set', () => {
    expect(grantState({ expires_at: null, revoked_at: null }, NOW)).toBe('valid');
  });
  it('is valid before expiry', () => {
    expect(grantState({ expires_at: '2026-10-01T00:00:00Z', revoked_at: null }, NOW)).toBe('valid');
  });
  it('is expired after expiry', () => {
    expect(grantState({ expires_at: '2026-09-01T00:00:00Z', revoked_at: null }, NOW)).toBe('expired');
  });
  it('is revoked even when unexpired', () => {
    expect(grantState({ expires_at: null, revoked_at: '2026-09-07T00:00:00Z' }, NOW)).toBe('revoked');
  });
  it('is missing for a null row', () => {
    expect(grantState(null, NOW)).toBe('missing');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/verify/grant.test.js`
Expected: FAIL — cannot resolve `./grant.js`.

- [ ] **Step 3: Implement `src/verify/grant.js`**

```javascript
/**
 * A grant is an ACCESS TOKEN, not evidence of who read the page. Links get
 * forwarded, and email scanners and link previewers fetch them unprompted, so a
 * grant labelled "Banco X" records accesses through that link and nothing more.
 * No surface may describe it otherwise (spec §7).
 *
 * Every non-valid state renders identically to the caller as 404: a 403 would
 * confirm the record exists.
 */
export function grantState(row, nowMs = Date.now()) {
  if (!row) return 'missing';
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && Date.parse(row.expires_at) <= nowMs) return 'expired';
  return 'valid';
}
```

- [ ] **Step 4: Implement `functions/verificacion/g/[token].js`**

`GET /verificacion/g/<token>`:

1. `tokenHash(params.token)` → `SELECT * FROM view_grants WHERE token_hash = ?`.
2. `grantState(row)`; anything but `valid` returns **404** with the same body every time.
3. Load the attestation, its facts, and its audit rows; build `publicProjection(...)`.
4. `UPDATE view_grants SET access_count = access_count + 1, last_access_at = ?`.
5. Content negotiation: `Accept: application/json` (or a `.json` suffix) returns the projection; otherwise render HTML from the same object.
6. Every response carries `privateHeaders()` — `no-store`, `no-referrer`, `noindex, nofollow, noarchive`.

**Copy for the HTML, obeying the global constraints:**

- Heading: the company name.
- Status line, keyed on `status`:
  - `live` — *"Statement accepted on {accepted_at}. Last successfully checked: {last_verified_at}."*
  - `outdated` — *"This statement was accepted on {accepted_at} and was consistent with the registry evidence checked at that time. {status_reason} The statement should no longer be treated as current. Last successfully checked: {last_verified_at}."*
  - `under_review` — *"A verification check could not be completed. This is a process state and implies nothing about the company. Last successfully checked: {last_verified_at}."*
  - `disputed` — *"A registry record published before this statement was accepted appears to contradict it. Under review."*
- Method line: *"Confirmed from an address at the company's domain; the representative holds the registry-recorded position stated; their authority to make this statement was reviewed by {reviewer} on {reviewed_at}."*
- Standing disclaimer: *"Mapa Societario records who made this statement and that their authority was reviewed. It does not verify their identity, and it does not certify that the statement is true."*

Never *"was accurate when made"*, never *"as of right now"*, never *"identity verified"*.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/verify/grant.test.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/verify/grant.js src/verify/grant.test.js functions/verificacion/
git commit -m "feat(verify): grant-gated attestation read, 404 on every invalid grant"
```

---

### Task 13: The acceptance screen

**Files:**
- Create: `src/components/VerificationConfirmPage.jsx`
- Modify: `src/App.jsx` (add the route, following the existing `AlertActivatePage` registration)

**Interfaces:**
- Consumes: `GET /api/verify/session`, `POST /api/verify/draft`, `POST /api/verify/submit`.

Modelled on `src/components/AlertActivatePage.jsx`, which already handles the token-in-query pattern, its ES/EN copy split, and its failure states.

- [ ] **Step 1: Build the screen**

Route `/verificacion/confirmar` (ES) and `/en/verification/confirm` (EN). States: `loading → reviewing → submitting → received | failed | stale`.

On mount, `GET /api/verify/session?t=`, then render the company name, the matched seat, and one row per fact with three controls: **confirm**, **correct** (revealing a text field), **not applicable**.

Editing any fact calls `POST /api/verify/draft` and replaces the held `draft_hash` — the screen always displays a draft the server has persisted, never a locally assembled one.

Three explicit checkboxes, all required: authority to make the statement, consent to publication, and agreement to respond to reconfirmation requests.

**The privacy notice renders beside the submit button, not behind a link** (spec §9.5): what is kept, for how long, and how to ask for erasure.

- [ ] **Step 2: Handle the 409**

A `409` from submit means the registry moved between drafting and acceptance. Replace the draft with the one in the response and show: *"The registry record changed while you were reviewing. Here is the updated statement — please check it again before accepting."* Never submit the old hash.

- [ ] **Step 3: Success copy**

*"Received. Your statement is under review and is not yet published."* The word *verified* must not appear.

- [ ] **Step 4: Verify in a real Pages runtime**

`/verificacion/*` are Pages Functions, so `vite dev` cannot serve them — it returns "No routes matched", which is expected and not a bug:

```bash
npm run build
npx wrangler pages dev dist --port 5173
```

Port matters for CORS. Walk the full path with a token from the invite endpoint.

- [ ] **Step 5: Commit**

```bash
git add src/components/VerificationConfirmPage.jsx src/App.jsx
git commit -m "feat(verify): representative acceptance screen with server-persisted drafts"
```

---

### Task 14: Attestation #1, end to end

**Files:** none created — this is the vertical slice running against the real deployment.

- [ ] **Step 1: Provision**

```bash
npx wrangler d1 execute mapasocietario-verify --remote --file migrations/0002_verification.sql
npx wrangler r2 bucket create mapasocietario-verify-evidence
# Bounded, and ONLY on the sealed prefix. The personal prefix must stay
# erasable, so it gets no lock rule at all (spec §9.3).
npx wrangler r2 bucket lock add mapasocietario-verify-evidence \
  --name sealed-5y --prefix evidence/sealed/ --retention-days 2100
```

Set `VERIFY_ADMIN_TOKEN` and confirm `INTERNAL_API_KEY` in the Pages project secrets.

- [ ] **Step 2: Confirm the lock landed on the right prefix**

```bash
npx wrangler r2 bucket lock list mapasocietario-verify-evidence
```

Expected: exactly one rule, prefix `evidence/sealed/`, 2100 days. **If a rule covers `evidence/personal/`, remove it** — a lock there obstructs erasure for as long as it is active.

- [ ] **Step 3: Issue the invitation**

```bash
curl -sX POST https://mapasocietario.es/api/verify/invite \
  -H "authorization: Bearer $VERIFY_ADMIN_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"group_key":"H:M-566914","declared_name":"Alessandro Nürnberg",
       "email":"anurnberg@nurnbergconsulting.com","claimed_role":"Administrador único",
       "representation_basis":"sole_admin",
       "identification_note":"Own company; operator is the sole administrator",
       "email_domain_basis":"Operator controls nurnbergconsulting.com"}' | jq
```

Expected: `ok: true`, a seat matching `NURNBERG ALESSANDRO / ADM. UNICO / 2013-10-16`, and a `confirm_url`.

- [ ] **Step 4: Walk the representative's path**

Open the `confirm_url`. Confirm each fact, **deliberately correct one** to exercise the edit path, tick the three declarations, read the privacy notice as a first-time reader would, and submit.

- [ ] **Step 5: Prove the guarantees hold, rather than assuming they do**

```bash
# Replay the same link. Expect 200 with the SAME attestation id — not a duplicate,
# not an error. This is the UNIQUE(invitation_id) constraint doing its job.
curl -sX POST https://mapasocietario.es/api/verify/submit \
  -H 'content-type: application/json' \
  -d "{\"t\":\"$TOKEN\",\"draft_hash\":\"$DRAFT_HASH\"}" | jq

# Exactly one attestation, and exactly two evidence objects.
npx wrangler d1 execute mapasocietario-verify --remote \
  --command "SELECT id, status, accepted_at, expires_at FROM attestations"
npx wrangler r2 object list mapasocietario-verify-evidence --prefix evidence/
```

- [ ] **Step 6: Review and publish**

Fetch the queue, read the diff (the corrected fact should stand out), then approve with your own name as `reviewer`. Confirm `expires_at` is **180 days after `accepted_at`**, not after `approved_at`.

- [ ] **Step 7: Issue a grant and read it**

```bash
# The valid grant renders.
curl -s "https://mapasocietario.es/verificacion/g/$GRANT" -I | head -20
# A wrong token must 404, never 403.
curl -s "https://mapasocietario.es/verificacion/g/notarealtoken" -o /dev/null -w '%{http_code}\n'
```

Expected on the valid one: `200`, plus `x-robots-tag: noindex, nofollow, noarchive`, `cache-control: private, no-store`, `referrer-policy: no-referrer`. On the invalid one: `404`.

- [ ] **Step 8: Read the page as a stranger would**

The final gate is editorial, and it is the one that matters most. Read every sentence against the Global Constraints. If any line claims identity was verified, that the statement is true, that anything is immutable, or that the status holds "right now" — fix the copy before anyone else sees it.

- [ ] **Step 9: Commit the run**

```bash
git commit --allow-empty -m "chore(verify): attestation #1 completed end to end"
```

---

## Plan B (not this plan)

Reconciliation cron worker with the event-date/publication-date classifier and the three-day inconclusive threshold; `/empresa` badge migration off `_confirmations.js` with short TTL and purge-on-transition; the two-lane timeline; the admin UI; retirement of `check-confirmations.mjs` from `prebuild`.
