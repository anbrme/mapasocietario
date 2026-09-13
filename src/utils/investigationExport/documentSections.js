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

// A bare 'YYYY-MM-DD' parses as UTC midnight, which renders as the previous
// day west of Greenwich. Reading it at noon keeps the day the registry meant.
const fmtDay = (iso, lang) => (iso ? fmtDate(`${iso}T12:00:00`, lang) : '');

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
// or a connector is covered only when it got its OWN chapter (its id is some
// step's PRIMARY nodeId) — being merely pictured inside another chapter's
// board/seats table (e.g. a company that is only a seat of a selected
// person) does not retire it here; it keeps its annex row, and any note on
// it. Ownership rows are covered only when either side is a COMPANY
// chapter's own title — a person chapter's title never retires one.
export const annexRows = doc => {
  const steps = doc.steps || [];
  const stepIds = new Set(steps.map(s => s.nodeId || s.nodeIds?.[0]));
  const companyChapterTitles = new Set(steps.filter(s => s.kind === 'company').map(s => s.title));
  return {
    companies: (doc.companies || []).filter(c => !stepIds.has(c.nodeId)),
    connectors: (doc.connectors || []).filter(c => !stepIds.has(c.nodeId)),
    ownership: (doc.ownership || []).filter(o => !companyChapterTitles.has(o.owner) && !companyChapterTitles.has(o.owned)),
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

// The registry-state slider: one stop per distinct date the timeline holds,
// a tick at every date a chapter is pinned to, and the count of links the
// registry never dated (which therefore stay visible at every stop).
const renderTimeControl = (doc, t, lang) => {
  const tl = doc.timeline;
  if (!tl || !Array.isArray(tl.dates) || tl.dates.length < 2) return '';
  const idx = new Map(tl.dates.map((d, i) => [d, i]));
  const ticks = [...new Set((doc.steps || []).filter(s => idx.has(s.moment)).map(s => idx.get(s.moment)))]
    .sort((a, b) => a - b).map(i => `<option value="${i}"></option>`).join('');
  const undated = tl.undated > 0
    ? `<span id="wt-undated">${esc(t.undated(tl.undated))}</span>`
    : '<span id="wt-undated"></span>';
  return `<div id="wt-time" class="hide-print">
    <input type="range" id="wt-slider" min="0" max="${tl.dates.length - 1}" step="1" value="${tl.dates.length - 1}" list="wt-ticks" aria-label="${esc(t.registryAsOf(''))}">
    <datalist id="wt-ticks">${ticks}</datalist>
    <div class="meta"><span id="wt-date">${esc(t.registryAsOf(fmtDay(tl.readOn, lang)))}</span> · ${undated}</div>
  </div>`;
};

export const renderMapFigure = (doc, graphData, t, lang = 'es') => {
  const steps = doc.steps || [];
  const hasSteps = steps.length > 0;
  const flaggedIds = new Set(steps.filter(isFlaggedStep).map(s => s.nodeIds?.[0]).filter(Boolean));
  const c = doc.counts || {};
  const num = sectionNumbers(doc).map;
  // The story starts on scroll, so there is no start button; the panel is
  // present from the first paint (the opening block fills it until a chapter
  // enters). With no steps there is nothing to narrate — omit it entirely.
  const panel = hasSteps
    ? `<div id="wt-panel">
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
  </div>
  <figcaption>
    <span>${esc(t.mapCaption(c.companies || 0, c.officers || 0, c.sharedPeople || 0))}</span>
    <span class="legend"><span><i class="co"></i>${esc(t.legendCompany)}</span><span><i class="of"></i>${esc(t.legendPerson)}</span><span><i class="own"></i>${esc(t.legendOwnership)}</span><span><i class="flag"></i>${esc(t.legendFlag)}</span></span>
  </figcaption>
</figure>
${renderTimeControl(doc, t, lang)}
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

export const renderChapters = (doc, t, wt, lang = 'es') => {
  const steps = doc.steps || [];
  if (!steps.length) return '';
  // Any block missing from doc.blocks defaults to shown — the same rule
  // companyEvidenceBlock's per-block `!== false` checks already apply.
  const blocks = doc.blocks || {};
  const num = sectionNumbers(doc).chapters;
  const rows = steps.map((s, i) => {
    const head = `<span class="src">${esc(wt.sources[s.source] || s.source || '')}</span>${esc(wt.kinds[s.kind] || wt.sections?.[s.section] || '')}${s.moment ? ` · ${esc(fmtDay(s.moment, lang))}` : ''}`;
    const narrative = noteBlock(s.narrative || s.authorNote, t);
    const evidence = s.kind === 'person' ? personEvidenceBlock(s, wt) : companyEvidenceBlock(s, t, wt, blocks);
    return `<div class="chapter" id="ch-${i}" data-i="${i}" data-moment="${esc(s.moment || '')}"><button type="button" class="num" onclick="__sitrepShow(${i})">${String(i + 1).padStart(2, '0')}</button><div><div class="head">${head}</div><h3>${esc(s.title)}</h3>${narrative}${evidence}</div></div>`;
  }).join('');
  return `<section id="walkthrough"><h2><span class="num">${num}</span>${esc(t.walkthroughSection)}</h2><div class="chapters">${rows}</div></section>`;
};

// The story: the map pane and the chapters side by side, scrolled as one.
// The chapters drive the map; without them the pane stands alone (`.solo`).
export const renderStory = (doc, graphData, t, wt, lang = 'es') => {
  const hasSteps = (doc.steps || []).length > 0;
  return `<div id="story" class="story${hasSteps ? '' : ' solo'}">${
    renderMapFigure(doc, graphData, t, lang)}${hasSteps ? renderChapters(doc, t, wt, lang) : ''}</div>`;
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

// One annex block. `id` is carried by the block itself only when it stands
// alone; inside the tabbed explorer the panel owns the id, so the block goes
// id-free and the document keeps one element per id.
const annex = (title, inner, id) => (inner
  ? `<div class="annex"${id ? ` id="${esc(id)}"` : ''}><h3>${esc(title)}</h3>${inner}</div>`
  : '');

export const renderAnnexes = (doc, t) => {
  if (!hasAnnexes(doc)) return '';
  const rows = annexRows(doc);
  const companies = rows.companies.map(c => `<li><strong>${esc(c.name)}</strong>${c.note?.text ? noteBlock(c.note, t) : ''}</li>`).join('');
  const connectors = rows.connectors.map(c => `<tr>
    <td>${esc(c.name)} <em>(${c.type === 'entity' ? esc(t.entity) : esc(t.individual)})</em>${c.note?.text ? noteBlock(c.note, t) : ''}</td>
    <td>${(c.companies || []).map(esc).join(', ')}</td><td>${(c.roles || []).map(esc).join(' / ')}</td><td>${esc(t[c.status] || c.status)}</td></tr>`).join('');
  const ownership = rows.ownership.map(o => `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');
  const corrections = rows.corrections.map(c => `<li>${esc(c.nameA)} — ${esc(correctionVerb(t, c.action))}${c.nameB ? ` ${esc(c.nameB)}` : ''}${c.resignedDate ? ` <span class="date">(${esc(c.resignedDate)})</span>` : ''}</li>`).join('');
  const num = sectionNumbers(doc).annexes;
  const panels = [
    { id: 'companies', title: t.companies, body: companies ? `<ul class="plain">${companies}</ul>` : '' },
    {
      id: 'connections',
      title: t.connections,
      body: connectors
        ? `<div class="scroll"><table><thead><tr><th>${esc(t.person)}</th><th>${esc(t.inCompanies)}</th><th>${esc(t.role)}</th><th>${esc(t.status)}</th></tr></thead><tbody>${connectors}</tbody></table></div>`
        : '',
    },
    { id: 'ownership', title: t.ownership, body: ownership ? `<ul class="plain">${ownership}</ul>` : '' },
    { id: 'corrections', title: t.corrections, body: corrections ? `<ul class="plain">${corrections}</ul>` : '' },
  ].filter(p => p.body);
  const head = `<section id="annexes"><h2><span class="num">${num}</span>${esc(t.annexes)}</h2>`;
  // A single annex is just a block: a tab strip over one tab explores nothing.
  if (panels.length < 2) {
    return `${head}
${panels.map(p => annex(p.title, p.body, p.id)).join('\n')}
</section>`;
  }
  const strip = `<div class="annex-tabs" role="tablist" aria-label="${esc(t.explorer)}">${
    panels.map((p, i) => `<button type="button" role="tab" id="tab-${p.id}" aria-controls="${p.id}" aria-selected="${i === 0 ? 'true' : 'false'}" tabindex="${i === 0 ? 0 : -1}">${esc(p.title)}</button>`).join('')}</div>`;
  const body = panels.map((p, i) => `<div class="annex-panel" role="tabpanel" id="${p.id}" aria-labelledby="tab-${p.id}"${i === 0 ? '' : ' hidden'}>${annex(p.title, p.body)}</div>`).join('');
  return `${head}<h3 class="explorer">${esc(t.explorer)}</h3>${strip}${body}</section>`;
};

// The way back into the live map: every company the reader can be handed by
// key, the day this document was written (so the app can show what changed
// since), and where the visit came from. No key, no link — a name alone would
// resolve to the wrong company often enough to be worse than nothing.
const returnUrl = (doc, watch) => {
  const keyed = (doc.companies || []).filter(c => c.groupKey && c.name);
  const since = String(doc.generatedAt || '').slice(0, 10);
  // Without the day there is nothing to show changes *since*, and the link's
  // own label would read "Invalid Date" — so no day, no link.
  if (!keyed.length || !/^\d{4}-\d{2}-\d{2}$/.test(since)) return '';
  const p = new URLSearchParams();
  keyed.forEach(c => p.append('c', `${c.groupKey}|${c.name}`));
  p.set('since', since);
  p.set('source', 'sitrep');
  if (watch) p.set('watch', '1');
  return `${SITE}/app?${p}`;
};

export const renderFooter = (doc, t, lang) => {
  const back = returnUrl(doc, false);
  const links = back
    ? `<br><a href="${esc(back)}">${esc(t.returnLink(fmtDate(doc.generatedAt, lang)))}</a><br><a href="${esc(returnUrl(doc, true))}">${esc(t.watchLink)}</a>`
    : '';
  return `
<footer>${esc(t.sourceLine)}${doc.coverage?.since ? `<br>${esc(t.coverage(doc.coverage.since, doc.coverage.indexedThrough))}` : ''}
<br>${esc(t.generated)} ${esc(fmtDate(doc.generatedAt, lang))} · <a href="${SITE}">${esc(t.backLink)}</a>${links}</footer>`;
};
