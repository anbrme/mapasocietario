// Pure logic + rendering for the Barómetro Empresarial data story. No network, no fs.

export function latestFullYear(series) {
  const byYear = {};
  for (const { date } of series) {
    const y = Number(String(date).slice(0, 4));
    byYear[y] = (byYear[y] || 0) + 1;
  }
  const full = Object.keys(byYear).map(Number).filter((y) => byYear[y] >= 12);
  if (!full.length) throw new Error('latestFullYear: no complete year in series');
  return Math.max(...full);
}

export function pctChange(cur, prev) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

export function intEs(n) {
  return Number(n).toLocaleString('es-ES');
}

export function pctEs(p) {
  if (p == null) return '—';
  const sign = p >= 0 ? '+' : '';
  return `${sign}${p.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
