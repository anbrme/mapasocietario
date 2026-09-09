# Pilot Readiness — Reviewer Attribution, Badge Preview, Check Continuity

**Date:** 2026-09-09
**Status:** Design approved; this is the build target
**Amends:** [2026-09-08 Company Attestation Pilot](./2026-09-08-company-attestation-pilot-design.md) — reverses the public-reviewer decision in its §8 and adds a durable check record to its §6 step 7.
**Sequenced before:** [2026-09-09 Verification Request Front Door](./2026-09-09-verification-request-front-door-design.md). That work acquires companies an institution pushes; this work is what lets the pilot be shown to the companies already in hand.

---

## 1. Why these three together

They share one occasion: putting the pilot in front of real companies. One removes something we cannot publish, one shows a company what it gets, and one records what we did — and the third cannot be backfilled, so waiting costs history permanently.

## 2. Reviewer attribution — the organisation, not the person

### 2.1 What changes and why

The pilot design's §8 published the reviewer's personal name **deliberately**: "the reviewer is the operator accepting accountability for the decision, which is the point." `src/verify/projection.js` carries that rationale in its header comment, and two tests assert it by name (`projection.test.js`, `render.test.js`, both "publishes the reviewer, deliberately").

That reasoning was sound but it assumed a sole operator. It does not survive an employee doing the review: we would be publishing a named individual's identity on an indexed page, permanently, as a condition of their job.

**The resolution keeps the accountability and drops the exposure.** The individual is still recorded — `attestations.reviewer` is unchanged, and every approval remains an audit-logged act naming who decided. What changes is only the *public projection*, which renders a fixed organisational string.

### 2.2 The string names the legal entity

> *revisada por Nürnberg Consulting S.L., operador de Mapa Societario*

**The constant is the entity name only** — `Nürnberg Consulting S.L.` — and the surrounding sentence stays in the existing `t.method(name, date)` i18n template, so the English page reads *reviewed by Nürnberg Consulting S.L., operator of Mapa Societario* rather than inheriting Spanish prose. Splitting it the other way would put untranslated text on the EN surface.

Mapa Societario is a brand, not a legal person. "Reviewed by Mapa Societario" reads as reviewed-by-a-website; naming the S.L. names an entity with a NIF that can be held to the review, which is the accountability §8 was reaching for, preserved at organisational level. The brand is retained as the operating name so a reader who arrived via the site recognises it.

### 2.3 Changes

| File | Change |
|---|---|
| `src/verify/projection.js` | Export `PUBLIC_REVIEWER`. Replace `reviewer: attestation.reviewer` with the constant. Rewrite the header comment: `reviewer` moves **into** the redaction set |
| `src/verify/projection.test.js` | "publishes the reviewer, deliberately" **inverts**: the projection must never contain the individual's name. This flip is the enforcement |
| `src/verify/render.js:139` | Consumes `view.reviewer` from the projection, so no logic change — but the method-line test asserts the organisational string |
| `src/verify/render.test.js` | Same inversion. **Keep the XSS-escaping case** even though the value is now a constant: defence in depth costs nothing and the field could become dynamic again |
| `functions/empresa/_confirmation.js:73` | Reads `attestation.reviewer` **directly**, not through the projection. Must use the same constant, or the badge would leak the name the permalink no longer shows |

The last row is the one that would have been missed. A projection-only change leaves the badge publishing the name.

### 2.4 What is lost, stated plainly

An organisational attribution is a weaker signal than a named person: it cannot be looked up, and it carries no individual reputation. We accept that. The internal record still answers "who approved this?" and the erasure position improves — an employee's name is no longer published as a condition of their work.

## 3. Badge preview for pilot companies

### 3.1 The problem

A company deciding whether to spend a representative's time on this cannot see what it gets. Its own `/empresa` badge is gated: `isBadgeVisible()` in `functions/empresa/_attestation.js:24` renders a badge only for `PILOT_VISIBLE_GROUP_KEYS` while `VERIFY_VISIBILITY` is `private`. That gate is correct and stays.

### 3.2 A preview grant, on its own route

`view_grants` already carries a token hash, a label, an expiry, a revoke and an access count. It gains one column:

```sql
ALTER TABLE view_grants ADD COLUMN kind TEXT NOT NULL DEFAULT 'counterparty';
-- 'counterparty' | 'preview'
```

A `preview` grant unlocks the badge **for its own subject only**, at a dedicated route:

**`GET /verificacion/p/<token>`** — resolves the grant, then renders the company's real `/empresa` page with the badge forced on.

