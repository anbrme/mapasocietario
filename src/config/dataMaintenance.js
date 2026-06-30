export const DATA_MAINTENANCE = Object.freeze({
  enabled: true,
  title: 'Index fix in progress to target a misspelling (a whitespace in the company\'s suffix) in the BORME source documents which was not being handled correctly. As a result, companies acting as officers acould see the suffix wrongly displayed in the search results and in the graph. Fixed, re-indexing and backfill are in progress.',
  message:
    'Company and officer search remains available while we upgrade the index in the background. Some results may be incomplete or briefly delayed during the upgrade.',
});

const INDEX_UNAVAILABLE_PATTERNS = [
  'index_not_found_exception',
  'index not found',
  'no such index',
  'search_phase_execution_exception',
];

export const isDataIndexUnavailableError = error => {
  if (!error) return false;

  const status = Number(error.status);
  if ([502, 503, 504].includes(status)) return true;

  const detail = `${error.message || ''} ${error.responseBody || ''}`.toLowerCase();
  return INDEX_UNAVAILABLE_PATTERNS.some(pattern => detail.includes(pattern));
};
