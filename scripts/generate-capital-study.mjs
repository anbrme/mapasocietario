/**
 * Build-time generator for the "capital and governance arrive in the same
 * filing" study:
 *   ES → dist/estudios/mismo-asiento-registral/index.html
 *   EN → dist/en/studies/same-filing/index.html
 *
 * Ported 2026-08-30 from nurnbergconsulting.com, where it was published on
 * 2026-06-12 as a GSAP scrolly plus a long-form report. It lives here now
 * because a study's links should build the domain that needs the authority, and
 * the four old URLs 301 to these two.
 *
 * Every figure comes from src/data/capital-filings.json, transcribed
 * programmatically from the original rather than retyped. The analysis itself
 * was run offline against the BORME corpus, so — unlike the interlock study —
 * this snapshot has no regenerating script; treat the JSON as the source.
 *
 * Standalone documents, like the other study pages, so Cloudflare Pages serves
 * them directly. Runs in POSTBUILD, after `vite build` empties dist/.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIES, hubPath, studyPath } from '../src/copy/studies.js';
import { esc, gaSnippet, citationBlock, toCsv, formatMonth, formatDate, PAGE_STYLE, FONT_LINK } from './_study_chrome.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SITE = 'https://mapasocietario.es';

const STUDY = STUDIES.find((s) => s.id === 'capital-governance-same-filing');
const D = JSON.parse(readFileSync(path.join(root, 'src/data', STUDY.dataFile), 'utf8'));
const CSV_NAME = { es: 'mismo-asiento-registral.csv', en: 'same-filing.csv' };
const csvHref = (lang) => `${STUDY.paths[lang]}/${CSV_NAME[lang]}`;

// Spanish writes 13,4 and 205.077; English writes 13.4 and 205,077.
const num = (v, lang, dp = 1) => {
  const s = Number(v).toFixed(dp);
  return lang === 'es' ? s.replace('.', ',') : s;
};
const int = (v, lang) => {
  const s = String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '#');
  return s.replace(/#/g, lang === 'es' ? '.' : ',');
};

const win = (id) => D.windows.find((w) => w.id === id);
const form = (id) => D.forms.find((f) => f.id === id);
const amt = (id) => D.amounts.find((a) => a.id === id);

const T = {
  es: {
    htmlLang: 'es', ogLocale: 'es_ES',
    title: `${STUDY.es.title} | Mapa Societario`,
    desc: `${int(D.n_operations, 'es')} operaciones de capital registradas en España (${D.period}): el cambio de administradores se inscribe en el mismo asiento que la operación de capital, a unas ${D.same_day_multiple} veces la línea base.`,
    crumbHome: 'Mapa Societario', crumbHub: 'Estudios',
    kicker: 'Investigación original · BORME',
    dek: `${int(D.n_operations, 'es')} operaciones de capital registradas en España entre 2021 y 2025 muestran que el cambio de administradores se inscribe en el mismo asiento que la operación de capital —a unas ${D.same_day_multiple} veces el ritmo registral propio de cada empresa— y casi en ningún otro sitio.`,
    published: `Publicado el ${formatMonth(D.published, 'es').replace(/^(\w)/, (m) => m)} `,
    publishedLabel: 'Publicado el', dataLabel: 'Datos a',
    heroes: [
      { n: `${num(win('same_day').inc[0], 'es')} %`, t: 'de las ampliaciones de capital registran un cambio de administradores <strong>el mismo día</strong>', hi: true },
      { n: `${num(win('same_day').base[0], 'es')} %`, t: 'es la línea base en fechas neutras de las mismas empresas', hi: false },
      { n: `~${D.same_day_multiple}×`, t: 'la coincidencia del mismo día frente a esa línea base', hi: true },
    ],
    s1eye: '01 · El rastro que no está', s1h: 'Dónde se esperaría el rastro',
    s1: [
      '<p class="lede">La intuición dice que una ampliación de capital deja un rastro: movimientos en el consejo en los meses anteriores o posteriores. Los datos dicen lo contrario.</p>',
      `<p>Para cada operación de capital medimos si la misma empresa registró algún cambio de administradores dentro de una ventana —el mismo día, ±30, ±90 y ±180 días— y lo comparamos con una <strong>línea base</strong>: fechas neutras de esas mismas empresas, que capturan su ritmo registral propio.</p>`,
    ],
    tabInc: 'Ampliaciones', tabRed: 'Reducciones', tblShow: 'Ver tabla', tblHide: 'Ocultar tabla',
    keyBase: 'Línea base (fechas neutras)',
    cap1: `Porcentaje de operaciones con al menos un cambio de administradores en cada ventana, ${D.period}. Ampliaciones n=${int(D.n_increases, 'es')} · reducciones n=${int(D.n_reductions, 'es')} · línea base n=${int(D.n_baseline, 'es')}. Todas las ventanas salvo «mismo día» siguen de cerca a la línea base: el aparente rastro es sólo el ritmo registral de cada empresa.`,
    note1: `<b>Una barra se niega a sentarse.</b> A 90 días antes, las ampliaciones marcan ${num(win('d90').inc[0], 'es')} % frente a una línea base de ${num(win('d90').base[0], 'es')} %: prácticamente nada. El mismo día marca ${num(win('same_day').inc[0], 'es')} % frente a ${num(win('same_day').base[0], 'es')} %. El efecto no está repartido en los meses: está concentrado en un único asiento.`,
    tblCap: `Porcentaje de operaciones de capital con ≥1 cambio de administradores en cada ventana, ${D.period}`,
    thWin: 'Ventana', thInc: `Ampliaciones (n=${int(D.n_increases, 'es')})`, thRed: `Reducciones (n=${int(D.n_reductions, 'es')})`, thBase: `Línea base (n=${int(D.n_baseline, 'es')})`,
    winLabels: { same_day: 'Mismo día', d30: '30 d antes / después', d90: '90 d antes / después', d180: '180 d antes / después' },
    chartLabels: ['Mismo día', '90 d antes', '90 d después', '180 d antes', '180 d después'],
    baseWord: 'base', multTag: `~${D.same_day_multiple}× la línea base`,
    s2eye: '02 · Estabilidad', s2h: 'Diecisiete años, un solo número',
    s2: [`<p>Si esto fuera un artefacto de un año concreto, de una reforma legal o de un cambio en el procesamiento, se vería en la serie. No se ve. La tasa del mismo día se mantiene entre el <strong>${num(Math.min(...D.years.rates), 'es')} % y el ${num(Math.max(...D.years.rates), 'es')} %</strong> todos los años desde ${D.years.from} hasta ${D.years.from + D.years.rates.length - 1}.</p>`],
    cap2: `Tasa del mismo día para las ampliaciones de capital, ${D.series_period}. La banda sombreada marca el rango observado, ${num(Math.min(...D.years.rates), 'es')} %–${num(Math.max(...D.years.rates), 'es')} %. Diecisiete años sin tendencia.`,
    bandLabel: `rango observado ${num(Math.min(...D.years.rates), 'es')} %–${num(Math.max(...D.years.rates), 'es')} %`,
    s3eye: '03 · Forma societaria', s3h: 'Las SL lo inscriben junto; las SA lo preparan antes',
    s3: [`<p>Separadas por forma societaria, las dos curvas cuentan historias distintas. En las <strong>SL</strong> el efecto es el asiento compartido y nada más: a 90 días marcan ${num(form('SL').d90_before, 'es')} % frente a una línea base de ${num(form('SL').base, 'es')} %. En las <strong>SA</strong> aparece lo que en el conjunto no existía: <strong>${num(form('SA').d90_before, 'es')} %</strong> registra un cambio de administradores en los 90 días previos, casi el doble de su línea base.</p>`],
    cap3: `Ampliaciones de capital por forma societaria, ${D.period}. SL n=${int(form('SL').n, 'es')} · SA n=${int(form('SA').n, 'es')}. La línea base ajustada por forma es ${num(form('SL').base, 'es')} % en ambos casos. Una SA prepara el consejo antes de ampliar; una SL lo cambia en el mismo acto.`,
    formCols: ['Mismo día', '90 d antes'],
    s4eye: '04 · Importes', s4h: 'Las ampliaciones que comparten asiento son más pequeñas',
    s4: [`<p>La operación que viaja con un cambio de administradores tiene un importe mediano de <strong>${int(amt('with').median, 'es')} €</strong>; la que viaja sola, <strong>${int(amt('without').median, 'es')} €</strong>. El asiento compartido es la firma de la operación pequeña y estructural —reordenar quién manda y cuánto se pone, en un mismo trámite— más que la de la gran ronda.</p>`,
      `<p>El BORME no publica activos, empleados ni antigüedad, así que esto es una asociación, no un resultado controlado por tamaño.</p>`],
    amtLabels: { with: 'Con cambio de administradores adyacente', without: 'Sin cambio de administradores' },
    cap4: `Importe mediano de las ampliaciones de capital, ${D.period}. Con cambio adyacente n=${int(amt('with').n, 'es')} · sin cambio n=${int(amt('without').n, 'es')}.`,
    s5eye: '05 · La vista inversa', s5h: 'Los cambios de administradores viajan solos',
    s5: [`<p>Dado la vuelta, el hallazgo se acota solo. De <strong>${int(D.reverse.change_days, 'es')}</strong> días distintos con cambios de administradores entre 2021 y 2025, sólo <strong>${int(D.reverse.same_day, 'es')}</strong> —el ${num(D.reverse.pct, 'es', 2)} %— caen el mismo día que una operación de capital de la misma empresa.</p>`,
      `<p>Compartir asiento es una propiedad de <em>las operaciones de capital</em>, no del cambio de gestores en general. Los cambios de administradores son unas seis veces más frecuentes como eventos, y la inmensa mayoría se registra sin ningún contexto de capital.</p>`],
    revIn: `${int(D.reverse.same_day, 'es')} días (${num(D.reverse.pct, 'es', 2)} %) coinciden con una operación de capital`,
    revAll: `${int(D.reverse.change_days, 'es')} días distintos con cambios de administradores, ${D.period}`,
    cap5: `Días distintos con cambios de administradores, ${D.period}. La franja marcada es el ${num(D.reverse.pct, 'es', 2)} % que coincide con una operación de capital de la misma empresa.`,
    s6eye: '06 · Lectura', s6h: 'Qué significa en la práctica',
    s6: [`<p>Si sigue una empresa española, el asiento de capital es el momento en que mirar el consejo —no el trimestre anterior. Y si ve un cambio de administradores suelto, lo más probable, con diferencia, es que no haya ninguna operación de capital detrás.</p>`,
      `<p>El desfase entre inscripción y publicación es corto y estable: sobre n=${int(D.lag.n, 'es')} actos de capital, la mediana es de <strong>${D.lag.median} días</strong>, el percentil 90 de ${D.lag.p90} y el 99 de ${D.lag.p99}. Las ventanas construidas sobre fechas de publicación son, por tanto, una aproximación muy ajustada al momento de la inscripción.</p>`],
    limH: 'Datos y limitaciones',
    lims: [
      'El BORME recoge <strong>actos jurídicos inscritos</strong>, no la situación económica de una empresa ni la motivación de un acto. Todo lo anterior es descriptivo: <strong>no se hace ninguna afirmación causal</strong>.',
      'Las fechas son fechas de publicación. El intervalo entre la escritura notarial y la inscripción es inobservable.',
      'Los recuentos son a nivel de cargo, y la fuente no incluye los nombres de las personas: un asiento que nombra a tres consejeros con el mismo título produce un único registro tras deduplicar. Las tasas por ventana son binarias y no se ven afectadas.',
      'La asimetría antes/después de la línea base es censura, reproducida de forma idéntica en la serie de tratamiento y en la de línea base.',
    ],
    ctaH: 'Explora cualquier empresa española',
    ctaP: 'El estudio mira el conjunto. La herramienta hace lo mismo con una sola empresa: busca una sociedad o un administrador y explora sus vínculos en un grafo interactivo.',
    ctaB: 'Abrir el buscador →',
    foot: 'Datos: Boletín Oficial del Registro Mercantil (BORME), 2009–2025. Análisis independiente elaborado mediante procesos automatizados; puede contener errores u omisiones. No es el Registro Mercantil y no emite certificaciones.',
    csvHead: ['Ventana', 'Ampliaciones %', 'Reducciones %', 'Línea base %'],
  },
  en: {
    htmlLang: 'en', ogLocale: 'en_GB',
    title: `${STUDY.en.title} | Mapa Societario`,
    desc: `${int(D.n_operations, 'en')} capital operations registered in Spain (${D.period}): governance change is filed in the same entry as the capital operation, at roughly ${D.same_day_multiple} times the baseline.`,
    crumbHome: 'Mapa Societario', crumbHub: 'Studies',
    kicker: 'Original research · BORME',
    dek: `${int(D.n_operations, 'en')} capital operations registered in Spain between 2021 and 2025 show that governance change is filed in the same registry entry as the capital operation — at roughly ${D.same_day_multiple} times each company's own filing rhythm — and almost nowhere else.`,
    publishedLabel: 'Published', dataLabel: 'Data as of',
    heroes: [
      { n: `${num(win('same_day').inc[0], 'en')}%`, t: 'of capital increases record a governance change <strong>on the same day</strong>', hi: true },
      { n: `${num(win('same_day').base[0], 'en')}%`, t: 'is the baseline on neutral dates for the same companies', hi: false },
      { n: `~${D.same_day_multiple}×`, t: 'the same-day coincidence against that baseline', hi: true },
    ],
    s1eye: '01 · The trail that is not there', s1h: 'Where you would expect the trail',
    s1: [
      '<p class="lede">Intuition says a capital increase leaves a trail: board movement in the months before or after. The data says otherwise.</p>',
      '<p>For every capital operation we measured whether the same company recorded any governance change inside a window — the same day, ±30, ±90 and ±180 days — and compared it with a <strong>baseline</strong>: neutral dates for those same companies, which capture their own filing rhythm.</p>',
    ],
    tabInc: 'Increases', tabRed: 'Reductions', tblShow: 'Show table', tblHide: 'Hide table',
    keyBase: 'Baseline (neutral dates)',
    cap1: `Share of operations with at least one governance change in each window, ${D.period}. Increases n=${int(D.n_increases, 'en')} · reductions n=${int(D.n_reductions, 'en')} · baseline n=${int(D.n_baseline, 'en')}. Every window except "same day" tracks the baseline closely: the apparent trail is only each company's own filing rhythm.`,
    note1: `<b>One bar refuses to sit down.</b> At 90 days before, increases show ${num(win('d90').inc[0], 'en')}% against a baseline of ${num(win('d90').base[0], 'en')}% — essentially nothing. The same day shows ${num(win('same_day').inc[0], 'en')}% against ${num(win('same_day').base[0], 'en')}%. The effect is not spread across the months: it is concentrated in a single filing.`,
    tblCap: `Share of capital operations with ≥1 governance change in each window, ${D.period}`,
    thWin: 'Window', thInc: `Increases (n=${int(D.n_increases, 'en')})`, thRed: `Reductions (n=${int(D.n_reductions, 'en')})`, thBase: `Baseline (n=${int(D.n_baseline, 'en')})`,
    winLabels: { same_day: 'Same day', d30: '30d before / after', d90: '90d before / after', d180: '180d before / after' },
    chartLabels: ['Same day', '90d before', '90d after', '180d before', '180d after'],
    baseWord: 'base', multTag: `~${D.same_day_multiple}× the baseline`,
    s2eye: '02 · Stability', s2h: 'Seventeen years, one number',
    s2: [`<p>If this were an artefact of one year, of a legal reform, or of a processing change, the series would show it. It does not. The same-day rate stays between <strong>${num(Math.min(...D.years.rates), 'en')}% and ${num(Math.max(...D.years.rates), 'en')}%</strong> every year from ${D.years.from} to ${D.years.from + D.years.rates.length - 1}.</p>`],
    cap2: `Same-day rate for capital increases, ${D.series_period}. The shaded band marks the observed range, ${num(Math.min(...D.years.rates), 'en')}%–${num(Math.max(...D.years.rates), 'en')}%. Seventeen years without a trend.`,
    bandLabel: `observed range ${num(Math.min(...D.years.rates), 'en')}%–${num(Math.max(...D.years.rates), 'en')}%`,
    s3eye: '03 · Legal form', s3h: 'SLs file it together; SAs prepare it first',
    s3: [`<p>Split by legal form, the two tell different stories. In <strong>SLs</strong> the effect is the shared filing and nothing else: at 90 days they show ${num(form('SL').d90_before, 'en')}% against a baseline of ${num(form('SL').base, 'en')}%. In <strong>SAs</strong> what the pooled data hid appears: <strong>${num(form('SA').d90_before, 'en')}%</strong> record a governance change in the 90 days before, nearly double their own baseline.</p>`],
    cap3: `Capital increases by legal form, ${D.period}. SL n=${int(form('SL').n, 'en')} · SA n=${int(form('SA').n, 'en')}. The form-matched baseline is ${num(form('SL').base, 'en')}% in both cases. A larger-form company prepares the board before raising; in the SL economy, change arrives in the filing or not at all.`,
    formCols: ['Same day', '90d before'],
    s4eye: '04 · Amounts', s4h: 'Increases that share a filing are smaller',
    s4: [`<p>An operation travelling with a governance change has a median amount of <strong>€${int(amt('with').median, 'en')}</strong>; one travelling alone, <strong>€${int(amt('without').median, 'en')}</strong>. The shared filing is the signature of the small, structural operation — reordering who runs the company and who puts money in, in one act — rather than of the large round.</p>`,
      '<p>BORME publishes no assets, employees or company age, so this is an association, not a size-controlled result.</p>'],
    amtLabels: { with: 'With adjacent governance change', without: 'Without governance change' },
    cap4: `Median capital-increase amount, ${D.period}. With adjacent change n=${int(amt('with').n, 'en')} · without n=${int(amt('without').n, 'en')}.`,
    s5eye: '05 · The reverse view', s5h: 'Governance changes travel alone',
    s5: [`<p>Turned around, the finding bounds itself. Of <strong>${int(D.reverse.change_days, 'en')}</strong> distinct governance-change filing days between 2021 and 2025, only <strong>${int(D.reverse.same_day, 'en')}</strong> — ${num(D.reverse.pct, 'en', 2)}% — fall on the same day as a capital operation of the same company.</p>`,
      '<p>Sharing a filing is a property of <em>capital operations</em>, not of management change in general. Governance changes are roughly six times more frequent as events, and the overwhelming majority are filed with no capital context at all.</p>'],
    revIn: `${int(D.reverse.same_day, 'en')} days (${num(D.reverse.pct, 'en', 2)}%) coincide with a capital operation`,
    revAll: `${int(D.reverse.change_days, 'en')} distinct governance-change filing days, ${D.period}`,
    cap5: `Distinct governance-change filing days, ${D.period}. The marked band is the ${num(D.reverse.pct, 'en', 2)}% that coincides with a capital operation of the same company.`,
    s6eye: '06 · Reading it', s6h: 'What it means in practice',
    s6: ['<p>If you follow a Spanish company, the capital filing is the moment to look at the board — not the quarter before. And if you see a lone governance change, the overwhelming likelihood is that there is no capital operation behind it.</p>',
      `<p>The inscription-to-publication lag is short and stable: across n=${int(D.lag.n, 'en')} capital acts the median is <strong>${D.lag.median} days</strong>, the 90th percentile ${D.lag.p90} and the 99th ${D.lag.p99}. Windows built on publication dates are therefore tight proxies for registration timing.</p>`],
    limH: 'Data and limitations',
    lims: [
      'BORME records <strong>registered legal events</strong> — not a company’s economic condition, value, or the motivation behind an act. Everything above is descriptive: <strong>no causal claims are made</strong>.',
      'Dates are publication dates. The interval between the notarial deed and inscription is unobservable.',
      'Counts are position-level, and the source carries no officer names: an entry appointing three board members of the same title yields one record after deduplication. Per-window rates are binary and unaffected.',
      'The before/after asymmetry in the baseline is censoring, reproduced identically in the treatment and baseline series.',
    ],
    ctaH: 'Explore any Spanish company',
    ctaP: 'The study looks at the whole. The tool does the same for a single company: search a company or a director and explore their links in an interactive graph.',
    ctaB: 'Open the search →',
    foot: 'Data: Boletín Oficial del Registro Mercantil (BORME), 2009–2025. Independent analysis produced through automated processes; it may contain errors or omissions. Not the Registro Mercantil, and it issues no certificates.',
    csvHead: ['Window', 'Increases %', 'Reductions %', 'Baseline %'],
  },
};

function heroes(t) {
  return t.heroes.map((h) => `<div><div class="n${h.hi ? '' : ' plain'}">${esc(h.n)}</div><div class="t">${h.t}</div></div>`).join('');
}

function windowTable(t, lang) {
  const cell = (arr) => arr.map((v) => `${num(v, lang)}${lang === 'es' ? ' %' : '%'}`).join(' / ');
  const rows = D.windows.map((w) =>
    `<tr><td>${esc(t.winLabels[w.id])}</td><td class="mono">${cell(w.inc)}</td><td class="mono">${cell(w.red)}</td><td class="mono">${cell(w.base)}</td></tr>`).join('');
  return `<table><caption>${esc(t.tblCap)}</caption>
    <thead><tr><th>${esc(t.thWin)}</th><th>${esc(t.thInc)}</th><th>${esc(t.thRed)}</th><th>${esc(t.thBase)}</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function csvFor(t, lang) {
  const cell = (arr) => arr.map((v) => num(v, lang)).join(' / ');
  return toCsv([t.csvHead, ...D.windows.map((w) => [t.winLabels[w.id], cell(w.inc), cell(w.red), cell(w.base)])]);
}

/** Everything the browser script needs, so no copy is templated into JS. */
function chartPayload(t, lang) {
  const sd = win('same_day'), d90 = win('d90'), d180 = win('d180');
  return {
    lang,
    bars: [
      { k: t.chartLabels[0], inc: sd.inc[0], red: sd.red[0], base: sd.base[0] },
      { k: t.chartLabels[1], inc: d90.inc[0], red: d90.red[0], base: d90.base[0] },
      { k: t.chartLabels[2], inc: d90.inc[1], red: d90.red[1], base: d90.base[1] },
      { k: t.chartLabels[3], inc: d180.inc[0], red: d180.red[0], base: d180.base[0] },
      { k: t.chartLabels[4], inc: d180.inc[1], red: d180.red[1], base: d180.base[1] },
    ],
    years: { from: D.years.from, rates: D.years.rates },
    forms: D.forms.map((f) => ({ k: f.id, n: `n=${int(f.n, lang)}`, cols: [f.same_day, f.d90_before], base: f.base })),
    amounts: D.amounts.map((a) => ({ k: t.amtLabels[a.id], v: a.median, n: `n=${int(a.n, lang)}` })),
    reverse: { pct: D.reverse.pct, inLabel: t.revIn, allLabel: t.revAll },
    labels: {
      inc: t.tabInc, red: t.tabRed, base: t.baseWord, mult: t.multTag,
      band: t.bandLabel, formCols: t.formCols,
      pct: lang === 'es' ? ' %' : '%', currency: lang === 'es' ? ' €' : '€', currencyBefore: lang === 'en',
    },
  };
}

