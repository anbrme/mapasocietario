// One pure renderer per section of the situation report. Each returns an HTML
// string, or '' when the section has nothing to say — the orchestrator and the
// contents strip both rely on '' meaning "omit".
import { escapeHtml as esc } from '../escapeHtml';
import { correctionVerb } from './exportCopy';
import { renderGraphSvg } from './renderGraphSvg';
import { flagVar } from './documentStyle';

const SITE = 'https://mapasocietario.es';

const fmtDate = (iso, lang) => new Date(iso).toLocaleDateString(
  lang === 'en' ? 'en-GB' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

const authorLine = (doc, t) => {
  const parts = [doc.author?.name, doc.author?.organisation].map(v => String(v || '').trim()).filter(Boolean);
  return parts.length ? ` · ${esc(t.elaboratedBy)} ${esc(parts.join(' · '))}` : '';
};

export const renderCover = (doc, t, lang) => `
<header class="cover">
  <div class="eyebrow">${esc(t.title)}</div>
  <h1>${esc(doc.subject || t.title)}</h1>
  <div class="meta">${esc(t.generated)} ${esc(fmtDate(doc.generatedAt, lang))}${authorLine(doc, t)}</div>
  <div class="status">${esc(t.nonAuthoritative)}<br>${esc(t.sourceLine)}</div>
</header>`;

// Rows a chapter already narrates must not repeat in the annexes. A company
// is covered when its own id (or one of the officer ids its chapter draws
// in) appears in ANY step's nodeIds; a connector is covered only when it got
// its OWN chapter (its id is some step's primary nodeId) — being merely
// pictured inside another chapter's board table does not retire it here.
// Ownership rows are covered when either side is a chapter's own title.
export const annexRows = doc => {
  const steps = doc.steps || [];
  const stepNodeIds = new Set(steps.flatMap(s => s.nodeIds || []));
  const stepIds = new Set(steps.map(s => s.nodeId));
  const chapterTitles = new Set(steps.map(s => s.title));
  return {
    companies: (doc.companies || []).filter(c => !stepNodeIds.has(c.nodeId)),
    connectors: (doc.connectors || []).filter(c => !stepIds.has(c.nodeId)),
    ownership: (doc.ownership || []).filter(o => !chapterTitles.has(o.owner) && !chapterTitles.has(o.owned)),
    corrections: doc.corrections || [],
  };
};

const hasAnnexes = doc => {
  const rows = annexRows(doc);
  return !!(rows.companies.length || rows.connectors.length || rows.ownership.length || rows.corrections.length);
};

// Section numbers, computed once from the same rules that decide whether a
// section renders at all, so the contents nav and every <h2> agree.
const sectionNumbers = doc => {
  let n = 0;
  const summary = doc.networkNote ? (n += 1) : null;
  const map = (n += 1);
  const chapters = (doc.steps || []).length ? (n += 1) : null;
  const annexes = hasAnnexes(doc) ? (n += 1) : null;
  return {
    summary, map, chapters, annexes,
  };
};

export const renderContents = (doc, t) => {
  const steps = doc.steps || [];
  const nums = sectionNumbers(doc);
  const items = [];
  if (nums.summary != null) items.push(`<a href="#summary"><b>${nums.summary}</b>${esc(t.summaryNote)}</a>`);
  items.push(`<a href="#graph"><b>${nums.map}</b>${esc(t.map)}</a>`);
  if (nums.chapters != null) {
    items.push(`<a href="#walkthrough"><b>${nums.chapters}</b>${esc(t.walkthroughSection)}</a>`);
    steps.forEach((s, i) => items.push(`<a href="#ch-${i}" class="sub">${esc(t.chapterLabel(i + 1, s.title))}</a>`));
  }
  if (nums.annexes != null) items.push(`<a href="#annexes"><b>${nums.annexes}</b>${esc(t.annexes)}</a>`);
  return `<nav class="contents" aria-label="${esc(t.contents)}">${items.join('')}</nav>`;
};

export const renderSummary = (doc, t) => (doc.networkNote
  ? `<section id="summary"><h2><span class="num">${sectionNumbers(doc).summary}</span>${esc(t.summaryNote)}</h2><p class="lead">${esc(doc.networkNote)}</p></section>`
  : '');

// A node is drawn flagged either because it IS an author-source step (the
// walkthrough narrates the note directly) or because a step's primary node
// carries an author note (narrative, or its v1 authorNote mirror) with a
// red/amber flag.
const isFlaggedStep = s => (
  (s.source === 'author' && (s.flag === 'red' || s.flag === 'amber'))
  || (s.narrative?.flag === 'red' || s.narrative?.flag === 'amber')
  || (s.authorNote?.flag === 'red' || s.authorNote?.flag === 'amber')
);

export const renderMapFigure = (doc, graphData, t) => {
  const steps = doc.steps || [];
  const hasSteps = steps.length > 0;
  const flaggedIds = new Set(steps.filter(isFlaggedStep).map(s => s.nodeIds?.[0]).filter(Boolean));
  const c = doc.counts || {};
  const num = sectionNumbers(doc).map;
  // The walkthrough has nothing to play until steps exist, so the button and
  // its panel would just be dead chrome — omit both rather than ship a
  // control with no wiring behind it yet.
  const controls = hasSteps
    ? `<div class="wt-controls hide-print"><button id="wt-start" class="primary">${esc(t.walkthrough)}</button></div>`
    : '';
  const panel = hasSteps
    ? `<div id="wt-panel" hidden>
    <div id="wt-opening" hidden><strong id="wt-open-title"></strong><p id="wt-open-line"></p></div>
    <div id="wt-eyebrow" class="eyebrow"></div>
    <strong id="wt-title"></strong>
    <p id="wt-text"></p>
    <p id="wt-ev" class="ev" hidden></p>
    <div id="wt-note" hidden></div>
    <div class="wt-nav"><button id="wt-prev">${esc(t.prev)}</button><button id="wt-next">${esc(t.next)}</button><span id="wt-counter" class="meta"></span><span style="flex:1"></span><button id="wt-exit">${esc(t.exit)}</button></div>
  </div>`
    : '';
  return `
<section id="graph"><h2><span class="num">${num}</span>${esc(t.map)}</h2>
<figure>
  <div class="frame">
    ${renderGraphSvg(graphData, { flaggedIds })}
    ${controls}
  </div>
  <figcaption>
    <span>${esc(t.mapCaption(c.companies || 0, c.officers || 0, c.sharedPeople || 0))}</span>
    <span class="legend"><span><i class="co"></i>${esc(t.legendCompany)}</span><span><i class="of"></i>${esc(t.legendPerson)}</span><span><i class="own"></i>${esc(t.legendOwnership)}</span><span><i class="flag"></i>${esc(t.legendFlag)}</span></span>
  </figcaption>
</figure>
${panel}
</section>`;
};

const noteBlock = (note, t, flag) => (note?.text
  ? `<div class="note" style="${flagVar(flag || note.flag || 'none')}"><span class="who">${esc(t.authorNote)}</span>${esc(note.text)}</div>`
  : '');

const kv = (label, value) => (value ? `<p class="kv">${label ? `${esc(label)}: ` : ''}${esc(value)}</p>` : '');

const evidenceTable = (columns, rows, cells) => (rows.length
  ? `<div class="scroll"><table><thead><tr>${Object.values(columns).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr>${cells(r).map(v => `<td>${esc(v || '')}</td>`).join('')}</tr>`).join('')
  }</tbody></table></div>`
  : '');

const companyEvidenceBlock = (s, t, wt, blocks) => {
  const ev = s.evidence || {};
  const parts = [];
  if (blocks.identity !== false) {
    if (ev.identity) parts.push(`<p>${esc(ev.identity)}</p>`);
    if (ev.status?.dissolved) parts.push(kv(null, wt.statusWords.dissolved));
    if (ev.status?.concurso) parts.push(kv(null, wt.statusWords.concurso));
    parts.push(kv(wt.capitalLabel, ev.capital));
    parts.push(kv(wt.activityLabel, ev.activity));
  }
  if (blocks.board !== false && (ev.board || []).length) {
    parts.push(`<h4>${esc(wt.subheads.board)}</h4>${evidenceTable(wt.boardColumns, ev.board,
      r => [r.name, r.role, r.since, wt.statusWords[r.status] || r.status])}`);
  }
  if (blocks.filings !== false && (ev.filings || []).length) {
    parts.push(`<h4>${esc(wt.subheads.filings)}</h4>${evidenceTable(wt.filingColumns, ev.filings, r => [r.date, r.type])}`);
  }
  if (blocks.findings !== false && (ev.findings || []).length) {
    parts.push(`<h4>${esc(wt.subheads.findings)}</h4><ul>${
      ev.findings.map(f => `<li>${esc(f.text)}${f.date ? ` · ${esc(f.date)}` : ''}</li>`).join('')}</ul>`);
  }
  if ((ev.unseen || []).length) {
    parts.push(`<h4>${esc(wt.subheads.unseen)}</h4><ul>${ev.unseen.map(u => `<li>${esc(u)}</li>`).join('')}</ul>`);
  }
  if ((ev.ownership || []).length) {
    parts.push(`<ul class="plain">${
      ev.ownership.map(o => `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('')}</ul>`);
  }
  return parts.join('');
};