**Why a dedicated route and not `/empresa/<slug>?preview=<token>`:** `/empresa` pages carry `s-maxage=86400`. Putting a token on that path means one missed header away from a shared cache holding a badge that is not public yet. A separate route keeps every token-bearing URL inside the `/verificacion/*` family, which already applies `private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, and exclusion from analytics. The public `/empresa` handler never learns that preview tokens exist.

### 3.3 Implementation shape

`renderCompanyPage()` (`functions/empresa/_lib.js:1549`) already takes `noindex` and `attestation` as its final two parameters, so the page can be rendered with an injected attestation and no indexing. The data-fetching in `handleCompany()` (`:2358`) is what the preview route needs to reuse; it gains an options parameter carrying an attestation override and a header override, and both routes call it. `liveAttestationFor()` and `isBadgeVisible()` are **not** modified — the override is passed in, so the public gate keeps exactly one meaning.

`_lib.js` is already well past the 800-line guideline. This change does not fix that, and should not try to; extracting the company-page data fetch is a separate piece of work.

### 3.4 Rules

- A preview grant renders **only** its own subject's page. A token for company A cannot preview company B.
- The preview page carries a visible, non-dismissable banner: *vista previa — esta insignia todavía no es pública*. A screenshot of the preview must not be mistakable for the live page.
- Expiry is short by default (14 days), revocable, and the access count is subject to the same honesty rule as any grant (§7 of the pilot design): it counts **openings of a link**, never readers.
- Issued from the console beside the existing grant action, labelled distinctly.

## 4. Check continuity — a durable record of what was checked, when

### 4.1 The gap, verified

`workers/verification-reconciler/src/index.js` **overwrites** rather than appends. Line 105 sets `attestation_facts.last_check_outcome` and `last_checked_at`; line 121 sets `attestations.last_verified_at`. An `audit_events` row is written **only when the status changes** (line 125).

So a day on which every fact checks out consistent leaves **no durable trace**. The public page is unaffected — its §8 wording only ever promises "last successfully checked", which these columns support exactly. What is missing is internal: we can state a last-checked date, but we cannot show *"checked daily since 8 September, consistent every time."*

For an internal diligence record, and for answering a counterparty who asks how we know, continuity is a materially stronger thing to show than a single date.

### 4.2 A table outside the audit chain

```sql
CREATE TABLE reconciliation_runs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  attestation_id TEXT NOT NULL REFERENCES attestations(id),
  subject_id     TEXT NOT NULL REFERENCES subjects(subject_id),
  checked_at     TEXT NOT NULL,
  source_failed  INTEGER NOT NULL DEFAULT 0,  -- the upstream read failed
  outcomes       TEXT NOT NULL,               -- JSON: { fact_key: outcome }
  status_before  TEXT NOT NULL,
  status_after   TEXT NOT NULL
);
CREATE INDEX idx_reconciliation_runs_attestation
  ON reconciliation_runs(attestation_id, checked_at);
```

One row per attestation per daily run, written in the `batch()` that already runs. It records `source_failed` separately so a day the upstream API was unreachable is legible as *we could not check*, never as *we checked and found nothing wrong* — the same distinction line 121 already makes for `last_verified_at`.

**Deliberately not in `audit_events`.** That chain is a record of *acts*, and a no-op check is not one; every row also lengthens the hash chain that verification must walk. Retention is therefore independent and set at **two years**, purged by the same daily cron.

### 4.3 Rendering

`src/verify/timeline.js` already exists from the two-lane timeline work. The internal view is a third lane — registry filings, attestations, and now checks — on the console's existing attestation view. **Internal only:** a public daily-check lane invites the reading that each check independently confirmed the statement, which §4.1 of the pilot design forbids.

### 4.4 Why now rather than phase 2

**It cannot be backfilled.** Every day the table does not exist is a day of history that is never recoverable. The cost is one table and one statement inside a `batch()` that already runs; the value grows monotonically with elapsed time. Deferring it is the only decision here that gets strictly worse by waiting.

## 5. Correcting a misconception this design should record

The pilot's §9 says the audit chain "verifies over hashes, not content." That is a statement about the *chain* — it is what allows evidence to be redacted or deleted later without breaking verifiability. It is **not** a statement that content is unretained.

The system already retains, for every attestation: the full evidence bundles in R2 (`evidence/sealed/<hash>.json`, `evidence/personal/<hash>.json`); `draft_assertions.canonical_json`, which is exactly what was rendered for acceptance; `registry_snapshot` on both the draft and the attestation; per-fact declared values, registry values at issue and check sources in `attestation_facts`; and `acceptance_receipt`, `identity_snapshot` and `audit_events.detail`.

An internal record of *what a company declared and what the registry said* is therefore a rendering task over data already held. Only the **continuity of repeated checks** (§4) was genuinely missing.

## 6. Testing

| Level | Assertion |
|---|---|
| `src/verify/projection.test.js` | The projection never contains the individual reviewer's name; it contains `PUBLIC_REVIEWER`. The inverted test is the enforcement |
| `src/verify/render.test.js` | The method line names the legal entity; the XSS-escaping case is retained |
| `functions/empresa/_confirmation` | The badge's reviewed-by line uses the constant, not `attestation.reviewer` |
| Preview route | A valid preview grant renders the badge; an expired, revoked or unknown token returns **404, not 403** (§7 of the pilot design); a grant for subject A cannot render subject B; the response carries `no-store` and `noindex`; the preview banner is present |
| Reconciler | One `reconciliation_runs` row per attestation per run; `source_failed=1` on an upstream failure, and that row's outcomes are empty rather than consistent; no `audit_events` row is added when the status is unchanged |
| Purge | Rows older than two years are deleted; nothing newer is |

## 7. Out of scope

A public check-history lane (§4.3); extracting the company-page data fetch from `_lib.js` (§3.3); any change to `isBadgeVisible` or the pilot allowlist; preview links for anyone other than the subject company itself.

## 8. Open questions

1. Whether the preview grant should expire at 14 days or on the company's decision. 14 days is a guess; the first three companies will show whether it is short.
2. Whether an employee reviewer's name should also be withheld from `audit_events.detail`, or whether internal retention of it is exactly the accountability we intend to keep. Current position: retain internally.
