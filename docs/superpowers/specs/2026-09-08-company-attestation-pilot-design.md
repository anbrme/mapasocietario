# Company Attestation Pilot — Design

**Date:** 2026-09-08
**Status:** Design approved; this is the build target
**Supersedes (in scope):** [2026-06-28 Company Currency Confirmation](./2026-06-28-company-currency-confirmation-design.md) — that document's thesis stands unchanged; its Phase 1 hand-authored implementation is replaced by the record model below.
**Related:** [[project_company_context_layer]], [[project_anonymous_monitoring_signup]] (the token flow this mirrors), [[project_api_rate_limit_shared_bucket]] (why the cron worker must send `X-Internal-Key`), [[user_analyst_not_salesman]]

---

## 1. What we are building, in one sentence

A dated, attributable company attestation — displayed beside an immutable BORME history that may later contradict it — whose authority is checked at the time it is made *and* on a schedule thereafter, and whose evidence is retained under a tamper-evident, externally anchored audit trail.

We verify **who made a specific, dated statement and that they held registry-recorded authority when they made it.** We do not certify that the statement is true. Every surface must say so in those terms.

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
| Identity binding | `group_key` + NIF + hoja | The slug is a URL and is recorded as history only |
| Scheduling | Separate cron Worker | Pages Functions have no scheduled handler |
| Facts attested | officers, address, insolvency, active, **NIF** | NIF is the one fact with an independent non-BORME check (VIES) |
| Cadence | fresh ≤ 90d, nudge at 75d, amber to 180d, expired after | Matches the quarterly rhythm the pilot is sold on. Narrows the June design's 90/365 window: a year-old statement is not "aging", it is out of date |
| Pilot visibility | `VERIFY_VISIBILITY=private`, viewer grants, `noindex` | Retain control until launch; the gate is a flag, not an architecture |
| Deliverable | Attestation permalink as the core resource | The badge, the PDF and a counterparty API are all projections of it |

## 4. Assurance and immutability — what we may claim

### 4.1 What each verification method actually proves

| Method | Mailbox control | Person's identity | Legal authority | Truth of claims |
|---|---|---|---|---|
| Corporate-domain magic link | Yes | Weakly | No | No |
| + match to an active BORME officer seat | Yes | Partially | Probabilistically | No |
| + named human review | Yes | Partially | Probabilistically, recorded | No |
| Representative certificate (QES) | Irrelevant | Strongly | Strongly, within certificate scope | No |
| Subsequent BORME publication | No | No | Historical registered event | May confirm or contradict |

No method establishes truth. The product's honesty depends on never implying one does.

### 4.2 The immutability ladder

The audit chain is **tamper-evident, not tamper-proof**, and the difference must be stated rather than glossed:

1. **Append-only by convention (D1).** Weakest. Anyone with database access can rewrite a row and recompute the chain.
2. **Evidence under an R2 bucket lock.** Real and enforced: locked objects cannot be deleted or overwritten until retention expires (`wrangler r2 bucket lock add <bucket> --prefix evidence/ --retention-indefinite`).
3. **An external anchor for the chain head.** Closes the gap in (1). The daily head hash is published to a dated endpoint and mailed out of the system. The strong version — an RFC 3161 qualified timestamp — is deferred and pairs naturally with the certificate tier.

The pilot builds 1, 2, and 3 in its cheap form. External communication says *tamper-evident and externally anchored*, never *immutable*.

## 5. Data model

New D1 database `VERIFY_DB`, deliberately separate from `SEO_DB`: identity evidence deserves a smaller operational and privacy blast radius than page-demand counters.

