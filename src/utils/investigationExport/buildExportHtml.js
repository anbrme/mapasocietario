// Assembles the situation report into ONE self-contained .html file: inline
// CSS, inline data, inline script. Nothing is fetched, so it opens offline,
// survives being emailed, and prints from the browser.
//
// Identity is deliberate (see the spec): attributed but clearly
// non-authoritative. Enough provenance that a forwarded file is credible and
// traceable back to us; never styled as a Mapa Societario deliverable, which
// would put it back in competition with the paid report.

import { escapeHtml as esc } from '../escapeHtml';
import { correctionVerb, exportCopy } from './exportCopy';
import { renderGraphSvg } from './renderGraphSvg';
import { WALKTHROUGH_SCRIPT } from './walkthroughScript';

const SITE = 'https://mapasocietario.es';

// Flag NAMES are the persistence contract, so the export maps names to its own
// palette rather than reading the app theme (which the file cannot see anyway).
const FLAG_COLORS = {
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  green: '#22c55e',
  none: '#94a3b8',
};

const STYLE = `
:root{color-scheme:light dark;
--bg:#fbfbfa;--fg:#1c1c1a;--muted:#6b6b66;--line:#e2e2de;--card:#ffffff;
--company:#0f766e;--officer:#64748b;--link:#cbd5e1}
@media (prefers-color-scheme: dark){:root{
--bg:#14161a;--fg:#e8e8e4;--muted:#9a9a94;--line:#2a2d33;--card:#1c1f24;
--company:#2dd4bf;--officer:#94a3b8;--link:#3a3f47}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font:14px/1.55 "IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:32px 20px 64px}
header{border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:24px}
h1{font-size:1.5rem;margin:0 0 4px}
.meta{color:var(--muted);font-size:.8rem}
.warn{margin-top:10px;padding:8px 12px;border-left:3px solid var(--company);
background:var(--card);font-size:.82rem}
h2{font-size:1rem;margin:28px 0 8px;text-transform:uppercase;
letter-spacing:.07em;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:.85rem}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600}
.scroll{overflow-x:auto}
.note{font-size:.82rem;color:var(--muted);border-left:3px solid var(--f,#94a3b8);
padding-left:8px;margin:4px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:6px;
padding:10px 12px;margin-bottom:8px;border-left:3px solid var(--f,#94a3b8)}
.card strong{display:block;margin-bottom:2px}
#map{width:100%;height:520px;background:var(--card);
border:1px solid var(--line);border-radius:6px;cursor:grab}
#map .l{stroke:var(--link);stroke-width:1}
#map g.n circle{fill:var(--officer)}
#map g.n[data-kind="company"] circle{fill:var(--company)}
#map g.n text{fill:var(--fg);font-size:9px;text-anchor:middle;pointer-events:none}
#map g.n[data-flag] circle{stroke:#ef4444;stroke-width:2.5}
#map g.n[data-flag="amber"] circle{stroke:#f59e0b}
#map.focused g.n{opacity:.18}
#map.focused g.n.on{opacity:1}
#wt-panel{position:sticky;bottom:0;background:var(--card);
border:1px solid var(--line);border-radius:6px;padding:12px;margin-top:8px}
#wt-body[data-flag="red"]{border-left:3px solid #ef4444;padding-left:8px}
#wt-body[data-flag="amber"]{border-left:3px solid #f59e0b;padding-left:8px}
button{font:inherit;padding:4px 12px;border:1px solid var(--line);
border-radius:4px;background:transparent;color:var(--fg);cursor:pointer}
footer{margin-top:40px;padding-top:14px;border-top:1px solid var(--line);
color:var(--muted);font-size:.75rem}
a{color:var(--company)}
@media print{#wt-panel,.hide-print{display:none}#map{height:400px}}
`;

const flagVar = flag => `--f:${
  Object.prototype.hasOwnProperty.call(FLAG_COLORS, flag) ? FLAG_COLORS[flag] : FLAG_COLORS.none
}`;

const noteBlock = note => (note
  ? `<div class="note" style="${flagVar(note.flag)}">${esc(note.text)}</div>`
  : '');

const section = (id, title, inner) => (inner
  ? `<section id="${id}"><h2>${esc(title)}</h2>${inner}</section>`
  : '');

const correctionLine = (c, t) => {
  const tail = c.nameB ? ` ${esc(c.nameB)}` : '';
  const when = c.resignedDate ? ` (${esc(c.resignedDate)})` : '';
  return `<li>${esc(c.nameA)} — ${esc(correctionVerb(t, c.action))}${tail}${when}</li>`;
};

