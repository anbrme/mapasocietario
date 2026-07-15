// Trademarks / Marcas panel — click-to-load expander on /empresa.
// Pull-not-push: SSR emits an empty shell; the inline script fetches on click.
// The endpoint ships behind TRADEMARKS_PANEL_ENABLED; while dark it answers
// {disabled:true} and the script hides the whole section. Renders for every
// company (name always exists), unlike subsidies which gate on NIF.

/**
 * @param {{ company: { name?: string, nif?: string, enriched_nif?: string },
 * t: Record<string,string>, lang: string, apiBase: string,
 * esc: (s: unknown) => string }} args
 * @returns {string}
 */
export function buildTrademarksBlock({ company, t, lang, apiBase, esc }) {
if (!company || !company.name) return '';
const rawNif = company.nif || company.enriched_nif || '';
const marksI18n = {
loading: t.marksLoading,
empty: t.marksEmpty,
error: t.marksError,
retry: t.marksRetry,
thMark: t.marksThMark,
thStatus: t.marksThStatus,
thClasses: t.marksThClasses,
thDate: t.marksThDate,
source: t.marksSource,
searchLink: t.marksSearchLink,
coverage: t.marksCoverage,
partial: t.marksPartial,
badgeEu: t.marksBadgeEu,
badgeEs: t.marksBadgeEs,
};
const marksJson = JSON.stringify(marksI18n)
.replace(/</g, '\\u003c')
.replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

return `<section class="marks" id="marks-section">
<h2>${t.marksTitle}</h2>
<p class="more">${t.marksSub}</p>
<button type="button" id="marks-btn" class="subs-btn">${t.marksBtn}</button>
<div id="marks-body" data-name="${esc(company.name)}" data-nif="${esc(rawNif)}" data-lang="${esc(lang)}" data-api="${apiBase}"></div>
<script type="application/json" id="marks-i18n">${marksJson}</script>
<script>
(function(){
var btn=document.getElementById('marks-btn');
var body=document.getElementById('marks-body');
if(!btn||!body||!window.fetch)return;
var L=JSON.parse(document.getElementById('marks-i18n').textContent);
var lang=body.getAttribute('data-lang')||'es';
function fdate(d){var m=/^(\\d{4})-(\\d{2})-(\\d{2})/.exec(d||'');return m?m[3]+'/'+m[2]+'/'+m[1]:(d||'')}
function note(msg){body.textContent='';var p=document.createElement('p');p.className='more';p.textContent=msg;body.appendChild(p)}
function fail(){btn.disabled=false;btn.textContent=L.retry;note(L.error)}
function badge(src){var s=document.createElement('span');s.className='chip';s.textContent=(src==='OEPM'?L.badgeEs:L.badgeEu);return s}
function render(j){
btn.hidden=true;body.textContent='';
var list=j.marks||[];
if(!list.length){note(L.empty);
var cov0=document.createElement('p');cov0.className='more';cov0.textContent=j.coverageNote||L.coverage;body.appendChild(cov0);
return}
var table=document.createElement('table');table.className='t';
var thead=document.createElement('thead');var trh=document.createElement('tr');
['',L.thMark,L.thStatus,L.thClasses,L.thDate].forEach(function(h){var th=document.createElement('th');th.textContent=h;trh.appendChild(th)});
thead.appendChild(trh);table.appendChild(thead);
var tbody=document.createElement('tbody');
list.forEach(function(m){
var tr=document.createElement('tr');
var tdB=document.createElement('td');tdB.appendChild(badge(m.source));tr.appendChild(tdB);
var tdM=document.createElement('td');
if(m.imageUrl&&/^https:\\/\\//.test(m.imageUrl)){
var img=document.createElement('img');img.src=m.imageUrl;img.alt='';img.className='mark-img';img.loading='lazy';tdM.appendChild(img);tdM.appendChild(document.createTextNode(' '));
}
var label=m.denomination||'';
if(m.officeUrl&&/^https?:\\/\\//.test(m.officeUrl)){
var a=document.createElement('a');a.href=m.officeUrl;a.rel='nofollow noopener';a.target='_blank';a.textContent=label;tdM.appendChild(a);
}else{tdM.appendChild(document.createTextNode(label))}
if(m.holder){var hs=document.createElement('span');hs.className='muted';hs.textContent=' \\u2014 '+m.holder;tdM.appendChild(hs)}
tr.appendChild(tdM);
var tdS=document.createElement('td');tdS.textContent=m.status||'';tr.appendChild(tdS);
var tdC=document.createElement('td');tdC.textContent=(m.niceClasses||[]).join(', ');tr.appendChild(tdC);
var tdD=document.createElement('td');tdD.textContent=fdate(m.date);tr.appendChild(tdD);
tbody.appendChild(tr);
});
table.appendChild(tbody);body.appendChild(table);
if(j.partial){var pp=document.createElement('p');pp.className='more';pp.textContent=L.partial;body.appendChild(pp)}
var cov=document.createElement('p');cov.className='more';cov.textContent=j.coverageNote||L.coverage;body.appendChild(cov);
var src=document.createElement('p');src.className='more';
src.appendChild(document.createTextNode(L.source+' '));
var a1=document.createElement('a');a1.href=(j.source_url&&/^https?:\\/\\//.test(j.source_url))?j.source_url:'https://www.tmdn.org/tmview/';a1.rel='nofollow noopener';a1.target='_blank';a1.textContent=L.searchLink;
src.appendChild(a1);body.appendChild(src);
}
btn.addEventListener('click',function(){
btn.disabled=true;btn.textContent=L.loading;
fetch(body.getAttribute('data-api')+'/bormes/trademarks-by-company?name='+encodeURIComponent(body.getAttribute('data-name'))+'&nif='+encodeURIComponent(body.getAttribute('data-nif'))+'&lang='+encodeURIComponent(lang))
.then(function(r){return r.json()})
.then(function(j){
if(j&&j.disabled){document.getElementById('marks-section').hidden=true;return}
if(!j||!j.success){fail();return}
render(j);
})
.catch(fail);
});
})();
</scr${''}ipt>
<p class="more">${t.marksDisclaimer}</p>
</section>`;
}
