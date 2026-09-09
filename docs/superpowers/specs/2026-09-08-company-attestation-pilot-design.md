# Company Attestation Pilot — Design

**Date:** 2026-09-08
**Status:** Design approved; this is the build target
**Supersedes (in scope):** [2026-06-28 Company Currency Confirmation](./2026-06-28-company-currency-confirmation-design.md) — that document's thesis stands unchanged; its Phase 1 hand-authored implementation is replaced by the record model below.
**Amended by:** [2026-09-09 Verification Request Front Door](./2026-09-09-verification-request-front-door-design.md) — reverses the "self-serve claim flow" line of §12 below, on the grounds that an inbound *request* grants no authority. Nothing else in this document is changed.
**Related:** [[project_company_context_layer]], [[project_anonymous_monitoring_signup]] (the token flow this mirrors), [[project_api_rate_limit_shared_bucket]] (why the cron worker must send `X-Internal-Key`), [[user_analyst_not_salesman]]

---

## 1. What we are building, in one sentence

A dated, attributable company attestation — displayed beside an immutable BORME history that may later diverge from it — whose representation basis is established when it is made and re-checked on a schedule thereafter, and whose evidence is retained under a tamper-evident, externally checkpointed audit trail.

We record **who made a specific, dated statement, that they held the registry-recorded position stated, and that their authority to make it was reviewed by a named person on a stated date.** We do not verify their identity, and we do not certify that the statement is true. Every surface must say so in those terms (§4.1).

## 2. Why the prototype cannot simply be extended

The June implementation (`functions/empresa/_confirmations.js`, `_confirmation.js`, `scripts/check-confirmations.mjs`) proved the rendering and the decay. It cannot carry a pilot, for six reasons:

1. **The badge overstates the evidence.** The record says `verification: 'registry-officer-match'` while the page says *"La empresa confirma"*. Nothing recorded shows the company affirmed anything.
2. **Claims bind to a slug.** A rename, a duplicate name or a slug collision could attach an attestation to the wrong company. Slugs are lossy by construction (`nameToSlug` folds `ñ`→`n`, `&`→`y`) and are not globally unique.
3. **Authority is checked only at build time.** A cessation published on a Tuesday leaves a false badge standing until the next deploy.
4. **The officer matcher is too permissive.** `nameIsOfficer` accepts a representative whose tokens are a *subset* of a longer officer name, so "Alessandro Nürnberg" matches any officer whose name contains those tokens. It binds to a string, not to a seat.
5. **Affirmed facts are presentation strings.** With no field identity, registry snapshot or prior value, a later contradiction cannot be *detected* — only noticed by a human reading the page.
6. **There is no lifecycle and no enforced trail.** Removing a confirmation requires editing code and redeploying; `reviewer`/`evidenceRef` are checked for presence, never for existence.

## 3. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Assurance tier at launch | Email-confirmed + manual review only | Credibility comes from the record's structure, not from cryptography |
| Certificate signing | Deferred, but designed for | Adding QES later must cost one verifier, not a migration |
| Onboarding | Concierge (hand-issued invitations) | For ~12 known companies, a self-serve claim flow adds the entire "who may claim this page" attack surface for no pilot value |
| Backend | Pages Functions + new `VERIFY_DB` (D1) | `functions/feedback.js` already sends mail from a Pages Function via Cloudflare's Email Sending REST API; no dependency on `api.ncdata.eu` |
| Identity binding | Internal `subject_id`; `group_key`/NIF/hoja are versioned *mappings* | `group_key` can change under entity reassembly, so it cannot be a primary key |
| Scheduling | Separate cron Worker | Pages Functions have no scheduled handler |
| Facts attested | representation, officers, address, insolvency, NIF; VAT and operational status as labelled declarations that change no status | Each fact carries its own check source and its own consequence; see §5.4 |
| Cadence | fresh ≤ 90d from **acceptance**, nudge at 75d, amber to 180d, expired after | Statement age runs from the representative's acceptance, never from the operator's approval. Narrows the June design's 90/365 window |
| Pilot visibility | `VERIFY_VISIBILITY=private`, viewer grants, `noindex` | Retain control until launch; the gate is a flag, not an architecture |
| Deliverable | Attestation permalink as the core resource | The badge, the PDF and a counterparty API are all projections of it |
| Who may attest | An **attester** holding registry-recorded representation power; a **preparer** may assemble it | LSC art. 233 — board membership alone confers no individual representation (§4.3) |

## 4. Assurance — what we may and may not claim

### 4.1 What each verification method actually proves

| Method | Mailbox control | Person's identity | Representation power | Truth of claims |
|---|---|---|---|---|
| Corporate-domain magic link | Yes | No | No | No |
| + match to an active `officers_active` seat | Yes | No | Only that *someone of that name* holds a registry position | No |
| + reviewer independently identifies the person | Yes | To the standard the reviewer records | Within the recorded scope (§4.3) | No |
| Representative certificate (QES) | Irrelevant | Strongly | Strongly, within certificate scope | No |
| Subsequent BORME publication | No | No | Historical registered event | May confirm or contradict |

