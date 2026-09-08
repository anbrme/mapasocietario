-- VERIFY_DB — company attestation pilot.
-- Spec: docs/superpowers/specs/2026-09-08-company-attestation-pilot-design.md
--
-- Two constraints in here are load-bearing rather than defensive:
--   attestations.invitation_id UNIQUE  — the ONLY thing preventing a replayed
--     invitation link from creating a second attestation. A conditional
--     "UPDATE ... WHERE used_at IS NULL" does NOT work: an update matching zero
--     rows is a SUCCESSFUL statement in SQLite, and D1 rolls a batch back only
--     when a statement FAILS. The failing INSERT is the mechanism.
--   idx_attestations_current — forces an approval to supersede whatever the
--     incumbent is (live, outdated, under_review, disputed or expired), so a
--     stale record can never compete with its own successor.

CREATE TABLE subjects (
  subject_id   TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Registry identifiers are MAPPINGS, never keys: group_key changes under entity
-- reassembly, which would otherwise re-point or orphan an attestation.
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

-- joint_admin_pair is absent on purpose: mancomunados must act together, so a
-- single signature would misstate LSC art. 233. Excluded, not approximated.
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

-- The exact statement rendered for acceptance. Persisted BEFORE acceptance so
-- what the representative saw is recoverable, and so submission can reference
-- it by hash rather than by a client-assembled payload.
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
  -- Statement age runs from acceptance, never from approval. expires_at is
  -- written ONCE here and never recomputed at review time.
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
CREATE INDEX idx_attestation_facts_attestation ON attestation_facts(attestation_id);

-- Append-only and hash-chained. NEVER UPDATE, NEVER DELETE: a status change is
-- a new row. `detail` is private; `public_summary` is the ONLY public lane.
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
-- Two writers racing against the same head collide here instead of forking the
-- chain; the loser retries against the new head.
CREATE UNIQUE INDEX idx_audit_events_prev_hash ON audit_events(prev_hash);

-- access_count counts LINK ACCESSES, not viewers: links get forwarded, and
-- email scanners fetch them unprompted. No surface may describe it otherwise.
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
CREATE INDEX idx_view_grants_attestation ON view_grants(attestation_id);

CREATE TABLE chain_anchors (
  day           TEXT PRIMARY KEY,
  head_seq      INTEGER NOT NULL,
  head_hash     TEXT NOT NULL,
  published_at  TEXT NOT NULL,
  dispatched_to TEXT
);
