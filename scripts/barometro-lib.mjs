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

export function barChartSvg(items, { w = 680, barH = 22, gap = 8, pad = 8, labelW = 130 } = {}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const valW = 70;
  const chartW = w - labelW - valW - pad;
  const h = pad * 2 + items.length * (barH + gap) - gap;
  const bars = items
    .map((it, i) => {
      const y = pad + i * (barH + gap);
      const bw = Math.max(1, Math.round((it.value / max) * chartW));
      return (
        `<text x="0" y="${y + barH * 0.7}" font-size="12">${esc(it.label)}</text>` +
        `<rect x="${labelW}" y="${y}" width="${bw}" height="${barH}" fill="#2563eb" rx="3"></rect>` +
        `<text x="${labelW + bw + 6}" y="${y + barH * 0.7}" font-size="12">${esc(intEs(it.value))}</text>`
      );
    })
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" width="100%" font-family="Arial,sans-serif" fill="#0f172a">${bars}</svg>`;
}

export function trendChartSvg(yearly, { w = 680, h = 220, pad = 30 } = {}) {
  const max = Math.max(...yearly.map((p) => p.count), 1);
  const n = Math.max(1, yearly.length - 1);
  const x = (i) => pad + (i / n) * (w - pad * 2);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const pts = yearly.map((p, i) => `${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ');
  const labels = yearly
    .map((p, i) => (i % 2 === 0 || i === yearly.length - 1
      ? `<text x="${x(i).toFixed(1)}" y="${h - 8}" font-size="10" text-anchor="middle">${p.year}</text>`
      : ''))
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" width="100%" font-family="Arial,sans-serif" fill="#64748b"><polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2"></polyline>${labels}</svg>`;
}
