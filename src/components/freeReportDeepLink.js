// The `free=1` deep link from a company page into the due diligence page.
//
// The company page tells an arrival that their first report is free; the
// checkout dialog used to make them discover that themselves, behind a
// checkbox under the price. This pair of helpers lets the page carry the
// intent through: the due diligence page reads the parameter and the dialog
// opens with the free option already selected. The backend eligibility check
// is untouched — a second request from the same email still falls back to the
// paid form.

const TRUTHY = new Set(['1', 'true']);

export const parseFreeReportParam = value => (
  typeof value === 'string' && TRUTHY.has(value.trim().toLowerCase())
);

export const initialFreeReportState = ({ requested, programActive, isAndroidApp }) => (
  !!requested && !!programActive && !isAndroidApp
);