const personEvidenceBlock = (s, wt) => {
  const seats = s.evidence?.seats || [];
  if (!seats.length) return '';
  return `<h4>${esc(wt.subheads.seats)}</h4>${evidenceTable(wt.seatColumns, seats,
    r => [r.company, r.role, r.since, r.until, wt.statusWords[r.status] || r.status])}`;
};

const DEFAULT_CHAPTER_BLOCKS = Object.freeze({
  identity: true, board: true, filings: true, findings: true,
});

export const renderChapters = (doc, t, wt) => {
  const steps = doc.steps || [];
  if (!steps.length) return '';
  const blocks = doc.blocks || DEFAULT_CHAPTER_BLOCKS;
  const num = sectionNumbers(doc).chapters;
  const rows = steps.map((s, i) => {
    const head = `<span class="src">${esc(wt.sources[s.source] || s.source || '')}</span>${esc(wt.kinds[s.kind] || wt.sections?.[s.section] || '')}`;
    const narrative = noteBlock(s.narrative || s.authorNote, t);
    const evidence = s.kind === 'person' ? personEvidenceBlock(s, wt) : companyEvidenceBlock(s, t, wt, blocks);
    return `<div class="chapter" id="ch-${i}"><button type="button" class="num" onclick="__sitrepShow(${i})">${String(i + 1).padStart(2, '0')}</button><div><div class="head">${head}</div><h3>${esc(s.title)}</h3>${narrative}${evidence}</div></div>`;
  }).join('');
  return `<section id="walkthrough"><h2><span class="num">${num}</span>${esc(t.walkthroughSection)}</h2><div class="chapters">${rows}</div></section>`;
};

