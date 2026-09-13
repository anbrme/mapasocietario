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
#map g.n[data-flag] circle{stroke:#ef4444;stroke-width:2.5}
#map g.n[data-flag="amber"] circle{stroke:#f59e0b}
#map.focused g.n{opacity:.16}#map.focused g.n.on{opacity:1}
#map.focused .l{opacity:.12}#map.focused .l.on{opacity:1;stroke:var(--accent);stroke-width:2}
.wt-controls{position:absolute;top:10px;right:10px;display:flex;gap:6px}
figcaption{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px;color:var(--muted);font-size:.82rem}
.legend{display:flex;gap:14px;flex-wrap:wrap}
.legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.legend i.co{background:var(--company)}.legend i.of{background:var(--officer)}
.legend i.own{width:18px;height:0;border-top:2px dashed var(--muted);border-radius:0;vertical-align:3px}
.legend i.flag{background:transparent;border:2px solid #ef4444}
#wt-panel{position:sticky;bottom:12px;margin-top:12px;background:var(--card);border:1px solid var(--line);
border-radius:8px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,.08)}
#wt-title{display:block;font-weight:700;margin:2px 0 4px}
#wt-text{margin:0 0 6px;white-space:pre-line}
#wt-note,.chapter .note{margin:8px 0 0;padding:8px 12px;border-left:3px solid var(--f,#94a3b8);background:var(--soft);
border-radius:0 6px 6px 0;font-size:.92rem;white-space:pre-line}
#wt-note[data-flag="red"]{--f:#ef4444}#wt-note[data-flag="amber"]{--f:#f59e0b}
#wt-note[data-flag="blue"]{--f:#3b82f6}#wt-note[data-flag="green"]{--f:#22c55e}
.wt-nav{display:flex;align-items:center;gap:8px;margin-top:10px}
button{font:inherit;font-size:.86rem;padding:5px 12px;border:1px solid var(--line);border-radius:6px;
background:var(--card);color:var(--fg);cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.chapters{counter-reset:ch}
.chapter{display:grid;grid-template-columns:44px 1fr;gap:0 16px;padding:16px 0;border-top:1px solid var(--line);page-break-inside:avoid}
.chapter:last-child{border-bottom:1px solid var(--line)}
.chapter.current{background:var(--accent-soft);margin:0 -12px;padding-left:12px;padding-right:12px;border-radius:6px}
.chapter .num{font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;cursor:pointer}
.chapter .num:hover{text-decoration:underline}
.chapter .head{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.chapter .head .src{display:inline-block;padding:0 6px;border:1px solid var(--line);border-radius:10px;margin-right:6px;letter-spacing:.04em}
.chapter h3{margin:0 0 4px;font-size:1.02rem}
.chapter p{margin:0;white-space:pre-line}
.chapter .ev{color:var(--muted);font-size:.82rem;margin-top:4px}
.chapter .note .who{display:block;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.annex{margin-bottom:28px}
.annex h3{font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:18px 0 8px}
table{border-collapse:collapse;width:100%;font-size:.88rem}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
td.date{font-variant-numeric:tabular-nums;white-space:nowrap}
.scroll{overflow-x:auto}
ul.plain{list-style:none;padding:0;margin:0}ul.plain li{padding:6px 0;border-bottom:1px solid var(--line)}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:.78rem;line-height:1.7}
@page{size:A4;margin:18mm}
@media print{
:root{--bg:#FFFFFF;--fg:#0B1324;--muted:#58677D;--line:#CCD6E3;--card:#FFFFFF;--soft:#F3F6FA;
--accent:#0E8178;--accent-soft:#E5F6F3;--company:#0E8178;--officer:#64748B;--link:#CBD5E1}
#wt-panel,.wt-controls,.hide-print{display:none!important}
body{background:#fff;color:#0B1324;font-size:11pt}
.wrap{max-width:none;padding:0}
#map{height:150mm}
#walkthrough{page-break-before:always}
#annexes{page-break-before:always}
.chapter,tr{page-break-inside:avoid}
a{color:inherit}
}
@media (max-width:600px){.wrap{padding:32px 16px 56px}header.cover h1{font-size:1.5rem}#map{height:360px}.chapter{grid-template-columns:32px 1fr}}
`;
