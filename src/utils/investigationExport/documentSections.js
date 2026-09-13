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

const sectionList = (doc, t) => [
  doc.networkNote ? { id: 'summary', label: t.summaryNote } : null,
  { id: 'graph', label: t.map },
  (doc.steps || []).length ? { id: 'walkthrough', label: `${t.walkthroughSection} · ${t.steps(doc.steps.length)}` } : null,
  { id: 'annexes', label: t.annexes },
].filter(Boolean);

export const renderContents = (doc, t) => `
<nav class="contents" aria-label="${esc(t.contents)}">${sectionList(doc, t)
  .map((s, i) => `<a href="#${s.id}"><b>${i + 1}</b>${esc(s.label)}</a>`).join('')}</nav>`;

export const renderSummary = (doc, t) => (doc.networkNote
  ? `<section id="summary"><h2><span class="num">1</span>${esc(t.summaryNote)}</h2><p class="lead">${esc(doc.networkNote)}</p></section>`
  : '');

// A node is drawn flagged either because it IS an author-source step (the
// walkthrough narrates the note directly) or because an existing step's
// primary node carries an author note with a red/amber flag (draftWalkthrough
// attaches the note to the node's own step rather than inventing a new one).
const isFlaggedStep = s => (
  (s.source === 'author' && (s.flag === 'red' || s.flag === 'amber'))
  || (s.authorNote?.flag === 'red' || s.authorNote?.flag === 'amber')
);

export const renderMapFigure = (doc, graphData, t) => {
  const steps = doc.steps || [];
  const hasSteps = steps.length > 0;
  const flaggedIds = new Set(steps.filter(isFlaggedStep).map(s => s.nodeIds?.[0]).filter(Boolean));
  const c = doc.counts || {};
  const num = doc.networkNote ? 2 : 1;
  // The walkthrough has nothing to play until steps exist, so the button and
  // its panel would just be dead chrome — omit both rather than ship a
  // control with no wiring behind it yet.
  const controls = hasSteps
    ? `<div class="wt-controls hide-print"><button id="wt-start" class="primary">${esc(t.walkthrough)}</button></div>`
    : '';
  const panel = hasSteps
    ? `<div id="wt-panel" hidden>
    <div id="wt-eyebrow" class="eyebrow"></div>
    <strong id="wt-title"></strong>
    <p id="wt-text"></p>
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
  ${panel}
</figure></section>`;
};

const noteBlock = (note, t, flag) => (note?.text
  ? `<div class="note" style="${flagVar(flag || note.flag || 'none')}"><span class="who">${esc(t.authorNote)}</span>${esc(note.text)}</div>`
  : '');

export const renderChapters = (doc, t, wt) => {
  const steps = doc.steps || [];
  if (!steps.length) return '';
  const num = (doc.networkNote ? 2 : 1) + 1;
  const rows = steps.map((s, i) => {
    const isAuthor = s.source === 'author';
    const head = `<span class="src">${esc(wt.sources[s.source] || s.source)}</span>${esc(wt.sections[s.section] || s.section)}${s.date ? ` · ${esc(s.date)}` : ''}`;
    const body = isAuthor ? '' : `<p>${esc(s.text)}</p>`;
    const ev = s.evidence ? `<div class="ev">${esc(t.evidenceLabel)}: ${esc(s.evidence.kind)} · ${esc(s.evidence.ref)}</div>` : '';
    const note = isAuthor ? noteBlock({ text: s.text }, t, s.flag) : noteBlock(s.authorNote, t);
    return `<div class="chapter" id="ch-${i}"><div class="num" onclick="__sitrepShow(${i})">${String(i + 1).padStart(2, '0')}</div><div><div class="head">${head}</div><h3>${esc(s.title)}</h3>${body}${ev}${note}</div></div>`;
  }).join('');
  return `<section id="walkthrough"><h2><span class="num">${num}</span>${esc(t.walkthroughSection)}</h2><div class="chapters">${rows}</div></section>`;
};

const annex = (id, title, inner) => (inner ? `<div class="annex" id="${id}"><h3>${esc(title)}</h3>${inner}</div>` : '');

export const renderAnnexes = (doc, t) => {
  const companies = (doc.companies || []).map(c => `<li><strong>${esc(c.name)}</strong>${c.note?.text ? noteBlock(c.note, t) : ''}</li>`).join('');
  const connectors = (doc.connectors || []).map(c => `<tr>
    <td>${esc(c.name)} <em>(${c.type === 'entity' ? esc(t.entity) : esc(t.individual)})</em>${c.note?.text ? noteBlock(c.note, t) : ''}</td>
    <td>${(c.companies || []).map(esc).join(', ')}</td><td>${(c.roles || []).map(esc).join(' / ')}</td><td>${esc(t[c.status] || c.status)}</td></tr>`).join('');
  const ownership = (doc.ownership || []).map(o => `<li>${esc(o.owner)} ${esc(o.lost ? t.lostOf : t.soleOf)} ${esc(o.owned)}</li>`).join('');
  const corrections = (doc.corrections || []).map(c => `<li>${esc(c.nameA)} — ${esc(correctionVerb(t, c.action))}${c.nameB ? ` ${esc(c.nameB)}` : ''}${c.resignedDate ? ` <span class="date">(${esc(c.resignedDate)})</span>` : ''}</li>`).join('');
  const num = (doc.networkNote ? 2 : 1) + ((doc.steps || []).length ? 2 : 1);
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