const CHART_JS = readFileSync(path.join(__dirname, '_study_charts.js'), 'utf8');

function jsonLd(t, lang) {
  const url = `${SITE}${studyPath(STUDY, lang)}`;
  const article = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: STUDY[lang].title, description: t.desc, url,
    datePublished: D.published, inLanguage: lang,
    author: { '@type': 'Person', name: D.author },
    isBasedOn: 'https://www.boe.es/diario_borme/',
    publisher: { '@type': 'Organization', name: 'Mapa Societario', '@id': 'https://nurnbergconsulting.com/#org' },
  };
  const crumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.crumbHome, item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: t.crumbHub, item: `${SITE}${hubPath(lang)}` },
      { '@type': 'ListItem', position: 3, name: STUDY[lang].title, item: url },
    ],
  };
  const ser = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return [article, crumb].map((o) => `<script type="application/ld+json">${ser(o)}</script>`).join('');
}

function section(eye, h, paras, figure) {
  return `<section class="reveal"><div class="col">
    <span class="eyebrow">${esc(eye)}</span>
    <h2>${esc(h)}</h2>
    ${paras.join('\n    ')}
  </div>${figure || ''}</section>`;
}

const figure = (inner, cap) => `<figure class="fig"><div class="col">${inner}
    <figcaption>${esc(cap)}</figcaption>
  </div></figure>`;