export function buildExportHtml(doc, graphData, { lang = 'es' } = {}) {
  const t = exportCopy(lang);
  const flaggedIds = new Set((doc.flagged || []).map(f => f.nodeId));
  const date = new Date(doc.generatedAt).toLocaleDateString(
    lang === 'en' ? 'en-GB' : 'es-ES',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  const hasWalkthrough = (doc.flagged || []).length > 0;

  const flaggedCards = (doc.flagged || []).map(f =>
    `<div class="card" style="${flagVar(f.flag)}">`
    + `<strong>${esc(f.name)}</strong>${esc(f.text)}</div>`).join('');

  const companyRows = (doc.companies || []).map(c =>
    `<li><strong>${esc(c.name)}</strong>${noteBlock(c.note)}</li>`).join('');

  const connectorRows = (doc.connectors || []).map(c => `<tr>
      <td>${esc(c.name)} <em>(${c.type === 'entity' ? esc(t.entity) : esc(t.individual)})</em>${noteBlock(c.note)}</td>
      <td>${(c.companies || []).map(esc).join(', ')}</td>
      <td>${(c.roles || []).map(esc).join(' / ')}</td>
      <td>${esc(t[c.status] || c.status)}</td>
    </tr>`).join('');

  const ownershipRows = (doc.ownership || []).map(o =>
    `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');

  const otherRows = (doc.otherNotes || []).map(n =>
    `<div class="card" style="${flagVar(n.flag)}">`
    + `<strong>${esc(n.name)}</strong>${esc(n.text)}</div>`).join('');

  const correctionRows = (doc.corrections || []).map(c => correctionLine(c, t)).join('');

  // JSON is embedded as text, so </script> inside a note would close the tag.
  const stepJson = JSON.stringify({ steps: doc.flagged || [] })
    .replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(t.title)}${doc.subject ? ` — ${esc(doc.subject)}` : ''}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>${esc(t.title)}</h1>
  <div class="meta">${doc.subject ? `${esc(t.subject)}: <strong>${esc(doc.subject)}</strong> · ` : ''}${esc(t.generated)} ${esc(date)}</div>
  <div class="warn">${esc(t.nonAuthoritative)}<br>${esc(t.sourceLine)}</div>
</header>

${doc.networkNote ? `<section id="summary"><h2>${esc(t.summaryNote)}</h2><p>${esc(doc.networkNote)}</p></section>` : ''}

<section id="graph">
  ${renderGraphSvg(graphData, { flaggedIds })}
  ${hasWalkthrough ? `<p class="hide-print"><button id="wt-start">${esc(t.walkthrough)}</button></p>
  <div id="wt-panel" hidden>
    <div id="wt-body"></div>
    <p><button id="wt-prev">${esc(t.prev)}</button>
       <button id="wt-next">${esc(t.next)}</button>
       <span id="wt-counter" class="meta"></span>
       <button id="wt-exit">${esc(t.exit)}</button></p>
  </div>` : ''}
</section>

${section('flagged', t.flagged, flaggedCards)}
${section('companies', t.companies, companyRows ? `<ul>${companyRows}</ul>` : '')}
${section('connections', t.connections, connectorRows
    ? `<div class="scroll"><table><thead><tr>
         <th>${esc(t.person)}</th><th>${esc(t.inCompanies)}</th>
         <th>${esc(t.role)}</th><th>${esc(t.status)}</th>
       </tr></thead><tbody>${connectorRows}</tbody></table></div>`
    : `<p class="meta">${esc(t.none)}</p>`)}
${section('ownership', t.ownership, ownershipRows ? `<ul>${ownershipRows}</ul>` : '')}
${section('other', t.otherNotes, otherRows)}
${section('corrections', t.corrections, correctionRows ? `<ul>${correctionRows}</ul>` : '')}

<footer>
  NC Data · <a href="${SITE}">mapasocietario.es</a> — ${esc(t.sourceLine)}
  ${doc.subject ? `<br><a href="${SITE}">${esc(t.backLink)}</a>` : ''}
</footer>
</div>
<script>window.__SITREP__=${stepJson};</script>
<script>${WALKTHROUGH_SCRIPT}</script>
</body>
</html>`;
}

export function exportFileName(doc, lang = 'es') {
  const base = lang === 'en' ? 'Situation_report' : 'Informe_de_situacion';
  const d = new Date(doc.generatedAt);
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  const subject = String(doc.subject || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return [base, subject, stamp].filter(Boolean).join('_') + '.html';
}
