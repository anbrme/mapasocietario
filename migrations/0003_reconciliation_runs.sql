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
