-- VERIFY_DB - inbound requests from companies asking to be verified.
-- Spec: docs/superpowers/specs/2026-09-09-verification-request-front-door-design.md
--
-- A request GRANTS NOTHING: it is a lead. The path to an invitation runs
-- through the operator, who records representation_basis, identification_note
-- and email_domain_basis by hand - none of which the system can infer. This
-- table is strictly UPSTREAM of /api/verify/admin/invite and touches nothing in
-- the trust model, the audit chain or the reconciliation loop.
--
-- contact_email is a CANDIDATE contact, never an automatic recipient of an
-- invitation token. The operator confirms the address and records why that
-- domain belongs to that company, exactly as before.
CREATE TABLE verification_requests (
  id            TEXT PRIMARY KEY,
  company_query TEXT NOT NULL,          -- exactly what they typed
  nif           TEXT,
  contact_name  TEXT NOT NULL,
  contact_role  TEXT NOT NULL,          -- their position in the company
  contact_email TEXT NOT NULL,
  referrer_note TEXT,                   -- who prompted them: the demand signal
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN
                  ('new','contacted','invited','ineligible','declined','spam')),
  subject_id    TEXT REFERENCES subjects(subject_id),  -- set when resolved
  invitation_id TEXT REFERENCES invitations(id),       -- set when converted
  operator_note TEXT,
  -- ISO 8601, to match requestRetentionCutoff()'s format. CURRENT_TIMESTAMP
  -- would emit "YYYY-MM-DD HH:MM:SS", whose ' ' sorts before the cutoff's 'T'
  -- and purges boundary-day rows up to a day early.
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT
);

CREATE INDEX idx_verification_requests_status
  ON verification_requests(status, created_at);

-- The 90-day purge of spam/ineligible rows scans by date across statuses.
CREATE INDEX idx_verification_requests_created_at
  ON verification_requests(created_at);
