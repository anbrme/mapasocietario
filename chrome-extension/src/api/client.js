const API_BASE = 'https://api.ncdata.eu';

export async function resolveCompany(query, { fetchImpl = fetch } = {}) {
  const q = (query || '').trim();
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
      capital: doc.capital ?? doc.enriched_capital ?? null,
      address: doc.enriched_address || doc.address || null,
      status: doc.status || (doc.has_dissolution ? 'dissolved' : 'active'),
      identifiers: doc.identifiers || [],
      officersActive: (doc.officers_active || []).map(shapeOfficer),
      officersResigned: (doc.officers_resigned || []).map(shapeOfficer),
      firstSeen: doc.first_seen || null,
      lastSeen: doc.last_seen || null,
    };
  } catch {
    return null;
  }
}