Two claims the earlier draft made and this one does not: matching a name to an officer row **does not identify the person**, and holding a registry position **does not by itself confer power to represent the company**. The public wording is therefore: *the representative named below holds the registry-recorded position stated, and their authority to make this statement was reviewed on <date> by <reviewer>*. Never "identity verified", never "authority verified" unqualified.

### 4.2 The immutability ladder — with its limits stated

The audit chain is **tamper-evident, not tamper-proof**:

1. **Append-only by convention (D1).** Weakest. Anyone with database access can rewrite a row and recompute the chain.
2. **Evidence under an R2 bucket lock.** Protects against deletion and overwriting **while the rule is configured**. Cloudflare's own wording is "until the lock is explicitly removed" — a sufficiently privileged administrator can remove the protection. It defends against accident and against a compromised worker; it does not defend against the account owner. Because the rule is removable, it is also **bounded rather than indefinite**, and applied only to the sealed prefix — see §9.3 for why an indefinite lock is incoherent rather than merely disproportionate.
3. **An external anchor for the chain head.** Publishing the head hash on our own endpoint anchors nothing, because we control that endpoint. The anchor is only worth what its *independent retention* is worth. For the pilot: the daily head is mailed to a mailbox on a provider we do not operate, retained there, and the documented verification procedure is to compare a claimed history against those retained checkpoints. The **anchoring interval is up to 24 hours**, so a tamper within the current day is outside its protection. The strong version — an RFC 3161 qualified timestamp — is deferred.

External wording says *tamper-evident, with daily external checkpoints*. It never says *immutable*, and it never implies the operator cannot alter the store.

### 4.3 Representation scope (LSC art. 233)

Spanish law distinguishes: a **sole administrator** represents the company alone; **joint-and-several administrators** each represent alone; **joint administrators** must act together (in an SL, at least two, per the bylaws); a **board** represents collegially, with individual power only where delegated (consejero delegado); an **apoderado** represents within the scope of a recorded power.

Consequences for the pilot:

- The attestation records a `representation_basis` — one of `sole_admin`, `joint_several_admin`, `delegated_board_member`, `apoderado` — established by the reviewer, not inferred from the position string alone.
- **Joint administrators (`administradores mancomunados`) are excluded from the pilot.** They must act together, so an honest attestation needs two attesters on one assertion, and a two-attester flow is not worth building for twelve companies. The invite endpoint refuses them with that reason rather than accepting a single signature that would misstate the law.
- An `apoderado` attestation must record the scope of the power relied on, and is presented as narrower on the public page.
- The reviewer must record **how the person was independently identified** (a video call, a known prior relationship, a document seen) as free text. It is weak evidence; leaving it blank is weaker, and undocumented is worst.

**Open tension (§14.1):** the natural pilot contact — a compliance officer at a large company — is usually not an officer of record. The design therefore separates the **attester** (holds representation power; named on the attestation) from the **preparer** (assembles the submission; recorded as evidence, never as authority). Whether large-company attesters will engage at all is the pilot's central commercial risk, and it is a question the pilot exists to answer.

## 5. Data model

New D1 database `VERIFY_DB`, deliberately separate from `SEO_DB`: identity evidence deserves a smaller operational and privacy blast radius than page-demand counters.

### 5.1 Identity

```sql
-- Our own permanent identity. Registry identifiers are MAPPINGS, not keys.
CREATE TABLE subjects (
  subject_id     TEXT PRIMARY KEY,        -- internal, permanent, never reused
  display_name   TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subject_identifiers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id   TEXT NOT NULL REFERENCES subjects(subject_id),
  kind         TEXT NOT NULL CHECK (kind IN ('group_key','nif','hoja','slug')),
  value        TEXT NOT NULL,
  valid_from   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_to     TEXT,                      -- NULL = current
  note         TEXT
);
CREATE INDEX idx_subject_identifiers_lookup ON subject_identifiers(kind, value, valid_to);
```

A `group_key` that changes under entity reassembly closes one mapping row and opens another; attestations are untouched because they never referenced it. An **ambiguous merge** — one `group_key` resolving to two subjects, or vice versa — raises a review item and blocks reconciliation for that subject rather than guessing.

### 5.2 People and invitations

```sql
CREATE TABLE claimants (
  id                   TEXT PRIMARY KEY,
  subject_id           TEXT NOT NULL REFERENCES subjects(subject_id),
  declared_name        TEXT NOT NULL,
  email                TEXT NOT NULL,
  claimed_role         TEXT NOT NULL,
  representation_basis TEXT CHECK (representation_basis IN
                         ('sole_admin','joint_several_admin',
                          'delegated_board_member','apoderado')),
                         -- joint (mancomunados) omitted deliberately: see §4.3
  identification_note  TEXT,              -- HOW the reviewer identified the person
  email_domain_basis   TEXT NOT NULL,     -- HOW the domain was tied to the company
  role                 TEXT NOT NULL DEFAULT 'attester'
                         CHECK (role IN ('attester','preparer')),
  created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invitations (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,       -- never the token itself
  claimant_id TEXT NOT NULL REFERENCES claimants(id),
  subject_id  TEXT NOT NULL REFERENCES subjects(subject_id),
  expires_at  TEXT NOT NULL,              -- 72h
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 5.3 Draft assertions and attestations

The representative accepts a **specific, persisted version** of the statement. The draft exists before acceptance so that what they saw is recoverable, and so submission can reference it by hash.

```sql
CREATE TABLE draft_assertions (
  hash              TEXT PRIMARY KEY,     -- sha256 of canonical_json
  invitation_id     TEXT NOT NULL REFERENCES invitations(id),
  subject_id        TEXT NOT NULL REFERENCES subjects(subject_id),
  canonical_json    TEXT NOT NULL,        -- EXACTLY what was rendered for acceptance
  registry_snapshot TEXT NOT NULL,        -- the read this draft was built from
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  superseded_by     TEXT REFERENCES draft_assertions(hash)
);

