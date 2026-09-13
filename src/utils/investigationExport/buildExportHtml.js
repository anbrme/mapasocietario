// Assembles the situation report into ONE self-contained .html file: inline
// CSS (fonts embedded), inline data, inline script. Opens offline, survives
// being forwarded, prints from the browser. Identity: an authored document,
// sourced by us — never styled as a Mapa Societario deliverable.
import { escapeHtml as esc } from '../escapeHtml';
import { exportCopy } from './exportCopy';
import { walkthroughCopy } from '../walkthrough/walkthroughCopy';
import { DOCUMENT_STYLE } from './documentStyle';
import { WALKTHROUGH_SCRIPT } from './walkthroughScript';
import {
  renderCover, renderContents, renderSummary, renderMapFigure, renderChapters, renderAnnexes, renderFooter,
} from './documentSections';

export function buildExportHtml(doc, graphData, { lang = 'es' } = {}) {
  const safeDoc = doc || {};
  const t = exportCopy(lang);
  const wt = walkthroughCopy(lang);
  const steps = (safeDoc.steps || []).map(s => ({
    key: s.key, section: s.section, nodeIds: s.nodeIds, linkKeys: s.linkKeys || [],
    title: s.title, text: s.text, source: s.source, date: s.date, flag: s.flag,
    authorNote: s.authorNote ? { text: s.authorNote.text, flag: s.authorNote.flag } : null,
    sectionLabel: wt.sections[s.section] || s.section,
    sourceLabel: wt.sources[s.source] || s.source,
  }));
  // JSON is embedded as text, so "</script>" inside a note would close the tag.
  const stepJson = JSON.stringify({ steps }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(t.title)}${safeDoc.subject ? ` — ${esc(safeDoc.subject)}` : ''}</title>
<style>${DOCUMENT_STYLE}</style>
</head>
<body>
<div class="wrap">
${renderCover(safeDoc, t, lang)}
${renderContents(safeDoc, t)}
${renderSummary(safeDoc, t)}
${renderMapFigure(safeDoc, graphData, t)}
${renderChapters(safeDoc, t, wt)}
${renderAnnexes(safeDoc, t)}
${renderFooter(safeDoc, t, lang)}
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
