// Deep link into the web app. The group key MUST travel with the name: /app
// reads `gk` (src/App.jsx) and opens that exact company doc, whereas a bare
// `search=` re-runs a fuzzy name search and can land on a different legal
// entity that merely shares a name prefix (NURNBERG CONSULTING SL vs
// NURNBERG CONSULTING & PARTNERS SL — both is_alias:false, no name rule
// separates them). Matches carry the key from the directory autocomplete, so
// omit it only when a caller genuinely has none.
//
// `source` lands in graph_view.entry_source, which is how extension arrivals
// stay separable from direct visits; /app falls back to "direct" for anything
// that doesn't match /^[a-z0-9_]{1,40}$/.
const ENTRY_SOURCE = 'chrome_extension';

export function appSearchUrl(company) {
  const search = `search=${encodeURIComponent(company?.name || '')}`;
  const groupKey = (company?.groupKey || '').trim();
  const gk = groupKey ? `&gk=${encodeURIComponent(groupKey)}` : '';
  return `https://mapasocietario.es/app?${search}${gk}&source=${ENTRY_SOURCE}`;
}