CREATE TABLE attestations (
  id                   TEXT PRIMARY KEY,  -- unguessable, public
  subject_id           TEXT NOT NULL REFERENCES subjects(subject_id),
  claimant_id          TEXT NOT NULL REFERENCES claimants(id),
  invitation_id        TEXT NOT NULL UNIQUE REFERENCES invitations(id),
                       -- UNIQUE is the enforcement: a second submission for the
                       -- same invitation FAILS the insert, which rolls the batch
                       -- back. An UPDATE matching zero rows would not (§6.4).
  method               TEXT NOT NULL CHECK (method IN ('email-confirmed','qes-signed')),
  status               TEXT NOT NULL CHECK (status IN
                         ('pending_review','rejected','live','outdated',
                          'under_review','disputed','expired','revoked','superseded')),
  representation_basis TEXT NOT NULL,
  seat_officer_name    TEXT,              -- the officers_active row matched
  seat_position        TEXT,
  seat_appointed_date  TEXT,
  identity_snapshot    TEXT NOT NULL,     -- group_key/NIF/hoja/name AS OF acceptance
  assertion_hash       TEXT NOT NULL REFERENCES draft_assertions(hash),
  registry_snapshot    TEXT NOT NULL,     -- as of ACCEPTANCE, not of approval
  sealed_key           TEXT NOT NULL,     -- R2 key, evidence/sealed/ (locked)
  sealed_hash          TEXT NOT NULL,
  personal_key         TEXT,              -- R2 key, evidence/personal/ (unlocked)
  personal_hash        TEXT,
  accepted_at          TEXT NOT NULL,     -- representative accepted; age runs from HERE
  expires_at           TEXT NOT NULL,     -- accepted_at + 180d, set at acceptance
  last_verified_at     TEXT,              -- last SUCCESSFUL check; displayed publicly
  consecutive_inconclusive INTEGER NOT NULL DEFAULT 0,
  approved_at          TEXT,              -- operator published it; NOT the age anchor
  reviewer             TEXT,              -- published (see §8); accountability, by design
  reviewed_at          TEXT,
  decision_note        TEXT,
  status_reason        TEXT,
  last_checked_at      TEXT,
  superseded_by        TEXT REFERENCES attestations(id)
);

CREATE UNIQUE INDEX idx_attestations_live
  ON attestations(subject_id) WHERE status = 'live';

-- At most one CURRENT record per subject, whatever its status. This is what
-- forces an approval to supersede the incumbent even when the incumbent is
-- outdated or disputed — otherwise a stale record could later compete with
-- its own successor.
CREATE UNIQUE INDEX idx_attestations_current
  ON attestations(subject_id)
  WHERE status IN ('live','outdated','under_review','disputed','expired');
```

`expires_at` is written **once**, at acceptance. Approval never recomputes it. This removes the double definition the first draft carried.

### 5.4 Facts, and what each one may cause

```sql
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
  check_source            TEXT NOT NULL CHECK (check_source IN
                            ('borme','vies','none')),
  last_checked_at         TEXT,
  last_check_outcome      TEXT CHECK (last_check_outcome IN
                            ('consistent','superseded_by_later_event',
                             'contradicted_at_issue','pending_publication','inconclusive'))
);
```

| Fact | Source | Consequence of an adverse check |
|---|---|---|
| `representation` | borme | seat gone → `outdated` |
| `officers` | borme | see the classification rule below |
| `address` | borme | see the classification rule below |
| `insolvency` | borme | `is_in_concurso` becomes true → `outdated` (a new fact, not a lie) |
| `nif` | borme | mismatch against `enriched_nif` → `under_review`, never automatic |
| `vat_intraeu` | vies | **never changes status.** Rendered as "intra-EU VAT registration checked on <date>" |
| `operational` | none | **never checked.** Rendered explicitly as an unverifiable declaration |

**Classification rule — event date is not publication date.** BORME carries both, and the difference decides whether a divergence is an accusation or a fact of life:

| The contradicting event was… | Outcome | Status |
|---|---|---|
| **published before** acceptance | it was visible in the snapshot we took, so the declaration contradicted evidence in front of us | `contradicted_at_issue` → **disputed** |
| **dated before** acceptance but **published after** | invisible to us and to the registry at the time; possible misstatement, but unprovable from our data | `inconclusive` → **under_review** |
| **dated after** acceptance | the world changed; the statement is simply no longer current | `superseded_by_later_event` → **outdated** |

Only the first row may ever be presented as an integrity concern.

**Inconclusive checks do not act on first occurrence.** An unreachable API would otherwise flip every attestation at once. An inconclusive result records the outcome and increments `consecutive_inconclusive`; only at **three consecutive days** does the attestation move to `under_review`. Throughout, the page shows `last_verified_at` — the last *successful* check — which is what a reader actually needs.

Two corrections from the review are load-bearing here. **VIES tests registration for intra-EU trade, not NIF validity** — a legitimate Spanish company not enrolled in the ROI returns invalid, and our own NIF crawler verified only 34% of real companies through VIES. Using it as a suspension trigger would have suspended most of the pilot. And **`is_dissolved = false` does not establish that a company trades**, so `operational` carries no check source at all and is labelled as a declaration.

**Corrected facts.** A `corrected` declaration ("we moved on 20 September, pending publication") is an unverified forward claim. It is compared against the *declared* value, never against the registry-at-issue value — otherwise a manually approved correction would be marked `disputed` by the next cron run. It renders visually distinct from a confirmed fact, with an age: *claimed 20 Sep, not yet published as of <today>*. Prolonged silence is itself signal.

### 5.5 Audit trail

```sql
CREATE TABLE audit_events (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  attestation_id TEXT,
  subject_id     TEXT,
  action         TEXT NOT NULL,
  actor          TEXT NOT NULL,
  detail         TEXT,                    -- JSON, PRIVATE
  public_summary TEXT,                    -- nullable; only these are ever public
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  prev_hash      TEXT NOT NULL,
  hash           TEXT NOT NULL
);

