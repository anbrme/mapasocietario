// The situation report's stylesheet: screen (light + dark) and print. One
// accent (the user guide's teal), IBM Plex Sans embedded so the file looks the
// same offline and forwarded. No external URL of any kind.
import { PLEX_SANS_REGULAR_WOFF2_B64, PLEX_SANS_BOLD_WOFF2_B64 } from '../../assets/fonts/plexFonts';

export const FLAG_COLORS = Object.freeze({
  red: '#ef4444', amber: '#f59e0b', blue: '#3b82f6', green: '#22c55e', none: '#94a3b8',
});

export const flagVar = flag => `--f:${
  Object.prototype.hasOwnProperty.call(FLAG_COLORS, flag) ? FLAG_COLORS[flag] : FLAG_COLORS.none
}`;

const face = (weight, b64) => `@font-face{font-family:"IBM Plex Sans";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;

export const DOCUMENT_STYLE = `
${face(400, PLEX_SANS_REGULAR_WOFF2_B64)}
${face(700, PLEX_SANS_BOLD_WOFF2_B64)}
:root{color-scheme:light dark;
--bg:#FBFBFA;--fg:#0B1324;--muted:#58677D;--line:#CCD6E3;--card:#FFFFFF;--soft:#F3F6FA;
--accent:#0E8178;--accent-soft:#E5F6F3;--company:#0E8178;--officer:#64748B;--link:#CBD5E1}
@media (prefers-color-scheme: dark){:root{
--bg:#14161A;--fg:#E8E8E4;--muted:#9A9A94;--line:#2A2D33;--card:#1C1F24;--soft:#181B20;
--accent:#2DD4BF;--accent-soft:#12302C;--company:#2DD4BF;--officer:#94A3B8;--link:#3A3F47}}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);
font:15px/1.6 "IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:64px 24px 80px}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.eyebrow{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700}
header.cover{padding-bottom:28px;border-bottom:1px solid var(--line);margin-bottom:32px}
header.cover h1{font-size:2rem;line-height:1.15;margin:8px 0 10px;font-weight:700;letter-spacing:-.01em}
.meta{color:var(--muted);font-size:.88rem}
.status{margin-top:18px;padding:10px 14px;border-left:2px solid var(--line);color:var(--muted);font-size:.86rem}
.facts{list-style:none;display:flex;flex-wrap:wrap;gap:8px 28px;margin:18px 0 0;padding:0}
.facts li{display:flex;flex-direction:column;line-height:1.25}
.facts b{font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.facts span{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.chrono{list-style:none;margin:0;padding:0 0 0 14px;border-left:2px solid var(--line)}
.chrono li{position:relative;display:grid;grid-template-columns:200px 1fr auto;gap:0 14px;align-items:baseline;padding:6px 0}
.chrono li::before{content:"";position:absolute;left:-19px;top:14px;width:8px;height:8px;border-radius:50%;background:var(--accent)}
.chrono time{color:var(--muted);font-size:.86rem;font-variant-numeric:tabular-nums}
.chrono a{color:var(--fg);font-weight:600}
.chrono .kind{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
@media (max-width:600px){.chrono li{grid-template-columns:1fr;gap:0}.chrono .kind{display:none}}
nav.contents{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 36px;font-size:.86rem}
nav.contents a{color:var(--muted)}nav.contents a b{color:var(--fg);font-weight:600;margin-right:6px}
section{margin:0 0 40px}
h2{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 14px;font-weight:700}
h2 span.num{color:var(--accent);margin-right:8px}
.lead{font-size:1.12rem;line-height:1.55;margin:0}
figure{margin:0}
figure .frame{position:relative;background:var(--card);border:1px solid var(--line);border-radius:8px}
#map{display:block;width:100%;height:520px;cursor:grab;touch-action:pan-y pinch-zoom;border-radius:8px}
#map .l{stroke:var(--link);stroke-width:1;transition:opacity .2s}
#map .l[data-kind="ownership"]{stroke-dasharray:4 3;stroke:var(--muted)}
#map g.n circle{fill:var(--officer)}
#map g.n[data-kind="company"] circle{fill:var(--company)}
#map g.n text{fill:var(--fg);font-size:9px;text-anchor:middle;pointer-events:none}
#map g.n[data-kind="officer"] text{font-size:7.5px;fill:var(--muted)}
#map g.n[data-step] text{font-weight:700;fill:var(--fg)}
#map g.n[data-flag] circle{stroke:#ef4444;stroke-width:2.5}
#map g.n[data-flag="amber"] circle{stroke:#f59e0b}
#map.focused g.n{opacity:.16}#map.focused g.n.on{opacity:1}
#map.focused g.n:not(.on) text{opacity:0}
#map.focused .l{opacity:.12}#map.focused .l.on{opacity:1;stroke:var(--accent);stroke-width:2}
figcaption{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px;color:var(--muted);font-size:.82rem}
.legend{display:flex;gap:14px;flex-wrap:wrap}
.legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.legend i.co{background:var(--company)}.legend i.of{background:var(--officer)}
.legend i.own{width:18px;height:0;border-top:2px dashed var(--muted);border-radius:0;vertical-align:3px}
.legend i.flag{background:transparent;border:2px solid #ef4444}
#wt-panel{margin-top:12px;background:var(--card);border:1px solid var(--line);
border-radius:8px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.08);flex:1 1 auto;min-height:0;overflow:auto}
#wt-opening{border-bottom:1px solid var(--line);margin-bottom:8px;padding-bottom:8px}
#wt-title{display:block;font-weight:700;margin:2px 0 4px}
#wt-text{margin:0 0 6px;white-space:pre-line}
#wt-ev{color:var(--muted);font-size:.86rem;margin:0 0 6px}
#wt-note,.chapter .note{margin:8px 0 0;padding:8px 12px;border-left:3px solid var(--f,#94a3b8);background:var(--soft);
border-radius:0 6px 6px 0;font-size:.92rem;white-space:pre-line}
#wt-note[data-flag="red"]{--f:#ef4444}#wt-note[data-flag="amber"]{--f:#f59e0b}
#wt-note[data-flag="blue"]{--f:#3b82f6}#wt-note[data-flag="green"]{--f:#22c55e}
.wt-nav{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
#wt-counter,#wt-exit{white-space:nowrap}
.wt-tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.wt-tools button{font-size:.78rem;padding:3px 10px;color:var(--muted);border-color:transparent;background:var(--soft)}
.wt-tools button:hover{color:var(--fg);border-color:var(--line)}
button{font:inherit;font-size:.86rem;padding:5px 12px;border:1px solid var(--line);border-radius:6px;
background:var(--card);color:var(--fg);cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.chapters{counter-reset:ch}
.chapter{display:grid;grid-template-columns:44px 1fr;gap:0 16px;padding:16px 0;border-top:1px solid var(--line);page-break-inside:avoid}
.chapter:last-child{border-bottom:1px solid var(--line)}
.chapter.current{background:var(--accent-soft);margin:0 -12px;padding-left:12px;padding-right:12px;border-radius:6px}
.chapter .num{background:none;border:0;padding:0;font:inherit;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;cursor:pointer;text-align:left}
.chapter .num:hover{text-decoration:underline}
.chapter .head{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.chapter .head .src{display:inline-block;padding:0 6px;border:1px solid var(--line);border-radius:10px;margin-right:6px;letter-spacing:.04em}
.chapter h3{margin:0 0 4px;font-size:1.02rem}
.chapter p{margin:0;white-space:pre-line}
.chapter h4{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px}
.chapter table{font-size:.82rem}
.chapter ul{margin:0;padding-left:18px}
.kv{color:var(--muted);font-size:.9rem;margin:2px 0}
.chapter .ev{color:var(--muted);font-size:.82rem;margin-top:4px}
#wt-note .who,.chapter .note .who{display:block;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.annex{margin-bottom:28px}
.annex h3{font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:18px 0 8px}
table{border-collapse:collapse;width:100%;font-size:.88rem}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
td.date{font-variant-numeric:tabular-nums;white-space:nowrap}
.scroll{overflow-x:auto}
ul.plain{list-style:none;padding:0;margin:0}ul.plain li{padding:6px 0;border-bottom:1px solid var(--line)}
ul.plain li .kv{display:block}
nav.contents .subs{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:4px 18px;padding-left:14px}
nav.contents a.sub{font-size:.8rem}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:.78rem;line-height:1.7}
.story{display:grid;grid-template-columns:minmax(0,1fr);gap:0 32px;align-items:start}
.story #graph{position:sticky;top:0;z-index:2;background:var(--bg);padding-top:8px;margin:0;display:flex;flex-direction:column}
.story #graph figure,.story #graph #wt-time{flex:0 0 auto}
.story #graph #map{height:38vh}
#viewport{transition:transform .6s cubic-bezier(.22,.61,.36,1);transform-origin:0 0;transform-box:view-box}
#map.dragging #viewport{transition:none}
#map g.n,#map .l{transition:opacity .45s ease}
#map .l[data-state="hidden"]{opacity:0!important;pointer-events:none}
#map g.n[data-state="hidden"]{pointer-events:none}
#map g.n[data-state="hidden"] circle{fill:var(--bg);stroke:var(--line);stroke-width:1.2}
#map g.n[data-state="hidden"] text{opacity:.3}
#map .l[data-state="ceased"]{stroke-dasharray:3 3;opacity:.45}
#map g.n[data-state="ghost"] circle{opacity:.35}
#map g.n[data-state="ghost"] text{opacity:.5}
#wt-time{margin-top:8px}
/* A viewer that runs no script (an in-app document preview, Quick Look) gets
   the document, not dead controls. */
html.nojs #wt-panel,html.nojs #wt-time{display:none}
.nojs-note{margin:0 0 12px;padding:10px 14px;border-left:3px solid var(--accent);background:var(--accent-soft);font-size:.9rem}
@media print{.nojs-note{display:none}}
#wt-time input[type=range]{width:100%;accent-color:var(--accent)}
#wt-time .meta{display:flex;gap:6px;flex-wrap:wrap;font-variant-numeric:tabular-nums}
.chapter{scroll-margin-top:45vh}
.annex-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.annex-tabs [role=tab]{border-radius:999px}
.annex-tabs [role=tab][aria-selected=true]{background:var(--accent);border-color:var(--accent);color:#fff}
h3.explorer{font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
@media (max-width:959px){.story{display:block}}
@media (max-width:959px){
.story #graph{max-height:62vh}
.story #graph #map{height:30vh}
.story #graph .legend{display:none}
.story #graph figcaption{display:none}
}
@media (min-width:960px){
.wrap{max-width:1180px}
.wrap>header,.wrap>nav,.wrap>#summary,.wrap>#chronology,.wrap>#annexes,.wrap>footer{max-width:820px;margin-left:auto;margin-right:auto}
.story{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.story.solo{grid-template-columns:minmax(0,820px);justify-content:center}
.story{min-height:calc(100vh - 32px);margin-bottom:24px}
.story #graph{top:16px;max-height:calc(100vh - 32px);overflow:hidden;padding-top:0}
/* The pane must never scroll on its own (a wheel over the map would scroll it
   instead of the page), so the map takes what the viewport leaves after the
   heading, caption, slider and the opening card at its tallest (~392px). */
.story #graph #map{height:clamp(220px,calc(100vh - 430px),520px)}
#wt-text,#wt-ev,#wt-note{display:none}
.chapter{scroll-margin-top:50vh}
}
@media (prefers-reduced-motion:reduce){#viewport,#map g.n,#map .l{transition:none}}
/* Presenter mode: the map on the left, one chapter at a time on the right,
   nothing else on screen. Slide zero is the opening; the card under the map
   is the controller. */
.slide0{display:none}
body.presenting{overflow:hidden}
body.presenting .wrap{max-width:none;padding:0;height:100vh}
body.presenting .wrap>header,body.presenting .wrap>nav,body.presenting #summary,body.presenting #chronology,body.presenting #annexes,body.presenting footer{display:none}
body.presenting .story{display:grid;grid-template-columns:3fr 2fr;gap:0;height:100vh;min-height:0;margin:0}
body.presenting .story #graph{position:static;top:auto;max-height:none;height:100vh;overflow:hidden;padding:16px 20px;display:flex;flex-direction:column}
body.presenting .story #graph h2{display:none}
body.presenting .story #graph #map{height:calc(100vh - 320px)}
body.presenting #walkthrough{height:100vh;overflow:auto;margin:0;padding:40px 44px;border-left:1px solid var(--line)}
body.presenting #walkthrough h2{display:none}
body.presenting .chapter{display:none}
body.presenting .chapter.current{display:grid;background:none;margin:0;padding:0;border:0}
body.presenting .chapter h3{font-size:1.7rem;line-height:1.2;margin-bottom:10px}
body.presenting .chapter p,body.presenting .chapter .note,body.presenting .chapter li{font-size:1.08rem}
body.presenting .chapter table{font-size:.98rem}
body.presenting .chapter .head{font-size:.8rem}
body.presenting .chapter .num{font-size:1.4rem}
body.presenting.at-opening .slide0{display:block;padding-top:8vh}
body.presenting.at-opening .slide0 strong{display:block;font-size:2rem;line-height:1.15;margin-bottom:12px}
body.presenting.at-opening .slide0 p{font-size:1.2rem;color:var(--muted);margin:0}
body.presenting .wt-tools,body.presenting #wt-text,body.presenting #wt-ev,body.presenting #wt-note{display:none}
body.presenting #wt-panel{box-shadow:none}
@media (max-width:959px){
body.presenting .story{display:grid;grid-template-columns:1fr;grid-template-rows:auto 1fr}
body.presenting .story #graph{height:auto;max-height:none;padding:8px 12px}
body.presenting .story #graph #map{height:34vh}
body.presenting #walkthrough{height:auto;min-height:0;padding:16px;border-left:0;border-top:1px solid var(--line)}
}
@page{size:A4;margin:18mm}
@media print{
:root{--bg:#FFFFFF;--fg:#0B1324;--muted:#58677D;--line:#CCD6E3;--card:#FFFFFF;--soft:#F3F6FA;
--accent:#0E8178;--accent-soft:#E5F6F3;--company:#0E8178;--officer:#64748B;--link:#CBD5E1}
#wt-panel,.hide-print{display:none!important}
body{background:#fff;color:#0B1324;font-size:11pt}
/* Margins live on the wrapper too: a "Margins: none" print setting must not
   push the chapter numbers off the sheet. */
.wrap{max-width:none;padding:6mm 10mm}
#map,.story #graph #map{height:150mm}
.story{display:block}
.story #graph{position:static;max-height:none;overflow:visible;display:block}
/* A4 at 18mm margins is ~657 CSS px wide, so the max-width:959px block above
   applies to print too and would swallow the caption. Paper has the room: give
   it back. Source order wins, no !important needed. */
.story #graph figcaption{display:flex}
#wt-time{display:none!important}
.annex-tabs{display:none!important}
.annex-panel[hidden]{display:block!important}
#map [data-state]{opacity:1!important;stroke-dasharray:none}
#map g.n[data-state="ghost"] circle,#map g.n[data-state="ghost"] text{opacity:1!important}
#map g.n[data-state="hidden"] circle{fill:var(--officer);stroke:none}#map g.n[data-state="hidden"][data-kind="company"] circle{fill:var(--company)}#map g.n[data-state="hidden"] text{opacity:1!important}
#map .l[data-state="ceased"]{stroke-dasharray:none!important;opacity:1!important}
#viewport{transform:none!important;transition:none}
#walkthrough{page-break-before:always}
#annexes{page-break-before:always}
/* The map is a figure on its own page; the rest flows. */
#graph{page-break-before:always}
/* A long chapter may break across pages; what must not happen is a heading
   left alone at the foot of one, or a row or note split in two. */
.chapter{page-break-inside:auto}
/* Grids fragment badly across pages (Chrome leaves half a page blank); in
   print a chapter is a block with its number floated beside the content. */
.chapter{display:block}
.chapter .num{float:left;width:44px}
.chapter>div{margin-left:60px}
.chapter h3,.chapter .head,.chapter h4,h2{page-break-after:avoid}
tr,.facts,.chrono li,#chronology,.note,.chapter ul{page-break-inside:avoid}
thead{display:table-header-group}
.story #graph .legend{display:flex}
h3.explorer{display:none!important}
.chapter.current{background:none!important;margin:0;padding-left:0;padding-right:0}
.wt-nav,.wt-tools,.slide0{display:none!important}
footer a[href^="http"]::after{content:" (" attr(href) ")";font-size:.9em;word-break:break-all}
a{color:inherit}
}
@media (max-width:600px){.wrap{padding:32px 16px 56px}header.cover h1{font-size:1.5rem}#map{height:360px}.chapter{grid-template-columns:32px 1fr}}
`;