```sql
CREATE TABLE subjects (
  group_key      TEXT PRIMARY KEY,
  nif            TEXT,
  hoja           TEXT,
  canonical_name TEXT NOT NULL,
  slug_at_issue  TEXT,                    -- history, never a key
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE claimants (
  id                 TEXT PRIMARY KEY,
  group_key          TEXT NOT NULL REFERENCES subjects(group_key),
  declared_name      TEXT NOT NULL,
  email              TEXT NOT NULL,
  claimed_role       TEXT NOT NULL,
  email_domain_basis TEXT NOT NULL,       -- HOW the domain was tied to the company
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invitations (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,       -- never the token itself
  claimant_id TEXT NOT NULL REFERENCES claimants(id),
  group_key   TEXT NOT NULL REFERENCES subjects(group_key),
  expires_at  TEXT NOT NULL,              -- 72h
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attestations (
  id                  TEXT PRIMARY KEY,   -- unguessable, public
  group_key           TEXT NOT NULL REFERENCES subjects(group_key),
  claimant_id         TEXT NOT NULL REFERENCES claimants(id),
  method              TEXT NOT NULL CHECK (method IN ('email-confirmed','qes-signed')),
  status              TEXT NOT NULL CHECK (status IN
                        ('pending_review','live','suspended','expired','revoked','superseded')),
  seat_officer_name   TEXT,               -- the officers_active row matched
  seat_position       TEXT,
  seat_appointed_date TEXT,
  registry_snapshot   TEXT NOT NULL,      -- JSON, captured at SUBMIT time
  assertion_canonical TEXT NOT NULL,      -- the exact bytes the representative agreed to
  assertion_hash      TEXT NOT NULL,      -- sha256 hex of the above
  evidence_key        TEXT NOT NULL,      -- R2 object key, locked prefix
  evidence_hash       TEXT NOT NULL,
  submitted_at        TEXT NOT NULL,
  confirmed_at        TEXT,               -- set on approval
  expires_at          TEXT,               -- confirmed_at + 180d
  reviewer            TEXT,
  reviewed_at         TEXT,
  suspended_reason    TEXT,
  superseded_by       TEXT REFERENCES attestations(id)
);

-- At most one live attestation per company.
CREATE UNIQUE INDEX idx_attestations_live
  ON attestations(group_key) WHERE status = 'live';

CREATE TABLE attestation_facts (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  attestation_id          TEXT NOT NULL REFERENCES attestations(id),
  fact_key                TEXT NOT NULL CHECK (fact_key IN
                            ('officers','address','insolvency','active','nif')),
  declared_status         TEXT NOT NULL CHECK (declared_status IN
                            ('current','none','corrected','not_applicable')),
  declared_value          TEXT,
  registry_value_at_issue TEXT,
  check_source            TEXT NOT NULL CHECK (check_source IN ('borme','vies')),
  last_checked_at         TEXT,
  last_check_result       TEXT CHECK (last_check_result IN
                            ('consistent','contradicted','unverifiable'))
);

-- Append-only, hash-chained. Never UPDATE, never DELETE.
CREATE TABLE audit_events (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  attestation_id TEXT,
  group_key      TEXT,
  action         TEXT NOT NULL,
  actor          TEXT NOT NULL,
  detail         TEXT,                    -- JSON, PRIVATE
  public_summary TEXT,                    -- nullable; only these are ever public
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  prev_hash      TEXT NOT NULL,
  hash           TEXT NOT NULL
);

CREATE TABLE view_grants (
  token_hash     TEXT PRIMARY KEY,
  attestation_id TEXT NOT NULL REFERENCES attestations(id),
  label          TEXT,                    -- "Banco X, onboarding"
  issued_by      TEXT NOT NULL,           -- 'admin' | 'company'
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     TEXT,
  revoked_at     TEXT,
  view_count     INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT
);

CREATE TABLE chain_anchors (
  day          TEXT PRIMARY KEY,
  head_seq     INTEGER NOT NULL,
  head_hash    TEXT NOT NULL,
  published_at TEXT NOT NULL
);
```

**Privacy by construction.** Personal data (`claimants.email`, `audit_events.detail`, `reviewer`) lives only in tables the public projection never reads. The public lane reads `audit_events.public_summary` and nothing else — safer than filtering at render time, and it keeps a subject-access request from becoming an incident.

### 5.1 Lifecycle

```
invited → submitted → pending_review → live → { suspended | expired | revoked | superseded }
```

- **suspended** — automatic, reversible; set by reconciliation on a contradiction.
- **revoked** — manual, terminal.
- **superseded** — a reconfirmation never overwrites; the prior record survives with `superseded_by` set, so the history of what was said and when stays intact.

Because `idx_attestations_live` permits only one live attestation per company, approving a reconfirmation MUST demote the incumbent to `superseded` and promote the new record **in a single transaction**. A non-atomic approval either violates the index or leaves the company momentarily unverified.

### 5.2 Seat matching (replaces `nameIsOfficer`)

Authority attaches to a **row in `officers_active`**, not to a name string. Matching requires rotation-aware normalised equality of the full token set (`NURNBERG ALESSANDRO` ≡ `ALESSANDRO NURNBERG`), accent- and punctuation-insensitive. Subset matches are rejected. The matched row's name, position and appointed date are stored on the attestation, and reconciliation later checks *that seat*, not the name.

### 5.3 Canonical assertion