-- Concurrency control for the chain: two writers racing against the same head
-- collide here instead of forking the chain. The loser retries against the new head.
CREATE UNIQUE INDEX idx_audit_events_prev_hash ON audit_events(prev_hash);

CREATE TABLE chain_anchors (
  day          TEXT PRIMARY KEY,
  head_seq     INTEGER NOT NULL,
  head_hash    TEXT NOT NULL,
  published_at TEXT NOT NULL,
  dispatched_to TEXT                      -- the externally retained checkpoint
);
```

The genesis row uses `prev_hash` of 64 zeros. The unique index is what makes concurrent appends safe without a lock.

### 5.6 Grants

```sql
CREATE TABLE view_grants (
  token_hash     TEXT PRIMARY KEY,
  attestation_id TEXT NOT NULL REFERENCES attestations(id),
  label          TEXT,                    -- an operator note, NOT an identity
  issued_by      TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     TEXT,
  revoked_at     TEXT,
  access_count   INTEGER NOT NULL DEFAULT 0,   -- link accesses, not viewers
  last_access_at TEXT
);
```

### 5.7 Lifecycle

```
invited → draft accepted → pending_review → { rejected | live }
live → { outdated | under_review | disputed | expired | revoked }
under_review → { live | disputed | revoked }      (reviewer or a successful check)
outdated  → under_review                          (reviewer only, e.g. an erratum)
any current state → superseded                    (a successor is approved)
```

Two things the earlier draft conflated. **Availability is not integrity**, so the single `suspended` state splits; and **recovery is not reconfirmation**, so nothing returns to `live` by ageing.

- **outdated** — a later registry event has moved past the statement. It is **not fit for current reliance**, and no wrongdoing is implied. It never returns to `live` on its own: only a reviewer may move it to `under_review` (an erratum or a corrected filing), and only a *new* attestation can restore a live record.
- **under_review** — a check could not be completed, or a reviewer is examining something. This is an **availability or process** state, not an accusation, and the public wording must not read as one. It returns to `live` when a check succeeds.
- **disputed** — an **integrity** concern: the declaration contradicts registry evidence that was visible when it was accepted (§5.4). It never auto-recovers; only a reviewer moves it to `live` (the check was wrong) or `revoked`.
- **rejected** — never published; visible to the submitter with a reason (§14.3).
- **expired**, **revoked** — terminal for reliance.
- **superseded** — set when a successor is approved. Approval demotes **whatever the current record is — live, outdated, under_review, disputed or expired** — and promotes the successor, in one `batch()`. `idx_attestations_current` enforces this: without the demotion the insert fails and the batch rolls back.

**A reconfirmation is always a new attestation.** It never revives an old one. The old record keeps its status and history for the audit lane.

Reconciliation scans every current state, not just `live` — otherwise nothing could recover or expire once it left it.

**Privacy by construction.** `claimants.email`, `identification_note`, `audit_events.detail` and evidence keys live only in tables the public projection never reads. The public lane reads `audit_events.public_summary` and nothing else.

### 5.8 Seat matching (replaces `nameIsOfficer`)

Authority attaches to a **row in `officers_active`**, not to a name string. Matching requires rotation-aware normalised equality of the full token set (`NURNBERG ALESSANDRO` ≡ `ALESSANDRO NURNBERG`), accent- and punctuation-insensitive. Subset matches are rejected. A match is a *necessary* condition for inviting an attester; it is never sufficient (§4.3).

### 5.9 Canonical assertion

A draft is built **before** acceptance, so it cannot contain the acceptance time or an expiry derived from it — including them would change the hash at the moment of acceptance and break accept-by-hash. The statement and the act of accepting it are therefore two records.

**The assertion** — deterministic JSON, sorted keys, fixed number and date formats — over: a `nonce`, the `drafted_at` timestamp, the identity snapshot, the matched seat and `representation_basis`, every declared fact with value and status, the registry-snapshot digest, the consent statements, and the **validity rule** (`"valid_for_days": 180`) as a rule rather than a computed date. Its SHA-256 is the `draft_assertions` primary key, and it is the value a future qualified signature signs.

**The acceptance receipt** — a separate record holding the assertion hash, the actual `accepted_at`, the `expires_at` computed from it by applying the rule, and the acceptance method. The receipt is what the audit chain records; the assertion hash never moves.

## 6. Flow and endpoints

**A constraint that shapes this:** Pages Functions have no scheduled handler, so reconciliation lives in `workers/verification-reconciler`, alongside `workers/analytics`, bound to `VERIFY_DB`. It **must** send `X-Internal-Key` — the API rate limiter keys on the nginx loopback address, so an unkeyed batch job consumes the site-wide per-worker bucket and takes the public site down with it.

**1 — Issue (operator).** `POST /api/verify/admin/invite`, guarded by `VERIFY_ADMIN_TOKEN`. The server resolves or creates the subject, reads the live company, matches the attester to an `officers_active` seat, and **refuses if no seat matches**. The operator additionally records `representation_basis`, `identification_note` and `email_domain_basis` — none of which the system can infer. Creates claimant and invitation; mails the link.

For the pilot, **only the attester receives an invitation and accepts**. A preparer, where one exists, is recorded from operator input as evidence of how the submission was assembled; they never hold a token and never accept an assertion. Giving the preparer their own flow is deferred until a pilot company actually needs one.

**2 — Prepare the draft.** `GET /api/verify/session?t=` reads the registry, builds the canonical assertion, **persists it as a `draft_assertions` row**, and returns it with its hash. The form renders exactly that draft.

**2b — Edit.** Corrections are not a client-side detail: a representative who changes a fact is no longer accepting the draft they were served. `POST /api/verify/draft` takes the edited facts, **persists a new `draft_assertions` row**, marks the prior one `superseded_by` it, and returns the new hash. The form then renders the new draft. Acceptance always references a persisted draft that was rendered in full — never a client-assembled payload.

**3 — Accept.** `POST /api/verify/submit` carries the draft hash. The server re-reads the registry and compares:

- **No material change** → proceed.
- **Material change** → respond **409** with a *new* draft (the old one marked `superseded_by`) for fresh acceptance. The representative is never bound to a statement they did not see.

This is the reverse of the first draft's rule, which re-read at submit time and called the result "what they saw". It was not.

**4 — Persist, in an order that survives partial failure.** Writes span R2 and D1, and D1's `batch()` is a SQL transaction that cannot enclose an R2 write. Two mechanisms carry the guarantees:

*Single acceptance per invitation is enforced by a constraint, not by a row count.* `attestations.invitation_id` is `UNIQUE`, so a second submission's **insert fails**, and a failing statement is what rolls a D1 batch back. A conditional `UPDATE ... WHERE used_at IS NULL` would not: an update matching zero rows is a *successful* statement in SQLite, so the batch would commit the rest. `invitations.used_at` is written in the same batch, but as a record of what happened — never as the enforcement.

*The two evidence objects are written create-if-absent.* Both keys derive from the draft hash, so a retry addresses the same objects:

1. `evidence/sealed/<hash>.json` and `evidence/personal/<hash>.json` are written with a conditional put (`onlyIf: { etagDoesNotMatch: '*' }`). If an object already exists, **read it and verify its digest** against the expected value: matching means a previous attempt got this far and we continue; not matching is a hard error that aborts the submission and raises an alert, because it means something wrote a different body under a hash-derived key.
2. One D1 `batch()`: insert the attestation (whose `UNIQUE invitation_id` is the gate), its facts, `invitations.used_at`, and the audit events.

Failure handling: a crash between (1) and (2) leaves orphan evidence objects, harmless and swept periodically; the representative retries the same link and step (1) verifies rather than rewrites. A crash inside (2) rolls the batch back entirely, so the link still works. **A retry after a successful commit returns the existing attestation** — the same id, HTTP 200 — rather than an error, because from the representative's side the submission did succeed.

**Approval re-reads both evidence objects and verifies their digests before publishing.** An attestation whose evidence is missing or altered cannot go live.

The response says **received, under review**. Never *verified*.

**5 — Review (operator).** `GET /api/verify/admin/queue` renders declared values beside registry values with differences highlighted. `POST /api/verify/admin/decide` approves or rejects with a reason, verifies the evidence, and — on approval — demotes any incumbent and promotes the new record in one `batch()`. There is no second reviewer at pilot size; the safeguard is that the approval is an audit-logged act naming the reviewer with the approved diff recorded.

**6 — Read.** `GET /verificacion/g/<grant_token>` returns HTML to a browser and JSON to a machine from the same record (§7).

**7 — Reconcile (cron).** Daily over every current state (`live`, `outdated`, `under_review`, `disputed`, `expired`). For each fact the outcome is one of `consistent`, `superseded_by_later_event`, `contradicted_at_issue`, `pending_publication` or **`inconclusive`**, classified by the event-date/publication-date rule in §5.4. An unreachable API, a missing officer row, or an ambiguous subject mapping yields `inconclusive`, which increments `consecutive_inconclusive` and escalates to `under_review` only at three — it **never** proves a contradiction. A successful check sets `last_verified_at` and resets the counter. The job also nudges at 75 days, expires at 180, and publishes the daily chain anchor to its externally retained destination.

## 7. Pilot visibility

A single switch, `VERIFY_VISIBILITY` (`private` | `public`), defaulting to `private`. Flipping it at launch changes no code.

**Viewer grants, not a password wall.** In `private`, an attestation is reachable only through `/verificacion/g/<grant_token>`, issued by the operator with a note, an expiry and a revoke. The grant token *is* the address. An unknown, expired or revoked grant returns **404, not 403** — a 403 confirms the record exists.

**What a grant actually measures.** A grant records **accesses through that link** — nothing more. Links get forwarded; email scanners and link previewers fetch them unprompted. A grant labelled "Banco X" does not establish that Banco X read anything, and no surface, internal or external, may describe it as if it did.

Handling for token-bearing URLs: `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, and **excluded from analytics entirely** — a token in a URL must never reach GA4 or any log we query casually.

