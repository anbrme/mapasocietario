/**
 * Chrome shared by every study page and by the studies hub.
 *
 * A study only earns links if a reader can cite it, and citations only stay
 * comparable if every study renders the same block. So the citation markup and
 * the analytics snippet live here once, not copy-pasted per study.
 */
import { citationText, formatMonth } from '../src/copy/studies.js';

export const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GA_ID = 'G-HHWT6ZTKZD';

/**
 * Page-view beacon for a standalone (non-SPA) page.
 *
 * Derives the path from the canonical link and NOTHING else: an earlier edition
 * of this snippet normalised location.pathname with a regex, and the escape
 * inside it did not survive the template literal it was embedded in, which sent
 * /empresa and the hub pages dark for six days. No regex here, no escapes to
 * lose.
 */
export const gaSnippet = () => `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer=window.dataLayer||[];
  function gtag(){dataLayer.push(arguments)}
  gtag('js',new Date());
  gtag('config','${GA_ID}',{send_page_view:false});
  var canonical=document.querySelector('link[rel="canonical"]');
  var pagePath=canonical?new URL(canonical.href,location.origin).pathname:location.pathname;
  gtag('event','page_view',{page_path:pagePath+location.search,page_title:document.title});
</script>`;

export const CITE_STYLE = `
  .cite{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:14px 0 0}
  .cite h3{margin:0 0 8px;font-size:14px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
  .cite p{margin:0;font-size:13.5px;line-height:1.55;color:#334155;word-break:break-word}
  .cite .dl{margin:12px 0 0;font-size:13px}
  .cite .dl a{font-weight:600}`;

const T = {
  es: {
    heading: 'Cómo citar este estudio',
    licence: 'Puedes reproducir estas cifras citando la fuente.',
    csv: 'Descargar los datos (CSV)',
  },
  en: {
    heading: 'How to cite this study',
    licence: 'You may reproduce these figures with attribution.',
    csv: 'Download the data (CSV)',
  },
};

/**
 * The citation block. `csvHref` is optional — a study without a tabular result
 * simply omits the download rather than shipping an empty file.
 */
export function citationBlock(study, lang, asOf, siteUrl, csvHref) {
  const t = T[lang];
  const cite = citationText(study, lang, asOf, siteUrl);
  const download = csvHref
    ? `<p class="dl"><a href="${esc(csvHref)}" download>${esc(t.csv)}</a></p>`
    : '';
  return `<div class="cite">
    <h3>${esc(t.heading)}</h3>
    <p>${esc(cite)}</p>
    <p class="dl">${esc(t.licence)}</p>
    ${download}
  </div>`;
}

/** RFC 4180-ish: quote every field, double any embedded quote. */
export const toCsv = (rows) =>
  rows.map((row) => row.map((cell) => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(',')).join('\r\n') + '\r\n';

export { citationText, formatMonth };
