export const DATA_MAINTENANCE = Object.freeze({
  enabled: true,
  title: 'A major index upgrade is in progressand is expected to last for 36-40 hours. We recommend you do not buy a due diligence until this notice disappears.',
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
