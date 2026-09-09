const API_BASE = 'https://api.ncdata.eu';

// Strip vowel diacritics (á→a, é→e, í→i, ó→o, ú→u, ü→u) but PRESERVE ñ/Ñ.
// Naive NFD-strip decomposes ñ → n + combining tilde, dropping the tilde and
// breaking Spanish company names like Peñarroya. We protect ñ/Ñ with sentinels.
function normalizeQuery(q) {
  return q
    .replace(/ñ/g, '\x00n\x00').replace(/Ñ/g, '\x00N\x00')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\x00n\x00/g, 'ñ').replace(/\x00N\x00/g, 'Ñ');
}

export async function resolveCompany(query, { fetchImpl = fetch } = {}) {
  const q = normalizeQuery((query || '').trim());
  if (q.length < 2) return [];
  try {
    const url = `${API_BASE}/bormes/companies/directory/autocomplete?q=${encodeURIComponent(q)}&limit=8`;
    const res = await fetchImpl(url, { method: 'GET' });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.suggestions || []).map((s) => ({
      id: s.id,
      name: s.company_name,
      location: s.province || s.city || null,
      nif: s.nif || null,
      isAlias: Boolean(s.is_alias),
      formerName: s.original_name || null,
      newName: s.new_company_name || null,
      // The live directory returns no province/city/nif, so the date of the
      // last BORME filing is the one disambiguator two same-named rows have.
      lastFiling: s.last_updated || null,
    }));
  } catch {
    return [];
  }
}

function shapeOfficer(o) {
  return {
    name: o.name || o.name_normalized || '',
    position: o.position_normalized || o.position || '',
    appointedDate: o.appointed_date || null,
    resignedDate: o.resigned_date || null,
  };
}

export async function getCompany(id, { fetchImpl = fetch } = {}) {
  const key = (id || '').trim();
  if (!key) return null;
  try {
    const url = `${API_BASE}/bormes/v3/search?group_key=${encodeURIComponent(key)}&size=10`;
    const res = await fetchImpl(url, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    const doc = (data.results || []).find(
      (r) => (r._id || r.id || r.group_key || '').trim() === key
    );
    if (!doc) return null;
    return {
      groupKey: key,
      name: doc.company_name || doc.company_name_normalized || '',
      nif: doc.nif || doc.enriched_nif || null,
      capital: doc.current_capital ?? doc.capital ?? doc.enriched_capital ?? null,
      address: doc.current_address || doc.enriched_address || doc.address || null,
      status: doc.is_dissolved ? 'dissolved' : 'active',
      identifiers: doc.identifiers || [],
      officersActive: (doc.officers_active || []).map(shapeOfficer),
      officersResigned: (doc.officers_resigned || []).map(shapeOfficer),
      firstSeen: doc.first_seen || null,
      lastSeen: doc.last_seen || null,
      nameChanges: (doc.name_changes || []).map((x) => ({ date: x.date || null, from: x.old_name || '', to: x.new_name || '' })),
      capitalHistory: (doc.capital_history || []).map((x) => ({ date: x.date || null, amount: x.amount ?? null })),
      addressHistory: (doc.address_history || []).map((x) => ({ date: x.date || null, address: x.address || '' })),
    };
  } catch {
    return null;
  }
}
