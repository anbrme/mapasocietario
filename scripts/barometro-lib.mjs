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

export function buildProvinceRows(curData, prevData) {
  const prev = Object.fromEntries(prevData.map((r) => [r.province, r.formations]));
  return curData
    .map((r) => ({ province: r.province, cur: r.formations, prev: prev[r.province] || 0 }))
    .map((r) => ({ ...r, pct: pctChange(r.cur, r.prev) }))
    .sort((a, b) => b.cur - a.cur);
}

export function buildTypeRows(typeCounts, total) {
  const sum = typeCounts.reduce((a, t) => a + t.count, 0);
  const rows = typeCounts.slice();
  const otras = total - sum;
  if (otras > 0) rows.push({ type: 'Otras', count: otras });
  return rows
    .map((t) => ({ ...t, share: total ? (t.count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

export function yearlyTotals(series, maxYear) {
  const byYear = {};
  for (const { date, count } of series) {
    const y = Number(String(date).slice(0, 4));
    if (y <= maxYear) byYear[y] = (byYear[y] || 0) + count;
  }
  return Object.keys(byYear).map(Number).sort((a, b) => a - b).map((y) => ({ year: y, count: byYear[y] }));
}

function csvCell(s) {
  const str = String(s);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows, year) {
  const head = `provincia,formaciones_${year},formaciones_${year - 1},variacion_pct`;
  const body = rows
    .map((r) => `${csvCell(r.province)},${r.cur},${r.prev},${r.pct == null ? '' : r.pct.toFixed(1)}`)
    .join('\n');
  return `${head}\n${body}\n`;
}
