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

/**
 * The shared visual system for a study page: tokens, typography, figure and
 * table chrome. Kept here so a second study cannot drift into a second look.
 *
 * Three theme states, deliberately: the bare :root carries the full light
 * palette, the media query only redefines tokens (guarded so an explicit light
 * choice still wins), and [data-theme="dark"] redefines them again. Nothing
 * declares a colour only inside a media block.
 */
export const PAGE_STYLE = `
:root{
  --paper:#F6F5F2; --raise:#FFFFFF; --ink:#191E24; --ink-2:#4A555F; --ink-3:#77838D;
  --rule:#DFDDD7; --rule-2:#EDEBE6;
  --teal:#0B8C7D; --amber:#B54A08; --base-ink:#8A9299; --stamp:#0B8C7D;
  --shadow:0 1px 2px rgba(25,30,36,.05),0 8px 24px -12px rgba(25,30,36,.18);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --paper:#14181C; --raise:#1B2126; --ink:#E7EAEC; --ink-2:#A8B2BA; --ink-3:#7C868E;
    --rule:#2B3339; --rule-2:#222A2F;
    --teal:#14A18F; --amber:#CE6A1B; --base-ink:#7B858D; --stamp:#14A18F;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"]{
  --paper:#14181C; --raise:#1B2126; --ink:#E7EAEC; --ink-2:#A8B2BA; --ink-3:#7C868E;
  --rule:#2B3339; --rule-2:#222A2F;
  --teal:#14A18F; --amber:#CE6A1B; --base-ink:#7B858D; --stamp:#14A18F;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.6);
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font:400 17px/1.65 "IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.col{max-width:660px;margin-inline:auto}
a{color:var(--stamp)}
h1,h2,h3{font-family:"IBM Plex Serif",Georgia,"Times New Roman",serif;text-wrap:balance;margin:0}
.eyebrow{font:500 11.5px/1.4 "IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
header.mast{border-bottom:1px solid var(--rule);padding:44px 0 40px}
header.mast .col{display:flex;flex-direction:column;gap:18px}
nav.crumbs{font-size:13px;color:var(--ink-3)}
nav.crumbs .langs{float:right}
h1{font-size:clamp(31px,5vw,50px);line-height:1.08;font-weight:600;letter-spacing:-.015em}
.dek{font-size:19px;line-height:1.6;color:var(--ink-2);margin:0}
.byline{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline;
  font:400 13px/1.5 "IBM Plex Mono",ui-monospace,monospace;color:var(--ink-3);
  padding-top:6px;border-top:1px solid var(--rule-2)}
.byline b{color:var(--ink-2);font-weight:500}
.hero-num{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1px;
  background:var(--rule);border:1px solid var(--rule);border-radius:3px;overflow:hidden;margin:36px 0 0}
.hero-num div{background:var(--raise);padding:20px 22px}
.hero-num .n{font:600 34px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums;color:var(--stamp)}
.hero-num .n.plain{color:var(--ink)}
.hero-num .t{font-size:13.5px;line-height:1.45;color:var(--ink-2);margin-top:9px}
section{padding:52px 0;border-bottom:1px solid var(--rule-2)}
section:last-of-type{border-bottom:0}
h2{font-size:clamp(23px,3.1vw,30px);line-height:1.2;font-weight:600;letter-spacing:-.01em;margin-bottom:14px}
h3{font-size:17px;font-weight:600;margin:26px 0 8px}
p{margin:0 0 16px}p:last-child{margin-bottom:0}
.lede{font-size:18.5px;color:var(--ink-2)}
strong{font-weight:600;color:var(--ink)}
.fig{margin:28px 0 0}
.fig figcaption{font-size:13.5px;line-height:1.55;color:var(--ink-3);margin-top:14px;
  padding-left:13px;border-left:2px solid var(--rule)}
.plot{background:var(--raise);border:1px solid var(--rule);border-radius:3px;
  padding:20px 18px 14px;position:relative;overflow-x:auto}
svg{display:block;width:100%;height:auto;overflow:visible}
.ax text,.lbl{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;fill:var(--ink-3)}
.ax line{stroke:var(--rule);stroke-width:1}
.val{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;font-weight:500;fill:var(--ink-2)}
.val.hi{fill:var(--ink);font-weight:600}
.ctrls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px}
[role=tablist]{display:inline-flex;gap:2px;background:var(--rule-2);padding:2px;border-radius:3px}
[role=tab]{appearance:none;border:0;background:transparent;cursor:pointer;color:var(--ink-2);
  font:500 12.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.03em;padding:8px 13px;border-radius:2px}
[role=tab][aria-selected=true]{background:var(--raise);color:var(--ink);box-shadow:var(--shadow)}
[role=tab]:focus-visible,.tgl:focus-visible{outline:2px solid var(--stamp);outline-offset:2px}
.tgl{appearance:none;border:1px solid var(--rule);background:var(--raise);cursor:pointer;color:var(--ink-2);
  font:500 12.5px/1 "IBM Plex Mono",ui-monospace,monospace;padding:8px 13px;border-radius:3px;margin-left:auto}
.tgl[aria-pressed=true]{border-color:var(--stamp);color:var(--stamp)}
.key{display:flex;flex-wrap:wrap;gap:8px 18px;margin:14px 0 0;font-size:12.5px;color:var(--ink-2)}
.key span{display:inline-flex;align-items:center;gap:7px}
.key i{width:13px;height:13px;border-radius:2px;flex:none}
.tip{position:absolute;pointer-events:none;z-index:9;background:var(--ink);color:var(--paper);
  font:400 12px/1.5 "IBM Plex Mono",ui-monospace,monospace;padding:8px 11px;border-radius:3px;
  transform:translate(-50%,-100%);white-space:nowrap;box-shadow:var(--shadow)}
.tip b{font-weight:600}.tip .s{opacity:.7}
.tbl-wrap{overflow-x:auto;margin-top:16px}
table{border-collapse:collapse;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}
caption{text-align:left;font-size:12.5px;color:var(--ink-3);padding-bottom:9px}
th,td{padding:9px 12px;border-bottom:1px solid var(--rule-2);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}
thead th{font:500 11.5px/1.4 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-3);border-bottom:1px solid var(--rule)}
tbody tr:last-child td{border-bottom:0}
td.mono{font-family:"IBM Plex Mono",ui-monospace,monospace}
.note{background:var(--raise);border:1px solid var(--rule);border-left:2px solid var(--stamp);
  border-radius:3px;padding:18px 20px;margin:26px 0 0;font-size:15px;color:var(--ink-2)}
.note b{color:var(--ink)}
.limits{font-size:14.5px;color:var(--ink-2)}
.limits li{margin-bottom:9px}
.cta{margin:40px 0 0;background:var(--raise);border:1px solid var(--rule);border-radius:3px;padding:26px 24px}
.cta h2{border:0;margin:0 0 8px;padding:0;font-size:20px}
.cta p{margin:0 0 14px;color:var(--ink-2);font-size:15px}
.cta a{display:inline-block;font-weight:600;text-decoration:none;padding:10px 20px;border-radius:3px;
  background:var(--stamp);color:var(--paper)}
footer{padding:40px 0 72px;font-size:12.5px;color:var(--ink-3);border-top:1px solid var(--rule-2)}
${CITE_STYLE}
@media (max-width:640px){body{font-size:16px}section{padding:40px 0}.hero-num .n{font-size:29px}}
`;

/** Google Fonts is the one font host the pages may use; always with a real fallback. */
export const FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@400;600&display=swap">';

/**
 * Full date, for a byline. A study is a dated artifact and the reader checking
 * it wants the day, not just the month - "12 de junio de 2026", "12 June 2026".
 * The citation keeps month-and-year, which is the normal citation form.
 */
export function formatDate(iso, lang) {
  const [year, , day] = String(iso).split('-');
  const monthName = formatMonth(iso, lang).replace(new RegExp(`\\s*(de\\s+)?${year}$`), '');
  return lang === 'en'
    ? `${Number(day)} ${monthName} ${year}`
    : `${Number(day)} de ${monthName} de ${year}`;
}
