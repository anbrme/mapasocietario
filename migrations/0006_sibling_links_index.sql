-- Sibling links on company pages (functions/empresa/_demand.js
-- listPromotedSiblings) read the promoted rows of one province ordered by
-- canonical_name, twice per uncached render. Without this the query walks
-- every promoted row and sorts in a temp B-tree; with it the walk is an index
-- range scan in the right order. Partial on promoted rows, like the others.
CREATE INDEX IF NOT EXISTS idx_company_index_candidates_promoted_province_name
  ON company_index_candidates(province, canonical_name)
  WHERE status = 'promoted';
