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
