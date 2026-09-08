/**
 * The seven facts and where each is checked. Two carry deliberate limits:
 *
 * - vat_intraeu is checked against VIES, which tests registration for intra-EU
 *   TRADE, not NIF validity. A legitimate Spanish company not enrolled in the
 *   ROI returns invalid — our own NIF crawler verified only 34% of real
 *   companies this way — so it changes no status, ever (spec section 5.4).
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
    // 'none' ONLY when the registry actually reports no concurso. Hard-coding
    // it meant a company in concurso pre-filled a declaration of no insolvency
    // whose declared_value said 'concurso' - and diff.js compares values, not
    // statuses, so the reviewer's queue flagged nothing.
    declared_status:
      fact_key === 'insolvency'
        ? (registryValues.insolvency === 'concurso' ? 'current' : 'none')
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

/**
 * FINDING 2: the fields a statement is actually ABOUT.
 *
 * The drift check and `registry_snapshot_digest` must hash this, never the raw
 * upstream document: that carries `processed_at`, `enriched_at`,
 * `normalization_version` and `total_publications`, which the nightly
 * enrichment moves with no registry event at all. Hashing them meant a
 * representative who opened the link in the evening and accepted in the morning
 * was told "the registry record changed" over a byte-identical set of facts,
 * and meant the signed assertion committed to pipeline bookkeeping.
 */
export function projectRegistry(company) {
  const c = company || {};
  return {
    company_name: c.company_name ?? null,
    current_address: c.current_address ?? null,
    is_in_concurso: !!c.is_in_concurso,
    is_dissolved: !!c.is_dissolved,
    nif: c.nif || c.enriched_nif || null,
    hojas: [...(c.hojas || [])].sort(),
    officers_active: (c.officers_active || [])
      .map((o) => ({
        name: o.name || o.name_normalized || null,
        position: o.position_normalized || o.position || null,
        appointed_date: o.appointed_date || null,
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
  };
}

const DECLARED_STATUSES = new Set(['current', 'none', 'corrected', 'not_applicable']);
const MAX_DECLARED_VALUE = 500;

/**
 * FINDING 3: edits arrive from a token-facing endpoint and were previously
 * copied into the assertion verbatim, so an unknown declared_status reached a
 * CHECK-constrained column and blew up the batch AFTER the R2 evidence had been
 * written. Validate at the boundary instead.
 */
export function validateEdits(edits) {
  if (edits === undefined || edits === null) return { ok: true, value: [] };
  if (!Array.isArray(edits)) return { ok: false, reason: 'edits_not_an_array' };
  if (edits.length > FACT_KEYS.length) return { ok: false, reason: 'too_many_edits' };

  const value = [];
  for (const edit of edits) {
    if (!edit || typeof edit !== 'object') return { ok: false, reason: 'invalid_edit' };
    if (!FACT_KEYS.includes(edit.fact_key)) return { ok: false, reason: 'unknown_fact_key' };
    if (!DECLARED_STATUSES.has(edit.declared_status)) {
      return { ok: false, reason: 'invalid_declared_status' };
    }
    const raw = edit.declared_value;
    if (raw !== null && raw !== undefined && typeof raw !== 'string') {
      return { ok: false, reason: 'invalid_declared_value' };
    }
    const declared_value = typeof raw === 'string' ? raw.trim() : null;
    if (declared_value && declared_value.length > MAX_DECLARED_VALUE) {
      return { ok: false, reason: 'declared_value_too_long' };
    }
    // A correction with nothing in it is a mistake, not a statement.
    if (edit.declared_status === 'corrected' && !declared_value) {
      return { ok: false, reason: 'correction_requires_a_value' };
    }
    value.push({ fact_key: edit.fact_key, declared_status: edit.declared_status, declared_value });
  }
  return { ok: true, value };
}