// The step's short evidence line, shared by the export's inline JSON and the
// in-app player card — the same one-liner either way.
export const stepEvidenceLine = (s, wt) => {
  const ev = s.evidence || {};
  if (s.kind === 'person') {
    return (ev.seats || []).slice(0, 2).map(seat => `${seat.role} · ${seat.company}`).join(' · ');
  }
  const finding = (ev.findings || [])[0];
  if (finding?.text) return finding.text;
  const lastFiling = ev.status?.lastFiling;
  if (lastFiling?.date) {
    return lastFiling.type ? `${wt.subheads.filings}: ${lastFiling.date} · ${lastFiling.type}` : `${wt.subheads.filings}: ${lastFiling.date}`;
  }
  return '';
};

const annex = (id, title, inner) => (inner ? `<div class="annex" id="${id}"><h3>${esc(title)}</h3>${inner}</div>` : '');

export const renderAnnexes = (doc, t) => {
  const rows = annexRows(doc);
  if (!rows.companies.length && !rows.connectors.length && !rows.ownership.length && !rows.corrections.length) return '';
  const companies = rows.companies.map(c => `<li><strong>${esc(c.name)}</strong>${c.note?.text ? noteBlock(c.note, t) : ''}</li>`).join('');
  const connectors = rows.connectors.map(c => `<tr>
    <td>${esc(c.name)} <em>(${c.type === 'entity' ? esc(t.entity) : esc(t.individual)})</em>${c.note?.text ? noteBlock(c.note, t) : ''}</td>
    <td>${(c.companies || []).map(esc).join(', ')}</td><td>${(c.roles || []).map(esc).join(' / ')}</td><td>${esc(t[c.status] || c.status)}</td></tr>`).join('');
  const ownership = rows.ownership.map(o => `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');
  const corrections = rows.corrections.map(c => `<li>${esc(c.nameA)} — ${esc(correctionVerb(t, c.action))}${c.nameB ? ` ${esc(c.nameB)}` : ''}${c.resignedDate ? ` <span class="date">(${esc(c.resignedDate)})</span>` : ''}</li>`).join('');
  const num = sectionNumbers(doc).annexes;
  return `<section id="annexes"><h2><span class="num">${num}</span>${esc(t.annexes)}</h2>
${annex('companies', t.companies, companies ? `<ul class="plain">${companies}</ul>` : '')}
${annex('connections', t.connections, connectors
    ? `<div class="scroll"><table><thead><tr><th>${esc(t.person)}</th><th>${esc(t.inCompanies)}</th><th>${esc(t.role)}</th><th>${esc(t.status)}</th></tr></thead><tbody>${connectors}</tbody></table></div>`
    : `<p class="meta">${esc(t.none)}</p>`)}
${annex('ownership', t.ownership, ownership ? `<ul class="plain">${ownership}</ul>` : '')}
${annex('corrections', t.corrections, corrections ? `<ul class="plain">${corrections}</ul>` : '')}
</section>`;
};

export const renderFooter = (doc, t, lang) => `
<footer>${esc(t.sourceLine)}${doc.coverage?.since ? `<br>${esc(t.coverage(doc.coverage.since, doc.coverage.indexedThrough))}` : ''}
<br>${esc(t.generated)} ${esc(fmtDate(doc.generatedAt, lang))} · <a href="${SITE}">${esc(t.backLink)}</a></footer>`;