A deterministic JSON serialisation — sorted keys, fixed number and date formats, explicit `nonce`, `issued_at`, `expires_at` — over: subject identity (`group_key`, NIF, hoja, canonical name), the matched seat, every declared fact with its value and status, the registry snapshot digest, and the consent statements. Its SHA-256 is `assertion_hash`.

This is the object a qualified signature will later sign. Designing it now is what makes the certificate tier an added verifier rather than a migration.

## 6. Flow and endpoints

**1 — Issue (operator).** `POST /api/verify/admin/invite`, guarded by `VERIFY_ADMIN_TOKEN`. Body: `group_key`, representative name, email, claimed role, `email_domain_basis`. The server reads the live company via `/bormes/v3/company?group_key=`, matches the representative to an `officers_active` seat, and **refuses if no seat matches**. Creates subject, claimant and invitation; mails the link.

**2 — Confirm (representative).** `/verificacion/confirmar?t=…` (ES) and `/en/verification/confirm?t=…`, modelled on `AlertActivatePage`. `GET /api/verify/session?t=` returns a **fresh** registry read plus the matched seat. Each fact is presented for review — confirm, correct, or mark not applicable — followed by three declarations: that they hold the stated authority, that they consent to publication, and that they will respond to reconfirmation requests. The token authorises exactly one submission for exactly one company.

**3 — Submit.** `POST /api/verify/submit`. Re-reads the registry *at submit time* so the snapshot is what they saw; builds and hashes the canonical assertion; writes the attestation `pending_review`; writes the evidence bundle to the locked R2 prefix; appends audit events; burns the token. The response says **received, under review** — never *verified*.

**4 — Review (operator).** `GET /api/verify/admin/queue` renders declared values beside registry values with differences highlighted, so review is a comparison rather than a reading. `POST /api/verify/admin/decide` approves or rejects with a reason. Approval publishes and sets `expires_at`, demoting any incumbent live attestation to `superseded` in the same transaction (§5.1). There is no second reviewer at pilot size; the safeguard is that approval is itself an audit-logged act naming the reviewer with the approved diff recorded.

**5 — Read.** `GET /verificacion/g/<grant_token>` returns HTML to a browser and JSON to a machine from the same record. See §7 for the visibility gate.

**6 — Reconcile (cron).** `workers/verification-reconciler`, daily, bound to `VERIFY_DB`. For every live attestation: the matched seat still in `officers_active`; `current_address` unchanged; `is_in_concurso` false; `is_dissolved` false; NIF still valid at VIES. Any contradiction suspends the attestation, records the reason, writes a `public_summary`, purges the affected `/empresa` page, and mails the company and the operator. Also: nudge at 75 days, expire at 180, publish the daily chain anchor.

**The reconciler MUST send `X-Internal-Key`.** The API rate limiter keys on the nginx loopback address, so an unkeyed batch job consumes the site-wide per-worker bucket and takes the public site down with it.

## 7. Pilot visibility

A single switch, `VERIFY_VISIBILITY` (`private` | `public`), defaulting to `private`. Flipping it at launch changes no code.

**Viewer grants, not a password wall.** In `private`, an attestation is reachable only through `/verificacion/g/<grant_token>`, issued by the operator (later by the company) with a label, an expiry and a revoke. The grant token *is* the address, so the attestation id never travels separately. An unknown, expired or revoked grant returns **404, not 403** — a 403 confirms the record exists.

This is preferred over Cloudflare Access for the public surface because it matches the real workflow (the company forwards the attestation to one named counterparty), needs no allowlist maintenance, and records who was shown what and when — the demand signal the eventual "who checked you this week" loop needs. Access *is* the right gate for `/admin/verificacion`.

**Badges are gated too.** In `private`, the `/empresa` panel renders only for `group_key`s on an explicit allowlist (initially Nürnberg Consulting, already public). Otherwise a pilot company's badge would be world-visible while its permalink was gated.

**No indexing:** `X-Robots-Tag: noindex, nofollow, noarchive` on every `/verificacion/*` response; `Disallow: /verificacion/` in robots.txt; absent from every sitemap; no link from any indexed page while `private`; grant links carry `noreferrer`.

**Accepted limitation:** the pilot cannot test whether a *public* badge drives behaviour. It tests the better question — whether a compliance officer handed a grant link finds the attestation credible and asks for the next one. Public visibility needs hundreds of companies to measure anyway.

## 8. Public surfaces

