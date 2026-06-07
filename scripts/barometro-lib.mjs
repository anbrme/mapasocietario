// Pure logic + rendering for the Barómetro Empresarial data story. No network, no fs.

export function latestFullYear(series) {
  const monthsByYear = {};
  for (const { date } of series) {
    const ym = String(date).slice(0, 7); // "YYYY-MM"
    const y = Number(ym.slice(0, 4));
    (monthsByYear[y] ??= new Set()).add(ym);
  }
  const full = Object.keys(monthsByYear).map(Number).filter((y) => monthsByYear[y].size >= 12);
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

// A proportion/share (no leading "+"); pctEs is for year-over-year change.
export function shareEs(p) {
  if (p == null) return '—';
  return `${p.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
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
      ? `<text x="${x(i).toFixed(1)}" y="${h - 8}" font-size="10" text-anchor="middle">${esc(p.year)}</text>`
      : ''))
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" width="100%" font-family="Arial,sans-serif" fill="#64748b"><polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2"></polyline>${labels}</svg>`;
}

function provinceTable(rows, year) {
  const body = rows
    .map((r) => `<tr><td>${esc(r.province)}</td><td>${intEs(r.cur)}</td><td>${intEs(r.prev)}</td><td>${pctEs(r.pct)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Provincia</th><th>${year}</th><th>${year - 1}</th><th>Variación</th></tr></thead><tbody>${body}</tbody></table>`;
}

function typeTable(rows, year) {
  const body = rows
    .map((r) => `<tr><td>${esc(r.type)}</td><td>${intEs(r.count)}</td><td>${shareEs(r.share)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Forma jurídica</th><th>Constituciones ${year}</th><th>% del total</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function renderArticleHtml(d) {
  const top = d.provinceRows[0];
  return `
    <style>
      body{background:#fff;color:#0f172a;margin:0}
      main{font-family:Arial,Helvetica,sans-serif}
      h1{font-size:1.9rem;line-height:1.2;margin:.4rem 0 1rem}
      h2{font-size:1.3rem;margin:2.2rem 0 .6rem;border-top:1px solid #e2e8f0;padding-top:1.2rem}
      table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:14px}
      th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}
      th{background:#f1f5f9;font-weight:600}
      tbody td:nth-child(n+2),thead th:nth-child(n+2){text-align:right;font-variant-numeric:tabular-nums}
      a{color:#2563eb}
      svg{max-width:100%;height:auto;margin:.5rem 0}
    </style>
    <main style="font-family:Arial,sans-serif;max-width:880px;margin:2rem auto;padding:0 1rem;line-height:1.6">
      <p style="margin:0 0 1.2rem"><a href="/" style="color:#2563eb;text-decoration:none;font-weight:700">Mapa Societario</a></p>
      <h1>Barómetro empresarial: dónde se crean empresas en España (${d.year})</h1>
      <p>En ${d.year} se constituyeron <strong>${intEs(d.nationalCur)}</strong> nuevas sociedades en España
         (${pctEs(d.nationalPct)} frente a ${d.prevYear}). <strong>${esc(top.province)}</strong> lidera con
         ${intEs(top.cur)} constituciones. Datos oficiales del BORME.</p>

      <h2>Constituciones por provincia (${d.year} vs ${d.prevYear})</h2>
      ${d.barSvg}
      ${provinceTable(d.provinceRows, d.year)}

      <h2>Por forma jurídica</h2>
      <p>Casi todas las nuevas sociedades son SL: la sociedad limitada concentra la gran mayoría de constituciones.</p>
      ${typeTable(d.typeRows, d.year)}

      <h2>Evolución de las constituciones (2009–${d.year})</h2>
      ${d.trendSvg}

      <h2>Metodología y datos</h2>
      <p>Fuente: Boletín Oficial del Registro Mercantil (BORME), procesado por Mapa Societario. "Constitución" =
         primera inscripción de la sociedad en el BORME. Cobertura desde 2009. Mapa Societario no es un registro oficial.</p>
      <p>Las disoluciones y la creación neta (constituciones − disoluciones) se incorporarán en una próxima edición,
         una vez validada la cobertura de los datos de disolución por registro.</p>
      <p><a href="/es/barometro-empresarial.csv">Descargar datos (CSV)</a></p>
      <p><a href="/app">Buscar una empresa</a> · <a href="/empresas-cotizadas">Empresas cotizadas (IBEX 35)</a></p>
    </main>`;
}

// --- Official Registradores CSV layer ---------------------------------------

export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const numCols = new Set(['year', 'month', 'count', 'capital_subscribed']);
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const o = {};
    head.forEach((h, i) => { o[h] = numCols.has(h) ? Number(cells[i]) : cells[i]; });
    return o;
  });
}

const PROV_NORM = {
  'Alacant / Alicante': 'Alicante', 'Alicante / Alacant': 'Alicante',
  'Castelló / Castellón': 'Castellón', 'Castellón / Castelló': 'Castellón',
  'Valencia / València': 'Valencia', 'València / Valencia': 'Valencia',
  'Araba / Álava': 'Álava',
  'Bizkaia': 'Vizcaya', 'Gipuzkoa': 'Guipúzcoa',
  'Girona': 'Gerona', 'Lleida': 'Lérida', 'Ourense': 'Orense',
  'Illes Balears': 'Baleares',
};
export function normProvince(p) { return PROV_NORM[p] || p; }

export function latestFullYearFromRows(rows) {
  const months = {};
  for (const r of rows) (months[r.year] ??= new Set()).add(r.month);
  const full = Object.keys(months).map(Number).filter((y) => months[y].size >= 12);
  if (!full.length) throw new Error('latestFullYearFromRows: no complete year');
  return Math.max(...full);
}

export function sumByProvince(rows, year) {
  const m = {};
  for (const r of rows) if (r.year === year) { const p = normProvince(r.province); m[p] = (m[p] || 0) + r.count; }
  return m;
}
export function sumByForm(rows, year) {
  const m = {};
  for (const r of rows) if (r.year === year) m[r.form] = (m[r.form] || 0) + r.count;
  return m;
}
export function sumYears(rows) {
  const m = {};
  for (const r of rows) m[r.year] = (m[r.year] || 0) + r.count;
  return Object.keys(m).map(Number).sort((a, b) => a - b).map((y) => ({ year: y, count: m[y] }));
}
export function sumCapital(rows, year) {
  let t = 0;
  for (const r of rows) if (r.year === year) t += (r.capital_subscribed || 0);
  return t;
}
export function buildNetRows(constCur, extinCur, constPrev, extinPrev) {
  const provs = new Set([...Object.keys(constCur), ...Object.keys(extinCur)]);
  return [...provs]
    .map((p) => {
      const c = constCur[p] || 0, e = extinCur[p] || 0;
      const netPrev = (constPrev[p] || 0) - (extinPrev[p] || 0);
      return { province: p, const_: c, extin: e, net: c - e, netPrev, pct: pctChange(c - e, netPrev) };
    })
    .sort((a, b) => b.net - a.net);
}

export function injectHead(template, { title, description, canonical, ogType = 'article' }) {
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`);
  html = html.replace(/(<link\s+rel="canonical"[^>]*href=")[^"]*(")/, `$1${esc(canonical)}$2`);
  // Open Graph / Twitter — only replaced if the tag exists in the template. `[^>]*` keeps each match within its own tag.
  html = html.replace(/(property="og:title"[^>]*content=")[^"]*(")/, `$1${esc(title)}$2`);
  html = html.replace(/(property="og:description"[^>]*content=")[^"]*(")/, `$1${esc(description)}$2`);
  html = html.replace(/(property="og:url"[^>]*content=")[^"]*(")/, `$1${esc(canonical)}$2`);
  html = html.replace(/(property="og:type"[^>]*content=")[^"]*(")/, `$1${esc(ogType)}$2`);
  html = html.replace(/(name="twitter:title"[^>]*content=")[^"]*(")/, `$1${esc(title)}$2`);
  html = html.replace(/(name="twitter:description"[^>]*content=")[^"]*(")/, `$1${esc(description)}$2`);
  return html;
}
