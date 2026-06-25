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