function render(lang) {
  const t = T[lang];
  const url = `${SITE}${studyPath(STUDY, lang)}`;
  const altLang = lang === 'en' ? 'es' : 'en';
  const altLabel = lang === 'en' ? 'Español' : 'English';
  const payload = JSON.stringify(chartPayload(t, lang)).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">
<link rel="alternate" hreflang="es" href="${SITE}${studyPath(STUDY, 'es')}">
<link rel="alternate" hreflang="en" href="${SITE}${studyPath(STUDY, 'en')}">
<link rel="alternate" hreflang="x-default" href="${SITE}${studyPath(STUDY, 'es')}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(STUDY[lang].title)}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:image" content="${SITE}/og-image.svg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(STUDY[lang].title)}">
<meta name="twitter:description" content="${esc(t.desc)}">
${jsonLd(t, lang)}
${FONT_LINK}
<style>${PAGE_STYLE}
/* Content is visible by default; the reveal state applies only once JS confirms
   it can drive it, so a script fault can never leave the page blank. */
@media (prefers-reduced-motion:no-preference){
  .js-anim .reveal{opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s ease}
  .js-anim .reveal.in{opacity:1;transform:none}
}
</style>
${gaSnippet()}
</head>
<body>
<header class="mast">
  <div class="wrap"><div class="col">
    <nav class="crumbs"><span class="langs"><a href="${studyPath(STUDY, altLang)}">${altLabel}</a></span><a href="/">${esc(t.crumbHome)}</a> › <a href="${hubPath(lang)}">${esc(t.crumbHub)}</a></nav>
    <span class="eyebrow">${esc(t.kicker)}</span>
    <h1>${esc(STUDY[lang].title)}</h1>
    <p class="dek">${esc(t.dek)}</p>
    <div class="byline">
      <span><b>${esc(D.author)}</b></span>
      <span>${esc(t.publishedLabel)} ${esc(formatDate(D.published, lang))}</span>
      <span>${esc(t.dataLabel)} ${esc(formatDate(D.as_of, lang))}</span>
    </div>
  </div></div>
</header>

<div class="wrap">
  <div class="col"><div class="hero-num">${heroes(t)}</div></div>

  ${section(t.s1eye, t.s1h, t.s1, figure(`
    <div class="ctrls">
      <div role="tablist" aria-label="${esc(t.tabInc)} / ${esc(t.tabRed)}">
        <button role="tab" aria-selected="true" aria-controls="p-win" data-k="inc">${esc(t.tabInc)}</button>
        <button role="tab" aria-selected="false" aria-controls="p-win" data-k="red">${esc(t.tabRed)}</button>
      </div>
      <button class="tgl" id="win-tbl" aria-pressed="false" data-show="${esc(t.tblShow)}" data-hide="${esc(t.tblHide)}">${esc(t.tblShow)}</button>
    </div>
    <div class="plot" id="p-win"><svg id="s-win" role="img" aria-label="${esc(t.cap1)}"></svg></div>
    <div class="key">
      <span><i id="k-col"></i><b id="k-lab">${esc(t.tabInc)}</b></span>
      <span><i style="background:repeating-linear-gradient(45deg,var(--base-ink),var(--base-ink) 2px,transparent 2px,transparent 5px);border:1px solid var(--base-ink)"></i>${esc(t.keyBase)}</span>
    </div>
    <div id="win-table" hidden class="tbl-wrap">${windowTable(t, lang)}</div>`, t.cap1))}
  <div class="wrap"><div class="col"><div class="note">${t.note1}</div></div></div>

  ${section(t.s2eye, t.s2h, t.s2, figure('<div class="plot" id="p-yr"><svg id="s-yr" role="img" aria-label="' + esc(t.cap2) + '"></svg></div>', t.cap2))}
  ${section(t.s3eye, t.s3h, t.s3, figure('<div class="plot" id="p-form"><svg id="s-form" role="img" aria-label="' + esc(t.cap3) + '"></svg></div>', t.cap3))}
  ${section(t.s4eye, t.s4h, t.s4, figure('<div class="plot" id="p-amt"><svg id="s-amt" role="img" aria-label="' + esc(t.cap4) + '"></svg></div>', t.cap4))}
  ${section(t.s5eye, t.s5h, t.s5, figure('<div class="plot" id="p-rev"><svg id="s-rev" role="img" aria-label="' + esc(t.cap5) + '"></svg></div>', t.cap5))}

  <section class="reveal"><div class="col">
    <span class="eyebrow">${esc(t.s6eye)}</span>
    <h2>${esc(t.s6h)}</h2>
    ${t.s6.join('\n    ')}
    <h3>${esc(t.limH)}</h3>
    <ul class="limits">${t.lims.map((l) => `<li>${l}</li>`).join('')}</ul>
    ${citationBlock(STUDY, lang, D.published, SITE, csvHref(lang))}
    <div class="cta">
      <h2>${esc(t.ctaH)}</h2>
      <p>${esc(t.ctaP)}</p>
      <a href="/app/">${esc(t.ctaB)}</a>
    </div>
  </div></section>
</div>

<footer><div class="wrap"><div class="col">${esc(t.foot)}</div></div></footer>

<script type="application/json" id="study-data">${payload}</script>
<script>${CHART_JS}</script>
</body>
</html>`;
}

const distDir = path.resolve(root, 'dist');
for (const lang of ['es', 'en']) {
  const outDir = path.join(distDir, STUDY.paths[lang]);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), render(lang), 'utf8');
  writeFileSync(path.join(outDir, CSV_NAME[lang]), csvFor(T[lang], lang), 'utf8');
  console.log(`  Study: ${STUDY.paths[lang]}/index.html + ${CSV_NAME[lang]}`);
}
