// Public contracts / Contratos públicos panel — /empresa.
//
// Reads GET <api>/bormes/<nif>/company-awards, which answers either
//   {success:true, panel:false}                       -> nothing to say
//   {success:true, panel:true, awards, distinct_buyers, single_bid_share}
//
// Three rules this module exists to hold:
//
// 1. There is NO monetary field in the response and there must never be one
//    rendered here. Framework ceilings reappear on their call-offs, so any
//    euro figure derived from this data overstates by a wide margin.
// 2. panel:false means the backend could not corroborate the awards for this
//    NIF. That is not "this company won nothing", so the section hides
//    rather than showing an empty state — same distinction as the subsidies
//    panel (see _lib.js subsidiesBlock).
// 3. The counts are what was awarded to THIS legal entity. Contracts held by
//    subsidiaries sit under their own NIFs and are not rolled up here.
//
// Unlike the subsidies and trademarks panels this one loads on page load
// rather than on click: the endpoint is our own backend (~150ms) and rule 2
// means the section's very visibility depends on the answer. A click-to-load
// button that makes the whole section vanish when pressed is worse than no
// button. The section therefore ships hidden and reveals itself only once
// the backend corroborates it.

// Below this many awards a single-bid percentage is noise, not a signal:
// one contract won unopposed is 100%, which reads as a finding and is not.
export const MIN_AWARDS_FOR_SINGLE_BID_SHARE = 5;

/**
 * Decide whether the panel has anything to show, from the raw response.
 * Self-contained on purpose — it is serialized into the inline script, so it
 * must not close over anything.
 *
 * @param {any} j parsed response body
 * @returns {{show:false}|{show:true,awards:number,distinctBuyers:number|null,singleBidShare:number|null}}
 */
export function awardsPanelState(j) {
  if (!j || j.disabled || j.success !== true || j.panel !== true) return { show: false };
  if (typeof j.awards !== 'number' || !(j.awards > 0)) return { show: false };
  return {
    show: true,
    awards: j.awards,
    distinctBuyers: typeof j.distinct_buyers === 'number' ? j.distinct_buyers : null,
    singleBidShare: typeof j.single_bid_share === 'number' ? j.single_bid_share : null,
  };
}

/**
 * Render a 0..1 share as a whole percentage, or null when it should not be
 * shown at all. Self-contained on purpose (serialized into the inline script);
 * MIN_AWARDS_FOR_SINGLE_BID_SHARE is emitted alongside it.
 *
 * @param {any} share
 * @param {number} awards
 * @returns {string|null}
 */
export function formatSingleBidShare(share, awards) {
  if (typeof share !== 'number' || !isFinite(share)) return null;
  if (share < 0 || share > 1) return null;
  if (!(awards >= MIN_AWARDS_FOR_SINGLE_BID_SHARE)) return null;
  return Math.round(share * 100) + '%';
}

/**
 * @param {{ company: { nif?: string, enriched_nif?: string },
 * t: Record<string,string>, lang: string, apiBase: string,
 * esc: (s: unknown) => string }} args
 * @returns {string}
 */
export function buildAwardsBlock({ company, t, lang, apiBase, esc }) {
  const rawNif = (company && (company.nif || company.enriched_nif)) || '';
  if (!rawNif) return '';

  const i18n = {
    statAwards: t.awardsStatAwards,
    statBuyers: t.awardsStatBuyers,
    statSingleBid: t.awardsStatSingleBid,
    singleBidNote: t.awardsSingleBidNote,
  };
  const json = JSON.stringify(i18n)
    .replace(/</g, '\\u003c')
    .replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

  return `<section class="awards" id="awards-section" hidden>
<h2>${t.awardsTitle}</h2>
<p class="more">${t.awardsSub}</p>
<div id="awards-body" data-nif="${esc(rawNif)}" data-lang="${esc(lang)}" data-api="${apiBase}"></div>
<p class="more">${t.awardsScope}</p>
<p class="more">${t.awardsSource}</p>
<script type="application/json" id="awards-i18n">${json}</script>
<script>
var MIN_AWARDS_FOR_SINGLE_BID_SHARE=${MIN_AWARDS_FOR_SINGLE_BID_SHARE};
var awardsPanelState=${awardsPanelState.toString()};
var formatSingleBidShare=${formatSingleBidShare.toString()};
(function(){
var sec=document.getElementById('awards-section');
var body=document.getElementById('awards-body');
if(!sec||!body||!window.fetch)return;
var L=JSON.parse(document.getElementById('awards-i18n').textContent);
function stat(value,label){
var d=document.createElement('div');d.className='overview-stat';
var v=document.createElement('span');v.className='overview-value';v.textContent=value;d.appendChild(v);
var l=document.createElement('span');l.className='overview-label';l.textContent=label;d.appendChild(l);
return d;
}
function render(s){
var grid=document.createElement('div');grid.className='awards-grid';
grid.appendChild(stat(String(s.awards),L.statAwards));
if(typeof s.distinctBuyers==='number')grid.appendChild(stat(String(s.distinctBuyers),L.statBuyers));
var pct=formatSingleBidShare(s.singleBidShare,s.awards);
if(pct)grid.appendChild(stat(pct,L.statSingleBid));
body.textContent='';body.appendChild(grid);
if(pct){var n=document.createElement('p');n.className='more';n.textContent=L.singleBidNote;body.appendChild(n)}
sec.hidden=false;
}
fetch(body.getAttribute('data-api')+'/bormes/'+encodeURIComponent(body.getAttribute('data-nif'))+'/company-awards')
.then(function(r){return r.json()})
.then(function(j){var s=awardsPanelState(j);if(s.show)render(s)})
.catch(function(){/* the section is hidden already; a failed optional panel stays invisible rather than showing an error for something the reader never asked for */});
})();
</scr${''}ipt>
</section>`;
}