**Badges are gated too.** In `private`, the `/empresa` panel renders only for subjects on an explicit allowlist (initially Nürnberg Consulting, already public).

**No indexing:** `X-Robots-Tag: noindex, nofollow, noarchive` on every `/verificacion/*` response; `Disallow: /verificacion/` in robots.txt; absent from every sitemap; no link from any indexed page while `private`.

**Accepted limitation:** the pilot cannot test whether a *public* badge drives behaviour. Public visibility needs hundreds of companies to measure anyway.

## 8. Public surfaces

**`/empresa/<slug>` badge.** Reads the live attestation from D1 instead of `_confirmations.js`. These pages carry `s-maxage=86400`, so a status change would otherwise keep asserting itself for a day: pages carrying an attestation get a short TTL, *and* any status transition purges that page.

*Information hierarchy, revised 2026-09-09.* The badge as first built opened with the hedge rather than the fact — a category-name heading, then *"Esta declaración se aceptó el X y era coherente con la evidencia registral comprobada en ese momento"*, then two further caveats at near-equal weight. Four hedged paragraphs to convey one event. It now leads with a plain claim whose grammatical **subject is always the company** — *"La empresa confirmó el 2026-09-09 que estos datos registrales seguían vigentes"* — so the sentence cannot be misread as us certifying anything, and the caveats move into a demoted `detail` block. **Nothing is dropped:** `statusLine` is still carried verbatim from `src/verify/render.js` into `detail`, so the badge and the attestation permalink still cannot drift on the load-bearing wording.