**`/empresa/<slug>` badge.** Reads the live attestation from D1 instead of `_confirmations.js`. These pages carry `s-maxage=86400`, so a suspended attestation would keep asserting itself for a day: pages carrying an attestation get a short TTL, *and* any status transition purges that page. A badge that can lie for 24 hours after a cessation is the precise failure this product exists to prevent.

**The attestation page.** Leads with **status as of right now**, then the statement, the representative and matched seat, the date, and the method in full words. Below it a three-column fact table: declared / registry at the time / registry today. Divergence is the interesting column and must be visible rather than inferred.

**Two-lane timeline.** Registry filings (`/bormes/v3/events?group_key=`) against attestations (D1) on one time axis, with a suspension drawn where the lanes contradict. This is the product's thesis rendered literally. Inline SVG, theme-aware in light and dark.

**Admin** at `/admin/verificacion` behind Cloudflare Access: review queue as a diff, decide, grant issue/revoke, audit export, chain verification.

**Copy discipline.** The method line states what happened, in words: *confirmed from an address at the company's domain; representative matched to an active BORME officer seat; reviewed by a named person on <date>*. The standing disclaimer keeps its current shape — we verify the representative's authority, not the truth of each statement. ES and EN, mirroring `CONFIRMATION_I18N`.

**Attestation #1 is Nürnberg Consulting, run through the new flow.** It closes the honesty gap in the current live record and forces the operator through the representative's experience before any external company sees it.

## 9. Testing

**Structural constraint:** vitest only scans `src/**/*.test.js` — which is why `functions/feedback.js` keeps its logic in `src/utils/`. All pure logic therefore lives in `src/verify/` (canonicalisation, hashing, chain, seat matching, fact comparison, status decay, redaction), with Pages Functions as thin adapters over D1, mail and R2. Files stay small; coverage stays real. Target ≥ 80%.

**Unit (written first):**
- Canonical-assertion determinism: same input → same hash, independent of key order.
- Chain append and verify, **including detection of a tampered middle row**.
- Seat matching: rejects the subset case, accepts rotations, handles accents and `ñ`.
- Fact comparison: each of the five facts produces the correct suspension.
- Status decay at the 90 / 180 boundaries.
- Grant validation: unknown, expired and revoked all yield 404.
- **Redaction as a property test** over generated records: no email address, reviewer name or evidence reference can ever appear in the public projection.

**Integration** against local D1: invite → submit → review → live → contradicting registry event → suspended → reconfirm → superseded.

**Manual:** the full path on the operator's own company before any invitation is sent.

## 10. Rollout

1. Migration + `VERIFY_DB` created and bound.
2. Secrets (`VERIFY_ADMIN_TOKEN`, reuse `CLOUDFLARE_EMAIL_API_TOKEN`, `INTERNAL_API_KEY`); R2 bucket created and lock rule applied to `evidence/`.
3. `src/verify/` logic with tests; Pages Functions; admin UI.
4. Cron worker deployed with `X-Internal-Key`.
5. Attestation #1 (own company) end to end; retire `_confirmations.js` and `check-confirmations.mjs`.
6. Three friendly companies to shake out copy and email deliverability.
7. Remainder of the pilot. `VERIFY_VISIBILITY` stays `private` throughout.

## 11. Out of scope

- Certificate/QES signing (designed for; not built).
- RFC 3161 qualified timestamping.
- PDF attestation certificates — deferred until a pilot participant asks; that ask is the demand signal.
- Counterparty-facing lookup as a launched product (the JSON representation makes it a switch-flip later).
- Self-serve claim flow.
- The viewer "request a confirmation" loop and any monetisation.
- Cl@ve. Its published onboarding targets public-sector bodies and administrative procedures; it is the wrong instrument here.

## 12. Success criteria

- Attestation #1 completes end to end, and the live Nürnberg record no longer claims more than its evidence supports.
- ≥ 5 pilot companies complete an attestation of their own volition.
- At least one reconciliation-driven suspension fires correctly on real registry movement — the mechanism is only proven when it kills a badge.
- At least one pilot company asks for a second grant link for a named counterparty. That is the signal that the attestation is being *used*, not merely collected.

## 13. Open questions

1. Retention period for the R2 evidence lock — indefinite, or a defined term with a documented deletion basis? Indefinite is simpler but sits awkwardly beside GDPR minimisation.
2. Lawful basis and privacy-notice wording for holding a named representative's evidence; who is controller for the attestation record.
3. Whether a rejected attestation should be visible to the company that submitted it, and in what words.
4. What happens to a live attestation when the company's `group_key` changes (entity reassembly). Reconciliation must detect it; the remedy — migrate or supersede — is undecided.
