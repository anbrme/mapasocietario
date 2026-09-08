/**
 * Resolve renamed companies before they are grouped onto graph nodes.
 *
 * The expand-officer payload carries only `company_name` — no alias field — so
 * "is this the old spelling of a company already on the canvas?" costs one
 * autocomplete probe per distinct name. For a person that is a handful of
 * calls. For an audit firm or a corporate administrador it is hundreds:
 * ERNST & YOUNG SL holds seats at 199 distinct companies.
 *
 * Awaiting them one at a time made that 199 × ~0.5s ≈ 93 SECONDS of dead air
 * on a double-click. Chunked parallel probing is the whole point of this
 * module. The cap is deliberate and must stay: the API rate-limits per IP and
 * bans bursts, so this is bounded concurrency, never a full fan-out.
 */

/** Probes in flight at once. Bounded — see the module note on bursts. */
export const ALIAS_LOOKUP_CHUNK = 10;

/**
 * Build the old-name → new-name map for a set of company names.
 *
 * @param {Iterable<string>} names       Company names, any case; blanks ignored.
 * @param {object}   options
 * @param {Function} options.lookup      name → Promise<{ suggestions }>, i.e.
 *                                       spanishCompaniesService.autocompleteCompanies.
 * @param {number}   [options.chunkSize] Probes in flight at once.
 * @param {Function} [options.onProgress] (done, total) after each chunk, and
 *                                       once with (0, total) before the first.
 * @returns {Promise<Map<string,string>>} UPPERCASE old name → UPPERCASE new name.
 */
export async function buildCompanyAliasMap(names, options = {}) {
  const { lookup, chunkSize = ALIAS_LOOKUP_CHUNK, onProgress } = options;

  const targets = [
    ...new Set(
      [...(names || [])]
        .map(name => (name || '').trim().toUpperCase())
        .filter(Boolean)
    ),
  ];

  const aliases = new Map();
  if (targets.length === 0) return aliases;

  const total = targets.length;
  onProgress?.(0, total);

  for (let i = 0; i < total; i += chunkSize) {
    await Promise.allSettled(
      targets.slice(i, i + chunkSize).map(name => probeOne(name, lookup, aliases))
    );
    onProgress?.(Math.min(i + chunkSize, total), total);
  }

  return aliases;
}

/**
 * One probe. A failure here is never fatal — an unresolved alias costs a
 * duplicate node, a thrown error costs the entire expansion.
 */
async function probeOne(name, lookup, aliases) {
  try {
    const result = await lookup(name);
    // Autocomplete matches by prefix, so the row for "ACME SL" can be
    // "ACME SL DOS" — a different company. Only an exact hit is this entity.
    const match = (result?.suggestions || []).find(
      s => (s.name || '').trim().toUpperCase() === name
    );
    if (!match) return;

    if (match.has_new_name && match.new_company_name) {
      // The name we asked under is the OLD one.
      aliases.set(name, match.new_company_name.trim().toUpperCase());
    } else if (match.is_alias && match.original_name) {
      // The name we asked under is the NEW one; map its predecessor onto it.
      aliases.set(match.original_name.trim().toUpperCase(), name);
    }
  } catch {
    // Non-fatal by design — see above.
  }
}