*The registry gap.* The badge also states the distance between the last BORME filing and the confirmation — *"Última publicación en el BORME: 2014-03-27 — 12 años antes de la confirmación."* This is the one thing neither the registry data nor the attestation says on its own, and on a company whose registry record is a decade old it is the most informative line on the page. Suppressed below one year (a gap of months is ordinary and says nothing) and suppressed entirely when the registry moved *after* the confirmation — that is a supersession, which the status already carries, and rendering it as a gap would invert its meaning.

Dates on the badge stay ISO. The reader is a foreign professional, for whom `2026-09-09` is unambiguous where `09/09/2026` is not, and mixing formats between the claim and the small print reads worse than either used consistently.

**The attestation page.** Leads with **fitness for current reliance, qualified by when it was last successfully checked** — never "as of right now", which a daily job cannot support. It states this separately from what the statement itself was, because the two are different things.

The wording must not assert accuracy we never established. An `outdated` attestation reads:

> *"This statement was accepted on 8 September and was consistent with the registry evidence checked at that time. A subsequent registry event records a change of address on 20 September. The statement should no longer be treated as current. Last successfully checked: 7 October."*

Not *"was accurate when made"* — we never established that. Throughout, prefer **"consistent with the registry evidence checked"** over any phrasing that implies verified truth.

Below it, a four-column fact table: declared / registry at acceptance / registry today / outcome. Corrected facts render distinctly, with their unpublished age.

**Two-lane timeline.** Registry filings (`/bormes/v3/events?group_key=`) against attestations (D1) on one time axis. Inline SVG, theme-aware in light and dark.

**Reviewer naming — the contradiction resolved.** The first draft both promised to publish "reviewed by a named person" and to never expose reviewer names. The resolution: **the reviewer is named publicly, deliberately.** The reviewer is the operator accepting accountability for the decision, which is the point. The redaction rule covers claimant email addresses, `identification_note`, `audit_events.detail`, evidence keys and grant tokens — and the property test asserts exactly that set, with `reviewer` explicitly excluded from it.

**Copy discipline.** The method line states what happened, in words: *confirmed from an address at the company's domain; the representative holds the registry-recorded position stated; their authority to make this statement was reviewed by <reviewer> on <date>*. We do not claim to have verified their identity, and we do not certify that the statement is true. ES and EN, mirroring `CONFIRMATION_I18N`.

