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
    declared_status:
      fact_key === 'insolvency' ? 'none'
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
