// Assembles the situation report into ONE self-contained .html file: inline
// CSS (fonts embedded), inline data, inline script. Opens offline, survives
// being forwarded, prints from the browser. Identity: an authored document,
// sourced by us — never styled as a Mapa Societario deliverable.
import { escapeHtml as esc } from '../escapeHtml';
import { exportCopy } from './exportCopy';
import { walkthroughCopy, stepKindLabel } from '../walkthrough/walkthroughCopy';
import { DOCUMENT_STYLE } from './documentStyle';
import { WALKTHROUGH_SCRIPT } from './walkthroughScript';
import {
  renderCover, renderContents, renderSummary, renderChronology, renderStory, renderAnnexes, renderFooter,
  stepEvidenceLine,
} from './documentSections';

export function buildExportHtml(doc, graphData, { lang = 'es' } = {}) {
  const safeDoc = doc || {};
  const t = exportCopy(lang);
  const wt = walkthroughCopy(lang);
  const steps = (safeDoc.steps || []).map(s => ({
    key: s.key,
    kind: s.kind,
    kindLabel: stepKindLabel(s, wt),
    sourceLabel: wt.sources[s.source] || s.source || '',
    title: s.title,
    summary: s.summary || s.text || '',
    evidenceLine: stepEvidenceLine(s, wt),
    narrative: s.narrative || (s.authorNote ? { text: s.authorNote.text, flag: s.authorNote.flag } : null),
    nodeIds: s.nodeIds,
    linkKeys: s.linkKeys || [],
    flag: s.flag,
    moment: s.moment || null,
  }));
  // JSON is embedded as text, so "</script>" inside a note would close the tag.
  // `registryAsOf('{d}')` hands the script the sentence, not the date: it
  // swaps {d} for whichever day the slider is standing on.
  const stepJson = JSON.stringify({
    steps,
    opening: safeDoc.opening || null,
    noteLabel: t.authorNote,
    timeline: safeDoc.timeline || null,
    lang: lang === 'en' ? 'en' : 'es',
    registryAsOf: t.registryAsOf('{d}'),
  }).replace(/</g, '\\u003c');

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
${renderChronology(safeDoc, t, wt, lang)}
${renderStory(safeDoc, graphData, t, wt, lang)}
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
