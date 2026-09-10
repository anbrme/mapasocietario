// mapasocietario/src/utils/relationshipReportHtml.js
// Pure HTML builder for Copy-for-Word, so the situation report pastes formatted
// into Word or Docs. No DOM, no React.
//
// It renders the SAME document model as the exported .html file
// (investigationDoc.js) — the two differ only in medium. Word cannot take an
// interactive canvas, so this one is the tables and the notes without the map.

import { escapeHtml as esc } from './escapeHtml';
import { correctionVerb, exportCopy } from './investigationExport/exportCopy';

export function buildReportHtml(doc, { es = true } = {}) {
  const t = exportCopy(es ? 'es' : 'en');
  const c = doc?.counts || { companies: 0, officers: 0, sharedPeople: 0 };

  const noteLine = note => (note
    ? `<div><i>${esc(note.text)}</i></div>`
    : '');

  const flaggedRows = (doc?.flagged || []).map(f =>
    `<li><b>${esc(f.name)}</b> — ${esc(f.text)}</li>`).join('');

  const companyRows = (doc?.companies || []).map(x =>
    `<li><b>${esc(x.name)}</b>${noteLine(x.note)}</li>`).join('');

  const connectorRows = (doc?.connectors || []).map(con => `
    <tr>
      <td>${esc(con.name)} <i>(${con.type === 'entity' ? esc(t.entity) : esc(t.individual)})</i>${noteLine(con.note)}</td>
      <td>${(con.companies || []).map(esc).join(', ')}</td>
      <td>${(con.roles || []).map(esc).join(' / ')}</td>
      <td>${esc(t[con.status] || con.status)}</td>
    </tr>`).join('');

  const ownershipRows = (doc?.ownership || []).map(o =>
    `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');

  const otherRows = (doc?.otherNotes || []).map(n =>
    `<li><b>${esc(n.name)}</b> — ${esc(n.text)}</li>`).join('');

  const correctionLine = (correction) => {
    const tail = correction.nameB ? ` ${esc(correction.nameB)}` : '';
    const when = correction.resignedDate ? ` (${esc(correction.resignedDate)})` : '';
    return `<li>${esc(correction.nameA)} — ${esc(correctionVerb(t, correction.action))}${tail}${when}</li>`;
  };

  const correctionRows = (doc?.corrections || []).map(correctionLine).join('');

  const block = (title, inner) => (inner ? `<h3>${esc(title)}</h3>${inner}` : '');

  return `<div>
  <h2>${esc(t.title)}${doc?.subject ? ` — ${esc(doc.subject)}` : ''}</h2>
  <p><i>${esc(t.nonAuthoritative)}</i></p>
  ${doc?.networkNote ? `<p>${esc(doc.networkNote)}</p>` : ''}
  <p><b>${c.companies}</b> ${esc(t.companies)} · <b>${c.sharedPeople}</b> ${esc(t.connections)}</p>
  ${block(t.flagged, flaggedRows ? `<ul>${flaggedRows}</ul>` : '')}
  ${block(t.companies, companyRows ? `<ul>${companyRows}</ul>` : '')}
  <h3>${esc(t.connections)}</h3>
  ${connectorRows
    ? `<table border="1" cellpadding="4" cellspacing="0">
      <thead><tr><th>${esc(t.person)}</th><th>${esc(t.inCompanies)}</th><th>${esc(t.role)}</th><th>${esc(t.status)}</th></tr></thead>
      <tbody>${connectorRows}</tbody></table>`
    : `<p>${esc(t.none)}</p>`}
  ${block(t.ownership, ownershipRows ? `<ul>${ownershipRows}</ul>` : '')}
  ${block(t.otherNotes, otherRows ? `<ul>${otherRows}</ul>` : '')}
  ${block(t.corrections, correctionRows ? `<ul>${correctionRows}</ul>` : '')}
  <p><small>${esc(t.sourceLine)} — mapasocietario.es</small></p>
</div>`;
}