**Attestation #1 is Nürnberg Consulting**, run through the new flow — it closes the honesty gap in the current live record and dogfoods the representative's experience.

## 9. Data retention and erasure

The audit chain verifies over **hashes, not content**. Evidence can therefore be redacted or deleted later and the chain still verifies: what is lost is the ability to *show* what the evidence was, not the ability to prove nothing was substituted in its place. Retention is consequently a policy decision, not an architectural constraint.

### 9.1 Two evidence prefixes

The parts of an evidence bundle carry very different risk, so they are stored separately and hashed into the chain separately.

- **`evidence/sealed/<hash>.json`** — the canonical assertion, the registry snapshot, timestamps, method, and the attester's name and position. The name and position are **already public in BORME**; this records an act, it does not create exposure. Bucket-locked for the retention term.
- **`evidence/personal/<hash>.json`** — email address, `identification_note`, and any transport artefacts. **Not locked.** Erasable.

Redacting the personal half leaves the sealed half fully verifiable.

### 9.2 Terms

| Tier | Content | Term |
|---|---|---|
| Attestation record (public projection) | name, role, dates, facts, status history | Life of the service |
| Sealed evidence | assertion, registry snapshot, timestamps | Attestation expiry **+ 5 years** |
| Personal evidence | email, `identification_note` | Same term, but erasable on request |
| Transport artefacts | IP, user agent, headers | **None collected by default**; 12 months if a specific fraud reason arises |

**Why five years:** Art. 1964 CC sets five years for personal actions, reduced from fifteen by the 2015 reform. It is a **proposed policy anchored on** that period, not a claim to match the litigation window precisely — accrual and interruption (Art. 1973 CC) both move the real boundary, so no fixed retention term can track it exactly. The value of the anchor is that it ties the term to the risk it exists to answer rather than to convenience. Código de Comercio art. 30 (six years, books and correspondence) is the alternative anchor if counsel prefers the commercial-records framing. **The reasoning is proposed; the term is pending counsel sign-off (§14.2), which must land before any external participant submits.**

### 9.3 The bucket lock must be bounded

The earlier draft specified `--retention-indefinite` on `evidence/`. Stating the objection precisely, because the first revision overstated it: §4.2 already establishes that a privileged administrator can remove a lock rule, so an indefinite lock never made erasure *impossible*. What it did was make erasure require **dismantling the retention guarantee for every object under the prefix** in order to delete one — trading the whole protection for a single request, which is incoherent rather than merely disproportionate.

A bounded lock obstructs deletion too, for as long as it is active. That is acceptable for sealed evidence, whose retention is the point, and unacceptable for personal evidence, which must stay erasable. So the rule covers **only `evidence/sealed/`**, with `--retention-days` set to the term plus the maximum attestation life (retention runs from object creation, and an attestation lives up to 180 days) — roughly 2,100 days for the five-year option. **`evidence/personal/` carries no lock rule at all.**

### 9.4 Erasure

**Hashes, stated correctly.** Replacement bytes hash differently — a redacted object cannot "keep its hash". What is preserved is the **original digest, already committed to the audit chain** at submission time. Redaction is recorded as its own audit event, naming the original digest and the deletion, so the chain still proves that the evidence which existed was not swapped for something else. It cannot prove what that evidence said, and the spec must not imply otherwise.

**Erasure and restriction must reach every store, not just one R2 object.** A request touches D1 (`claimants.email`, `identification_note`), `draft_assertions` (which embed declared values), `audit_events.detail`, both R2 prefixes, and any backup. The architecture must therefore support:

- **Restriction** (GDPR Art. 18) as a first-class state — processing paused, record retained, public projection withdrawn — distinct from deletion.
- **Redaction** at field level in D1, not only object deletion in R2.
- **Withdrawal of the public projection** independently of the underlying record.

**On refusing erasure of the public record.** The earlier draft asserted flatly that it is not erased. That overstates the position. A name already public in BORME **remains personal data**, and attributing a new statement to someone adds information beyond their registry position. Legitimate-interest processing is subject to objection (Art. 21) and erasure (Art. 17), whose exceptions must be *assessed* case by case rather than assumed. The design's position is that the record's integrity purpose weighs heavily — but it is a position to be argued, not a default, and it is part of what §14.2 puts to counsel.

### 9.5 Notice

The privacy notice appears **on the acceptance screen itself, beside the button** — not behind a link. Someone attesting to their own company's data should see what is kept, and for how long, at the moment they decide.

## 10. Testing

**Structural constraint:** vitest only scans `src/**/*.test.js` — which is why `functions/feedback.js` keeps its logic in `src/utils/`. All pure logic therefore lives in `src/verify/`, with Pages Functions as thin adapters over D1, mail and R2. Target ≥ 80%.

