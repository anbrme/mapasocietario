CREATE TABLE IF NOT EXISTS company_index_candidates (
  group_key TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  province TEXT,
  hoja TEXT,
  nif TEXT,
  search_render_count INTEGER NOT NULL DEFAULT 0,
  full_profile_click_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'promoted', 'rejected')),
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  promoted_at TEXT,
  validated_at TEXT
);

-- Slug is NOT globally unique: nameToSlug is lossy ("ñ"→"n", "&"→"y") and a
-- company can exist on several hojas, so two distinct group_keys can produce
-- one slug. Only one of them may own the indexable URL, so uniqueness is
-- enforced over PROMOTED rows only — a plain UNIQUE column would instead throw
-- on the second candidate's very first upsert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_index_candidates_promoted_slug
  ON company_index_candidates(slug)
  WHERE status = 'promoted';

CREATE INDEX IF NOT EXISTS idx_company_index_candidates_status_promoted
  ON company_index_candidates(status, promoted_at)
  WHERE status = 'promoted';

CREATE TABLE IF NOT EXISTS company_demand_events (
  dedupe_key TEXT PRIMARY KEY,
  group_key TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('search_rendered', 'full_profile_click')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_key) REFERENCES company_index_candidates(group_key)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_demand_events_group_type
  ON company_demand_events(group_key, event_type, created_at);

-- Per-caller daily budget for POST /api/company-demand. Checked before any
-- upstream BORME request so an unauthenticated caller cannot use this endpoint
-- to amplify traffic against api.ncdata.eu.
CREATE TABLE IF NOT EXISTS company_demand_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_company_demand_rate_limits_day
  ON company_demand_rate_limits(day);
