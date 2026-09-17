// One pure renderer per section of the situation report. Each returns an HTML
// string, or '' when the section has nothing to say — the orchestrator and the
// contents strip both rely on '' meaning "omit".
import { escapeHtml as esc } from '../escapeHtml';
import { stepKindLabel } from '../walkthrough/walkthroughCopy';
import { isProxyRole } from '../walkthrough/stepEvidence';
import { publishableAnnotations } from '../walkthrough/applyWalkthroughEdits';
import {
  annexRows, chronologyEntries, hasAnnexes, hasChronology, isDay, stepEvidenceLine,
} from '../sitrepModel';
import { isoDayLong } from '../isoDay';
import { correctionVerb } from './exportCopy';
import { renderGraphSvg } from './renderGraphSvg';
import { flagVar } from './documentStyle';
import { looksLikeGroupKey } from '../companyName';
import { RETURN_COMPANY_CAP } from '../returnParams';

// Re-exported: both belong to the document model now, and callers (including
// this file's tests) reach them through the renderer they already import.
export { annexRows, stepEvidenceLine };

const SITE = 'https://mapasocietario.es';

const fmtDate = (iso, lang) => new Date(iso).toLocaleDateString(
  lang === 'en' ? 'en-GB' : 'es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

const fmtDay = isoDayLong;

const authorLine = (doc, t) => {
  const parts = [doc.author?.name, doc.author?.organisation].map(v => String(v || '').trim()).filter(Boolean);
  return parts.length ? ` · ${esc(t.elaboratedBy)} ${esc(parts.join(' · '))}` : '';
};

// One escaped anchor for a citation, honouring the security rule everywhere a
// citation surfaces: only an http(s) url ever becomes an <a href>, anything
// else — including a blank or javascript: url — prints as escaped text.
const citationHtml = citation => {
  if (!citation) return '';
  const label = citation.text || citation.url || '';
  if (!label) return '';
  return citation.url && /^https?:\/\//i.test(citation.url)
    ? `<a href="${esc(citation.url)}">${esc(label)}</a>`
    : esc(label);
};

// Five quiet numbers under the title: what the map holds, how many steps the
// story has, how many notes the author wrote, and the day the registry was
// read. A fact with nothing to say is left out rather than shown as zero.
const renderFacts = (doc, t, lang) => {
  const c = doc.counts || {};
  const steps = (doc.steps || []).length;
  const fact = (n, label) => `<li><b>${esc(String(n))}</b><span>${esc(label)}</span></li>`;
  const items = [];
  if (c.companies) items.push(fact(c.companies, t.facts.companies(c.companies)));
  if (c.officers) items.push(fact(c.officers, t.facts.people(c.officers)));
  if (steps) items.push(fact(steps, t.facts.steps(steps)));
  if (c.notes) items.push(fact(c.notes, t.facts.notes(c.notes)));
  if (doc.generatedAt) items.push(fact(fmtDate(doc.generatedAt, lang), t.facts.registry));
  return items.length ? `<ul class="facts">${items.join('')}</ul>` : '';
};

export const renderCover = (doc, t, lang) => `
<header class="cover">
  <div class="eyebrow">${esc(t.title)}</div>
  <h1>${esc(doc.subject || t.title)}</h1>
  <div class="meta">${esc(t.generated)} ${esc(fmtDate(doc.generatedAt, lang))}${authorLine(doc, t)}</div>
  ${doc.counts?.authorElements > 0 ? `<p class="notice">${esc(t.authorNotice)}</p>` : ''}
  ${renderFacts(doc, t, lang)}
  <div class="status">${esc(t.nonAuthoritative)}<br>${esc(t.sourceLine)}</div>
</header>`;

// Section numbers, computed once from the same rules that decide whether a
// section renders at all, so the contents nav and every <h2> agree.
const sectionNumbers = doc => {
  let n = 0;
  const summary = doc.networkNote ? (n += 1) : null;
  const chronology = hasChronology(doc) ? (n += 1) : null;
  const map = (n += 1);
  const chapters = (doc.steps || []).length ? (n += 1) : null;
  const annexes = hasAnnexes(doc) ? (n += 1) : null;
  return {
    summary, chronology, map, chapters, annexes,
  };
};

// The story's moments in date order, each a link into its chapter: the
// sequence of events before the story tells them.
export const renderChronology = (doc, t, wt, lang = 'es') => {
  if (!hasChronology(doc)) return '';
  const num = sectionNumbers(doc).chronology;
  const items = chronologyEntries(doc).map(e => {
    const middle = e.note
      ? `<span class="entry"><a href="#ch-${e.index}">${esc(e.title)}</a><em>${esc(e.note)}</em></span>`
      : `<a href="#ch-${e.index}">${esc(e.title)}</a>`;
    const label = e.step ? stepKindLabel(e.step, wt) : t.authorNote;
    return `<li><time datetime="${esc(e.date)}">${esc(fmtDay(e.date, lang))}</time>${middle}<span class="kind">${esc(label)}</span></li>`;
  }).join('');
  return `<section id="chronology"><h2><span class="num">${num}</span>${esc(t.chronology)}</h2><ol class="chrono">${items}</ol></section>`;
};

export const renderContents = (doc, t) => {
  const steps = doc.steps || [];
  const nums = sectionNumbers(doc);
  const items = [];
  if (nums.summary != null) items.push(`<a href="#summary"><b>${nums.summary}</b>${esc(t.summaryNote)}</a>`);
  if (nums.chronology != null) items.push(`<a href="#chronology"><b>${nums.chronology}</b>${esc(t.chronology)}</a>`);
  items.push(`<a href="#graph"><b>${nums.map}</b>${esc(t.map)}</a>`);
  if (nums.chapters != null) {
    items.push(`<a href="#walkthrough"><b>${nums.chapters}</b>${esc(t.walkthroughSection)}</a>`);
    // The chapter list is its own row under the section names, so a long
    // title never breaks the section strip mid-list.
    items.push(`<span class="subs">${steps.map((s, i) => `<a href="#ch-${i}" class="sub">${esc(t.chapterLabel(i + 1, s.title))}</a>`).join('')}</span>`);
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
  const pinned = (doc.steps || []).flatMap(s => [s.moment, ...(s.annotations || []).map(a => a?.date)]);
  const ticks = [...new Set(pinned.filter(d => idx.has(d)).map(d => idx.get(d)))]
    .sort((a, b) => a - b).map(i => `<option value="${i}"></option>`).join('');
  // The empty span stays even with nothing to count: the script looks it up
  // unconditionally. The separator does not — a trailing ' · ' reads as a
  // truncated sentence.
  const undated = tl.undated > 0
    ? ` · <span id="wt-undated">${esc(t.undated(tl.undated))}</span>`
    : '<span id="wt-undated"></span>';
  const asOf = esc(t.registryAsOf(fmtDay(tl.readOn, lang)));
  return `<div id="wt-time" class="hide-print">
    <input type="range" id="wt-slider" min="0" max="${tl.dates.length - 1}" step="1" value="${tl.dates.length - 1}" list="wt-ticks" aria-label="${asOf}" aria-valuetext="${asOf}">
    <datalist id="wt-ticks">${ticks}</datalist>
    <div class="meta"><span id="wt-date">${asOf}</span>${undated}</div>
  </div>`;
};

export const renderMapFigure = (doc, graphData, t, lang = 'es') => {
  const steps = doc.steps || [];
  const hasSteps = steps.length > 0;
  const flaggedIds = new Set(steps.filter(isFlaggedStep).map(s => s.nodeIds?.[0]).filter(Boolean));
  const stepIds = new Set(steps.map(s => s.nodeId || s.nodeIds?.[0]).filter(Boolean));
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
    <div class="wt-tools hide-print"><button id="wt-print">${esc(t.print)}</button><button id="wt-share" title="${esc(t.shareHint)}">${esc(t.share)}</button><button id="wt-save">${esc(t.saveCopy)}</button><button id="wt-present" title="${esc(t.presentHint)}">${esc(t.present)}</button></div>
  </div>`
    : '';
  return `
<section id="graph"><h2><span class="num">${num}</span>${esc(t.map)}</h2>
<noscript><p class="nojs-note">${esc(t.noScript)}</p></noscript>
<figure>
  <div class="frame">
    ${renderGraphSvg(graphData, { flaggedIds, stepIds })}
  </div>
  <figcaption>
    <span>${esc(t.mapCaption(c.companies || 0, c.officers || 0, c.sharedPeople || 0))}</span>
    <span class="legend"><span><i class="co"></i>${esc(t.legendCompany)}</span><span><i class="of"></i>${esc(t.legendPerson)}</span><span><i class="live"></i>${esc(t.legendActive)}</span><span><i class="ceased"></i>${esc(t.legendCeased)}</span><span><i class="own"></i>${esc(t.legendOwnership)}</span><span><i class="flag"></i>${esc(t.legendFlag)}</span></span>
  </figcaption>
</figure>
${renderTimeControl(doc, t, lang)}
${panel}
</section>`;
};

const noteBlock = (note, t, flag) => (note?.text
  ? `<div class="note" style="${flagVar(flag || note.flag || 'none')}"><span class="who">${esc(t.authorNote)}</span>${esc(note.text)}</div>`
  : '');

// The author's dated notes for a chapter, oldest first — the chapter's own
// moment pins the map to one day, these say what happened on the others.
const datedNotesBlock = (step, wt, lang) => {
  const rows = publishableAnnotations(step);
  if (!rows.length) return '';
  const items = rows.map(a => `<li><time datetime="${esc(a.date)}">${esc(fmtDay(a.date, lang))}</time><span>${esc(String(a.text).trim())}</span></li>`).join('');
  return `<div class="dated"><h4>${esc(wt.datedNotes)}</h4><ul>${items}</ul></div>`;
};

const kv = (label, value) => (value ? `<p class="kv">${label ? `${esc(label)}: ` : ''}${esc(value)}</p>` : '');

// A registry day never wraps into "2011-12-" / "23": date-shaped cells get
// the nowrap class the annex tables already use (isDay, from the model).
//
// A cell is normally a plain value, auto-escaped and auto-dated. A row can
// instead hand back `rawCell(html)` for a cell it has already built itself
// (pre-escaped) — the one case here is the hop-swatch prefix on an asserted
// row's role cell, which needs a small inline marker no plain string can
// carry without either escaping it away or losing the security guarantee.
const rawCell = html => ({ raw: html });

const evidenceTable = (columns, rows, cells, rowClass) => (rows.length
  ? `<div class="scroll"><table><thead><tr>${Object.values(columns).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr${rowClass && rowClass(r) ? ` class="${esc(rowClass(r))}"` : ''}>${cells(r).map(v => (
      v && typeof v === 'object'
        ? `<td>${v.raw}</td>`
        : `<td${isDay(v) ? ' class="date"' : ''}>${esc(v || '')}</td>`
    )).join('')}</tr>`).join('')
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
  if (blocks.board !== false && (ev.board || []).length) parts.push(boardBlock(ev, wt));
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
  // A unified company also holds seats elsewhere — the same table a person
  // chapter shows, under its own company evidence.
  parts.push(seatsTable(s, wt));
  return parts.join('');
};

const seatsTable = (s, wt) => {
  const seats = s.evidence?.seats || [];
  if (!seats.length) return '';
  return `<h4>${esc(wt.subheads.seats)}</h4>${evidenceTable(wt.seatColumns, seats,
    r => [r.company, r.role, r.since, r.until, wt.statusWords[r.status] || r.status])}`;
};

// The roster, whole: the governing body first (current rows open, ceased
// folded), then the powers of attorney folded under their count — they are
// not the governing body and they are what makes the list long. Folds open
// for print. Then how many of these seats the map actually holds.
const rosterTables = (rows, wt) => {
  const active = rows.filter(r => r.status === 'active');
  const ceased = rows.filter(r => r.status !== 'active');
  const table = list => evidenceTable(wt.boardColumns, list, r => [r.name, r.role, r.since, r.until, wt.statusWords[r.status] || r.status]);
  const fold = ceased.length
    ? `<details class="fold"><summary>${esc(wt.ceasedFold(ceased.length))}</summary>${table(ceased)}</details>`
    : '';
  return `${table(active)}${fold}`;
};
const boardBlock = (ev, wt) => {
  const rows = ev.board || [];
  const isProxy = r => (r.category ? r.category === 'Apoderado' : isProxyRole(r.role));
  const governing = rows.filter(r => !isProxy(r));
  const proxies = rows.filter(isProxy);
  const parts = [];
  if (governing.length) parts.push(`<h4>${esc(wt.subheads.board)}</h4>${rosterTables(governing, wt)}`);
  if (proxies.length) {
    parts.push(`<details class="fold proxies"><summary>${esc(wt.proxiesFold(proxies.length))}</summary>${rosterTables(proxies, wt)}</details>`);
  }
  if (Number.isFinite(ev.onMap)) parts.push(`<p class="kv onmap">${esc(wt.onMapLine(ev.onMap, rows.length))}</p>`);
  return parts.join('');
};

const personEvidenceBlock = (s, wt) => seatsTable(s, wt);

// A connection chapter's evidence is the path itself: one row per hop. A hop
// the author asserted (origin: 'author') is never mixed in with the ones the
// registry stands behind: its status cell reads "asserted" rather than a
// registry status word, its role cell carries a dotted swatch to match the
// map's own author stroke, and the whole row gets the hop-author class the
// stylesheet italicises. The path's author-hop count, if any, gets its own
// note under the table.
const connectionEvidenceBlock = (s, t, wt) => {
  const hops = s.evidence?.hops || [];
  if (!hops.length) return '';
  const table = evidenceTable(wt.hopColumns, hops, r => [
    r.who,
    r.at,
    r.origin === 'author' ? rawCell(`<span class="swatch"></span>${esc(r.role || '')}`) : r.role,
    r.origin === 'author' ? t.asserted : (wt.statusWords[r.status] || r.status),
    r.since,
    r.until,
  ], r => (r.origin === 'author' ? 'hop-author' : ''));
  const authorHops = s.evidence?.authorHops || 0;
  const note = authorHops > 0 ? `<p class="note">${esc(t.hopAuthorNote(authorHops))}</p>` : '';
  return `<p>${esc(s.summary || s.text || '')}</p>${table}${note}`;
};

const evidenceBlockFor = (s, t, wt, blocks) => {
  if (s.kind === 'person') return personEvidenceBlock(s, wt);
  if (s.kind === 'connection') return connectionEvidenceBlock(s, t, wt);
  return companyEvidenceBlock(s, t, wt, blocks);
};

// The author links that touch this chapter's own node — either end of the
// link, so a company chapter shows a link the author drew away from it just
// as readily as one drawn onto it.
const authorLinksFor = (doc, nodeId) => {
  if (nodeId == null) return [];
  const links = doc.authorLayer?.links || [];
  return links.filter(l => l.fromId === nodeId || l.toId === nodeId);
};

const authorLinksBlock = (doc, step, t) => {
  const links = authorLinksFor(doc, step.nodeId);
  if (!links.length) return '';
  const rows = links.map(l => {
    const source = citationHtml(l.citation);
    return `<li>${esc(l.from)} → ${esc(l.to)} · ${esc(l.label)}${source ? ` · ${source}` : ''}</li>`;
  }).join('');
  return `<h4>${esc(t.authorLayer)}</h4><ul class="plain">${rows}</ul>`;
};

export const renderChapters = (doc, t, wt, lang = 'es') => {
  const steps = doc.steps || [];
  if (!steps.length) return '';
  // Any block missing from doc.blocks defaults to shown — the same rule
  // companyEvidenceBlock's per-block `!== false` checks already apply.
  const blocks = doc.blocks || {};
  const num = sectionNumbers(doc).chapters;
  const rows = steps.map((s, i) => {
    const head = `<span class="src">${esc(wt.sources[s.source] || s.source || '')}</span>${esc(stepKindLabel(s, wt))}${s.moment ? ` · ${esc(fmtDay(s.moment, lang))}` : ''}`;
    const narrative = noteBlock(s.narrative || s.authorNote, t);
    const dated = datedNotesBlock(s, wt, lang);
    const evidence = evidenceBlockFor(s, t, wt, blocks);
    const authorLinks = authorLinksBlock(doc, s, t);
    return `<div class="chapter" id="ch-${i}" data-i="${i}" data-moment="${esc(s.moment || '')}"><button type="button" class="num" onclick="__sitrepShow(${i})">${String(i + 1).padStart(2, '0')}</button><div><div class="head">${head}</div><h3>${esc(s.title)}</h3>${narrative}${dated}${evidence}${authorLinks}</div></div>`;
  }).join('');
  // Slide zero of the presentation: the opening, shown where a chapter would
  // be while the map stands whole. Inert outside presenting.
  const opening = doc.opening && (doc.opening.title || doc.opening.line)
    ? `<div id="wt-slide0" class="slide0"><strong>${esc(doc.opening.title || '')}</strong><p>${esc(doc.opening.line || '')}</p></div>`
    : '';
  return `<section id="walkthrough"><h2><span class="num">${num}</span>${esc(t.walkthroughSection)}</h2>${opening}<div class="chapters">${rows}</div></section>`;
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
// One annex block. `id` is carried by the block itself only when it stands
// alone; inside the tabbed explorer the panel owns the id, so the block goes
// id-free and the document keeps one element per id.
const annex = (title, inner, id) => (inner
  ? `<div class="annex"${id ? ` id="${esc(id)}"` : ''}><h3>${esc(title)}</h3>${inner}</div>`
  : '');

export const renderAnnexes = (doc, t) => {
  if (!hasAnnexes(doc)) return '';
  const rows = annexRows(doc);
  // A company that is not a chapter still says how much of it the map holds,
  // so the annex never reads as an empty table.
  const officersOf = name => (doc.officersByCompany?.[name] || []).length;
  const companies = rows.companies.map(c => `<li><strong>${esc(c.name)}</strong><span class="kv">${esc(t.officersVisible(officersOf(c.name)))}</span>${c.note?.text ? noteBlock(c.note, t) : ''}</li>`).join('');
  const connectors = rows.connectors.map(c => `<tr>
    <td>${esc(c.name)} <em>(${c.type === 'entity' ? esc(t.entity) : esc(t.individual)})</em>${c.note?.text ? noteBlock(c.note, t) : ''}</td>
    <td>${(c.companies || []).map(esc).join(', ')}</td><td>${(c.roles || []).map(esc).join(' / ')}</td><td>${esc(t[c.status] || c.status)}</td></tr>`).join('');
  const ownership = rows.ownership.map(o => `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');
  const registryCorrections = rows.corrections.map(c => `<li>${esc(c.nameA)} — ${esc(correctionVerb(t, c.action))}${c.nameB ? ` ${esc(c.nameB)}` : ''}${c.resignedDate ? ` <span class="date">(${esc(c.resignedDate)})</span>` : ''}</li>`).join('');
  // The author's own corrections — a dismissed registry link, a renamed
  // registry node — sit in the same annex as the registry-sourced ones
  // above: both are things the author changed about what the registry said.
  const authorCorrections = [
    ...rows.authorLayer.dismissed.map(d => `<li>${esc(d.from)} — ${esc(d.to)}: ${esc(t.actionDismissed)}${d.reason ? ` (${esc(d.reason)})` : ''}</li>`),
    ...rows.authorLayer.renamed.map(r => `<li>${esc(r.name)} — ${esc(t.actionRenamed)} ${esc(r.registryName)}</li>`),
  ].join('');
  const corrections = registryCorrections + authorCorrections;
  // The relationships the author drew (a table: from, to, label, source,
  // date, note) and the entities the author added (a flat list) — empty
  // string when both are empty, so the panel hides like every other one.
  const authorLinkRows = rows.authorLayer.links.map(l => {
    const source = citationHtml(l.citation);
    return `<tr><td>${esc(l.from)}</td><td>→</td><td>${esc(l.to)}</td><td>${esc(l.label)}</td><td>${source}</td><td${isDay(l.asserted) ? ' class="date"' : ''}>${esc(l.asserted || '')}</td><td>${esc(l.note || '')}</td></tr>`;
  }).join('');
  const authorEntityRows = rows.authorLayer.nodes.map(n => {
    const source = citationHtml(n.citation);
    const kind = n.kind === 'company' ? t.entity : t.individual;
    return `<li>${esc(n.name)} · ${esc(kind)} · ${esc(n.country || '')} · ${esc(n.identifier || '')} · ${source} · ${esc(n.note || '')}</li>`;
  }).join('');
  const authorLayerBody = [
    authorLinkRows ? `<h4>${esc(t.authorRelationships)}</h4><div class="scroll"><table><tbody>${authorLinkRows}</tbody></table></div>` : '',
    authorEntityRows ? `<h4>${esc(t.authorEntities)}</h4><ul class="plain">${authorEntityRows}</ul>` : '',
  ].filter(Boolean).join('');
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
    { id: 'authorLayer', title: t.authorLayer, body: authorLayerBody },
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
  // parseReturnParams drops any pair whose key is not entity-shaped and reads
  // at most RETURN_COMPANY_CAP of them, so the document promises exactly what
  // the app will honour — a hash-shaped duplicate key or the thirteenth
  // company would otherwise vanish on arrival with no explanation.
  const keyed = (doc.companies || [])
    .filter(c => c.name && looksLikeGroupKey(c.groupKey))
    .slice(0, RETURN_COMPANY_CAP);
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
