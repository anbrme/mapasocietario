// The situation report's footer links back with the companies it drew:
// /app?c=<groupKey>|<name>&c=…&since=YYYY-MM-DD&source=sitrep[&watch=1].
// Names travel with the keys because the company loader needs one.
export const RETURN_COMPANY_CAP = 12;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const parseReturnParams = search => {
  const p = new URLSearchParams(search || '');
  const companies = p.getAll('c').map(v => {
    const i = v.indexOf('|');
    if (i < 1) return null;
    const groupKey = v.slice(0, i).trim();
    const name = v.slice(i + 1).trim();
    return groupKey && name ? { groupKey, name } : null;
  }).filter(Boolean).slice(0, RETURN_COMPANY_CAP);
  const since = ISO_DAY.test(p.get('since') || '') ? p.get('since') : null;
  return { companies, since, watch: p.get('watch') === '1' };
};