**Unit (written first):**
- Canonical-assertion determinism: same input → same hash, independent of key order.
- Chain append and verify, **including detection of a tampered middle row**, and two concurrent appends against one head colliding on `idx_audit_events_prev_hash`.
- Seat matching: rejects the subset case, accepts rotations, handles accents and `ñ`.
- **Check-outcome classification, against a controlled registry fixture** — the heart of the suite. Each fact × each outcome, driven by the event-date/publication-date rule: an event *published before* acceptance yields `disputed`; one *dated before but published after* yields `under_review`; one *dated after* yields `outdated`; an unreachable source or missing row yields `inconclusive`; and a `corrected` declaration compared against its declared value yields `pending_publication` rather than a contradiction.
- An inconclusive check changes no status on the first or second occurrence, and escalates to `under_review` on the third; a success resets the counter and moves `last_verified_at`.
- VIES negative never changes any status.
- **Acceptance receipt separation:** the assertion hash is identical before and after acceptance; the receipt carries `accepted_at` and the expiry derived from the assertion's `valid_for_days` rule.
- **Editing persists a new draft:** a corrected fact yields a fresh `draft_assertions` row with the prior marked superseded, and acceptance of a stale hash is refused.
- **Single acceptance per invitation is enforced by the `UNIQUE` constraint**, proven by attempting a second insert and asserting the whole batch rolls back — not by inspecting a row count.
- **Conditional evidence writes:** an existing object with a matching digest allows the submission to continue; a mismatching one aborts it.
- **Supersession demotes a non-live incumbent** — approving a successor over an `outdated` or `disputed` record succeeds, and `idx_attestations_current` rejects the insert if the demotion is omitted.
- Status decay at the 90 / 180 boundaries, anchored on `accepted_at`.
- Draft supersession: a registry change between draft and submit returns 409 with a new draft.
- Idempotent resubmission: the same draft hash twice produces one attestation and one evidence object.
- Grant validation: unknown, expired and revoked all yield 404.
- **Redaction as a property test** over generated records: no email, `identification_note`, audit `detail`, evidence key or grant token can appear in the public projection — with `reviewer` explicitly permitted.

**Integration** against local D1: invite → draft → edit → accept → review → live → later registry event → outdated → reconfirm → superseded; a contradiction-at-issue path to `disputed` and back via reviewer decision; and a submission retried after a successful commit returning the same attestation id rather than an error.

**Manual:** the full path on the operator's own company before any invitation is sent.

## 11. Rollout

1. Migration + `VERIFY_DB` created and bound.
2. Secrets (`VERIFY_ADMIN_TOKEN`, reuse `CLOUDFLARE_EMAIL_API_TOKEN`, `INTERNAL_API_KEY`); R2 bucket with a **bounded** lock rule on `evidence/sealed/` only (§9.3); the external checkpoint destination configured and confirmed receiving.
3. `src/verify/` logic with tests; Pages Functions; admin UI.
4. Cron worker deployed with `X-Internal-Key`.
5. Attestation #1 (own company) end to end; retire `_confirmations.js` and `check-confirmations.mjs`.
6. Counsel sign-off on the retention term and controller position, and the acceptance-screen privacy notice live — both **before** any external participant submits (§9, §14.2).

   **Deliberately after step 5, not before step 1.** Attestation #1 has the operator as both controller and data subject, so no third party's data is at stake and nothing needs settling to run it. Taking counsel later is also the better instruction: they can be shown a working system and the actual questions pilot companies raise, rather than asked to advise on a description. The gate is the first *external* submission — nothing earlier.
7. Three friendly companies, then the remainder. `VERIFY_VISIBILITY` stays `private` throughout.

## 12. Out of scope

- Certificate/QES signing (designed for; not built) and RFC 3161 qualified timestamping.
- PDF attestation certificates — deferred until a participant asks; that ask is the demand signal.
- Counterparty-facing lookup as a launched product (the JSON representation makes it a switch-flip later).
- Self-serve claim flow; the viewer "request a confirmation" loop; any monetisation.
- Joint administrators (`mancomunados`) and the two-attester flow they would require.
- Cl@ve. Its published onboarding targets public-sector bodies and administrative procedures.

## 13. Success criteria

Ordered by strength of evidence:

1. **A counterparty uses an attestation in an actual review and asks for an updated one.** This is the only criterion that demonstrates the product works. A request for a second grant link is encouraging but weaker.
2. ≥ 5 pilot companies complete an attestation of their own volition.
3. **Suspension and outdating are proven deterministically against a controlled registry fixture**, in the test suite — not by waiting for one of twelve companies to experience a real registry change. A real-world transition is welcome confirmation, never the gate.
4. Attestation #1 completes end to end, and the live Nürnberg record no longer claims more than its evidence supports.

## 14. Open questions

1. **Whether large-company attesters will engage at all.** The pilot contact (a compliance officer) usually holds no representation power, so every attestation needs an attester with real authority to sign off. This is the central commercial risk; the attester/preparer split (§4.3) is the design's answer, not a resolution.
2. **Counsel sign-off on §9**: the five-year term (Art. 1964 CC) versus the six-year commercial-records anchor (CCom art. 30), who acts as controller for the attestation record, and confirmation that the public record's legitimate-interest basis survives an erasure request. Gates external participation.
3. Whether a rejected attestation is visible to its submitter, and in what words. Current assumption: yes, with a reason — refusing to say why is worse.
4. The external checkpoint destination and its retention: which mailbox, held by whom, and who can be asked to produce it.
