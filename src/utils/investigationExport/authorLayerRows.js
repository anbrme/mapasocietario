// Pure row-builders for the author layer's relationships table, entities
// list and dismissed/renamed corrections — shared by the exported .html
// annex panel (documentSections.js) and the Copy-for-Word paste
// (relationshipReportHtml.js), which render the exact same rows for these
// three pieces of the document.
//
// Deliberately free of any import that pulls in the map renderer or the
// document stylesheet: the Word path loads this module directly and must
// never drag renderGraphSvg.js or documentStyle.js into its bundle.
//
// Pure: strings and plain objects in, HTML strings out.

import { escapeHtml as esc } from '../escapeHtml';
import { isDay } from '../sitrepModel';
import { correctionVerb } from './exportCopy';

// One escaped anchor for a citation, honouring the security rule everywhere a
// citation surfaces: only an http(s) url ever becomes an <a href>, anything
// else — including a blank or javascript: url — prints as escaped text.
export const citationHtml = citation => {
  if (!citation) return '';
  const label = citation.text || citation.url || '';
  if (!label) return '';
  return citation.url && /^https?:\/\//i.test(citation.url)
    ? `<a href="${esc(citation.url)}">${esc(label)}</a>`
    : esc(label);
};

// The relationships table's header row: From / To / Label / Source / Date /
// Note, plus a blank header over the direction column between From and To.
export const authorLinkTableHead = t => (
  `<thead><tr><th>${esc(t.colFrom)}</th><th></th><th>${esc(t.colTo)}</th>`
  + `<th>${esc(t.colLabel)}</th><th>${esc(t.source)}</th><th>${esc(t.colDate)}</th><th>${esc(t.colNote)}</th></tr></thead>`
);

// An arrow is a claim about direction, so it is drawn only for a link the
// author marked directed; an undirected relationship gets a plain dash and
// reads as the mutual statement it is.
const directionGlyph = link => (link.directed ? '→' : '—');

export const authorLinkRows = links => links.map(l => {
  const source = citationHtml(l.citation);
  return `<tr><td>${esc(l.from)}</td><td>${directionGlyph(l)}</td><td>${esc(l.to)}</td><td>${esc(l.label)}</td><td>${source}</td>`
    + `<td${isDay(l.asserted) ? ' class="date"' : ''}>${esc(l.asserted || '')}</td><td>${esc(l.note || '')}</td></tr>`;
}).join('');

// The author links that touch a given node — either end of the link, so a
// chapter shows a link the author drew away from its node just as readily as
// one drawn onto it. Shared by a chapter's own author-links list in both
// documents (the exported annex's per-chapter block and the Word paste).
export const linksTouchingNode = (links, nodeId) => {
  if (nodeId == null) return [];
  return (links || []).filter(l => l.fromId === nodeId || l.toId === nodeId);
};

// One plain <li> per author link, for a chapter's own "Added by the author"
// list: from → to · label · source, the source honouring the same
// http(s)-only citation rule as the relationships table.
export const authorLinkListItems = links => links.map(l => {
  const source = citationHtml(l.citation);
  return `<li>${esc(l.from)} ${directionGlyph(l)} ${esc(l.to)} · ${esc(l.label)}${source ? ` · ${source}` : ''}</li>`;
}).join('');

// Non-empty fields only, joined by ' · ' — an entity with no country, no
// identifier and no note must never leave a dangling separator behind.
const joinNonEmpty = parts => parts.filter(Boolean).join(' · ');

export const authorEntityRows = (nodes, t) => nodes.map(n => {
  const source = citationHtml(n.citation);
  const kind = n.kind === 'company' ? t.entity : t.individual;
  const fields = [
    esc(n.name), esc(kind), n.country ? esc(n.country) : '',
    n.identifier ? esc(n.identifier) : '', source, n.note ? esc(n.note) : '',
  ];
  return `<li>${joinNonEmpty(fields)}</li>`;
}).join('');

// The author's own corrections — a dismissed registry link, a renamed
// registry node — routed through the shared correction-verb map so their
// wording never drifts from the registry-sourced corrections beside them.
export const authorCorrectionRows = (authorLayer, t) => [
  ...(authorLayer?.dismissed || []).map(d => `<li>${esc(d.from)} — ${esc(d.to)}: ${esc(correctionVerb(t, 'dismissed'))}${d.reason ? ` (${esc(d.reason)})` : ''}</li>`),
  ...(authorLayer?.renamed || []).map(r => `<li>${esc(r.name)} — ${esc(correctionVerb(t, 'renamed'))} ${esc(r.registryName)}</li>`),
].join('');
