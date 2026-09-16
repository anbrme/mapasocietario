// mapasocietario/src/utils/relationshipReportHtml.js
// Pure HTML builder for Copy-for-Word, so the situation report pastes formatted
// into Word or Docs. No DOM, no React.
//
// It renders the SAME document model as the exported .html file
// (investigationDoc.js) — the two differ only in medium. Word cannot take an
// interactive canvas, so this one is the chronology, the chapters, the tables
// and the notes without the map. Section order follows the exported page:
// summary, chronology, chapters, then the annexes of whatever no chapter told.
//
// Markup is deliberately plain — headings, lists, bordered tables, b/i — which
// is what survives a paste into Word.

import { escapeHtml as esc } from './escapeHtml';
import { correctionVerb, exportCopy } from './investigationExport/exportCopy';
import { walkthroughCopy, stepKindLabel } from './walkthrough/walkthroughCopy';
import { publishableAnnotations } from './walkthrough/applyWalkthroughEdits';
import { annexRows, chronologyEntries, hasChronology, stepEvidenceLine } from './sitrepModel';
import { isoDayLong } from './isoDay';

export function buildReportHtml(doc, { es = true } = {}) {
  const lang = es ? 'es' : 'en';
  const t = exportCopy(lang);
  const wt = walkthroughCopy(lang);
  const c = doc?.counts || { companies: 0, officers: 0, sharedPeople: 0 };
  const day = iso => isoDayLong(iso, lang);

  const noteLine = note => (note
    ? `<div><i>${esc(note.text)}</i></div>`
    : '');

  const flaggedRows = (doc?.flagged || []).map(f =>
    `<li><b>${esc(f.name)}</b> — ${esc(f.text)}</li>`).join('');

  // The chapters tell their own subjects; the annexes carry whatever is left,
  // so nothing is said twice and nothing is dropped. With no walkthrough at
  // all these are simply the whole lists.
  const annexes = annexRows(doc);

  const companyRows = annexes.companies.map(x =>
    `<li><b>${esc(x.name)}</b>${noteLine(x.note)}</li>`).join('');

  const connectorRows = annexes.connectors.map(con => `
    <tr>
      <td>${esc(con.name)} <i>(${con.type === 'entity' ? esc(t.entity) : esc(t.individual)})</i>${noteLine(con.note)}</td>
      <td>${(con.companies || []).map(esc).join(', ')}</td>
      <td>${(con.roles || []).map(esc).join(' / ')}</td>
      <td>${esc(t[con.status] || con.status)}</td>
    </tr>`).join('');

  const ownershipRows = annexes.ownership.map(o =>
    `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');

  const otherRows = (doc?.otherNotes || []).map(n =>
    `<li><b>${esc(n.name)}</b> — ${esc(n.text)}</li>`).join('');

  const correctionLine = (correction) => {
    const tail = correction.nameB ? ` ${esc(correction.nameB)}` : '';
    const when = correction.resignedDate ? ` (${esc(correction.resignedDate)})` : '';
    return `<li>${esc(correction.nameA)} — ${esc(correctionVerb(t, correction.action))}${tail}${when}</li>`;
  };

  const correctionRows = annexes.corrections.map(correctionLine).join('');

  // The story's dates in order — the chapters' own moments and every dated
  // note hung off them, each saying which chapter it belongs to.
  const chronologyRows = hasChronology(doc)
    ? chronologyEntries(doc).map(e => {
      const what = e.note ? `${esc(e.title)} — <i>${esc(e.note)}</i>` : `<b>${esc(e.title)}</b>`;
      const kind = e.step ? stepKindLabel(e.step, wt) : t.authorNote;
      return `<li><b>${esc(day(e.date))}</b> · ${what} <i>(${esc(kind)})</i></li>`;
    }).join('')
    : '';

  // One chapter: what it is and when, what the registry says, what the author
  // wrote about it, and the notes they dated day by day.
  const chapter = (s, i) => {
    const eyebrow = [
      wt.sources[s.source] || s.source || '',
      stepKindLabel(s, wt),
      day(s.moment),
    ].filter(Boolean).join(' · ');
    const summary = s.summary || s.text || '';
    const evidence = stepEvidenceLine(s, wt);
    const note = s.narrative || s.authorNote;
    const dated = publishableAnnotations(s);
    return [
      `<h4>${esc(`${String(i + 1).padStart(2, '0')} · ${s.title || ''}`)}</h4>`,
      eyebrow ? `<p><small>${esc(eyebrow)}</small></p>` : '',
      summary ? `<p>${esc(summary)}</p>` : '',
      evidence ? `<p><small>${esc(t.evidenceLabel)}: ${esc(evidence)}</small></p>` : '',
      note?.text ? `<p><i>${esc(t.authorNote)}: ${esc(note.text)}</i></p>` : '',
      dated.length
        ? `<p><b>${esc(wt.datedNotes)}</b></p><ul>${dated.map(a =>
          `<li><b>${esc(day(a.date))}</b> — ${esc(a.text)}</li>`).join('')}</ul>`
        : '',
    ].join('');
  };

  const chapterRows = (doc?.steps || []).map(chapter).join('');

  const block = (title, inner) => (inner ? `<h3>${esc(title)}</h3>${inner}` : '');

  return `<div>
  <h2>${esc(t.title)}${doc?.subject ? ` — ${esc(doc.subject)}` : ''}</h2>
  <p><i>${esc(t.nonAuthoritative)}</i></p>
  ${doc?.networkNote ? `<p>${esc(doc.networkNote)}</p>` : ''}
  <p><b>${c.companies}</b> ${esc(t.companies)} · <b>${c.sharedPeople}</b> ${esc(t.connections)}</p>
  ${block(t.flagged, flaggedRows ? `<ul>${flaggedRows}</ul>` : '')}
  ${block(t.chronology, chronologyRows ? `<ol>${chronologyRows}</ol>` : '')}
  ${block(t.walkthroughSection, chapterRows)}
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
