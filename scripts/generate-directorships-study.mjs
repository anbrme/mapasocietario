/**
 * Build-time generator for the directorships study (Spain, one national graph,
 * with Madrid as the standout and every province compared):
 *   ES → dist/estudios/cargos-administracion-espana/index.html
 *   EN → dist/en/studies/spain-directorships/index.html
 *
 * Every figure comes from src/data/directorships-spain.json, assembled by
 * ncdata-bormes/studies_wip/madrid_interlock/build_snapshot.py from the dated
 * panel outputs (national graph, Madrid panel, all 52 provinces). Prose numbers
 * are computed here from that snapshot, never typed, so a rerun of the panel
 * cannot leave stale text behind.
 *
 * Standalone documents, like the other study pages, so Cloudflare Pages serves
 * them directly. Runs in POSTBUILD, after `vite build` empties dist/.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIES, hubPath, studyPath } from '../src/copy/studies.js';
import { esc, gaSnippet, citationBlock, toCsv, formatDate, PAGE_STYLE, FONT_LINK } from './_study_chrome.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SITE = 'https://mapasocietario.es';

const STUDY = STUDIES.find((s) => s.id === 'spain-directorships-concentration');
const D = JSON.parse(readFileSync(path.join(root, 'src/data', STUDY.dataFile), 'utf8'));
const CSV_NAME = { es: 'cargos-administracion-espana.csv', en: 'spain-directorships.csv' };
const csvHref = (lang) => `${STUDY.paths[lang]}/${CSV_NAME[lang]}`;

const FIRST = D.first_year, LAST = D.last_year;
const POPS = { ES: D.national, MAD: D.panel };
for (const rows of Object.values(POPS)) {
  if (rows[0].year !== FIRST || rows[rows.length - 1].year !== LAST) throw new Error('directorships snapshot: panel years do not match first_year/last_year');
}
const nFirst = D.national[0], nLast = D.national[D.national.length - 1];
const mFirst = D.panel[0], mLast = D.panel[D.panel.length - 1];

// Spanish writes 11,62 % and 987.436; English writes 11.62% and 987,436.
const num = (v, lang, dp = 1) => {
  const s = Number(v).toFixed(dp);
  return lang === 'es' ? s.replace('.', ',') : s;
};
const int = (v, lang) => {
  const s = String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '#');
  return s.replace(/#/g, lang === 'es' ? '.' : ',');
};
const pct = (v, lang, dp = 1) => `${num(v * 100, lang, dp)}${lang === 'es' ? ' %' : '%'}`;

/** Province facts for the static prose (the JS recomputes the same sentence for other years). */
function provinceFacts(lang) {
  const y = String(LAST), y0 = String(FIRST);
  const big = D.provinces.filter((p) => !p.small && p.years[y] && p.years[y0]).map((p) => ({
    name: p.province, companies: p.years[y].B.companies, delta: p.years[y].B.top1pct - p.years[y0].B.top1pct,
  }));
  const up = big.filter((r) => r.delta > 0.01).length, down = big.filter((r) => r.delta < 0).length;
  const top = big.reduce((a, b) => (b.delta > a.delta ? b : a));
  const flat = big.filter((r) => r.companies > 30000).reduce((a, b) => (Math.abs(b.delta) < Math.abs(a.delta) ? b : a));
  const madrid = big.find((r) => r.name === 'Madrid');
  return { n: big.length, up, down, top, flat, madrid, deltaFmt: (d) => num(d * 100, lang, 1) };
}

const F = (lang) => {
  const a = nFirst.B, b = nLast.B, ma = mFirst.B, mb = mLast.B, pf = provinceFacts(lang);
  return {
    // Spain
    companies: int(b.companies, lang), pairs: int(b.pairs, lang), officers: int(b.officers, lang),
    top1First: pct(a.top1pct, lang, 2), top1Last: pct(b.top1pct, lang, 2), top1Change: num((b.top1pct - a.top1pct) * 100, lang, 2),
    bxFirst: pct(nFirst.BX.top1pct, lang, 2), bxLast: pct(nLast.BX.top1pct, lang, 2),
    giniFirst: num(a.gini, lang, 3), giniLast: num(b.gini, lang, 3),
    tcGiniFirst: num(nFirst.TC.gini, lang, 3), tcGiniLast: num(nLast.TC.gini, lang, 3),
    unknownFirst: pct(1 - nFirst.BX.pairs / a.pairs, lang, 1), unknownLast: pct(1 - nLast.BX.pairs / b.pairs, lang, 1),
    interlockedLast: pct(b.interlocked, lang, 1), giantFirst: pct(a.giant, lang, 1), giantLast: pct(b.giant, lang, 1), giantRndLast: pct(b.giant_rnd_mean, lang, 1),
    ratioFirst: pct(a.giant / a.giant_rnd_mean, lang, 0), ratioLast: pct(b.giant / b.giant_rnd_mean, lang, 0),
    ppcFirst: num(a.pairs_per_company, lang, 2), ppcLast: num(b.pairs_per_company, lang, 2),
    // Madrid
    mTop1First: pct(ma.top1pct, lang, 2), mTop1Last: pct(mb.top1pct, lang, 2), mTop1Change: num((mb.top1pct - ma.top1pct) * 100, lang, 2),
    mGiniFirst: num(ma.gini, lang, 3), mGiniLast: num(mb.gini, lang, 3),
    mCompanies: int(mb.companies, lang), mInterlockedLast: pct(mb.interlocked, lang, 1), mGiantLast: pct(mb.giant, lang, 1), mGiantRndLast: pct(mb.giant_rnd_mean, lang, 1),
    mShare: pct(mb.pairs / b.pairs, lang, 0),
    pf,
  };
};

const T = {
  es: (f) => ({
    htmlLang: 'es', ogLocale: 'es_ES',
    title: `${STUDY.es.title} | Mapa Societario`,
    desc: `${f.companies} empresas activas, trece instantáneas anuales (${FIRST}–${LAST}) y las 52 provincias: el 1 % de administradores con más cargos pasa del ${f.top1First} al ${f.top1Last} de los cargos en España y del ${f.mTop1First} al ${f.mTop1Last} en Madrid, mientras solo el ${f.giantLast} de las empresas forma parte del mayor componente conexo.`,
    crumbHome: 'Mapa Societario', crumbHub: 'Estudios', kicker: 'Investigación original · BORME · Edición provisional',
    dek: `${f.companies} empresas activas y ${f.pairs} pares empresa–administrador en ${LAST}, reconstruidos a partir del BORME como un único grafo nacional. El 1 % de administradores con más cargos gana peso, del ${f.top1First} al ${f.top1Last}; en Madrid la subida es tres veces mayor, del ${f.mTop1First} al ${f.mTop1Last}, mientras Barcelona no se mueve. La red de administradores compartidos sigue fragmentada en todas partes.`,
    publishedLabel: 'Publicado el', dataLabel: 'Datos a', editionLabel: 'Edición',
    heroes: [
      { n: f.top1Last, t: `de los cargos en España en manos del <strong>1 % superior</strong> de administradores en ${LAST} (${f.top1First} en ${FIRST})`, hi: true },
      { n: f.mTop1Last, t: `en Madrid, la provincia donde más ha subido (${f.mTop1First} en ${FIRST})`, hi: true },
      { n: f.giantLast, t: `de las empresas españolas pertenecen al mayor componente conexo, frente a un ${f.giantRndLast} esperado al azar`, hi: false },
    ],
    s1eye: '01 · Concentración', s1h: 'Una cuota mayor en la cúspide, sobre todo en Madrid',
    s1: [
      `<p class="lede">Cada relación empresa–administrador cuenta una sola vez. Los gráficos siguen instantáneas reconstruidas a cierre de año de las empresas con inscripciones recientes; España es un único grafo, no la suma de las provincias.</p>`,
      `<p>En España, el 1 % de administradores con más cargos ocupaba el <strong>${f.top1First}</strong> de los cargos observados en ${FIRST} y el <strong>${f.top1Last}</strong> en ${LAST}, ${f.top1Change} puntos más. El índice de Gini de cargos por administrador pasa de ${f.giniFirst} a ${f.giniLast}.</p>`,
      `<p>Madrid concentra el ${f.mShare} de los pares y explica la mayor parte del movimiento: allí el 1 % superior pasa del <strong>${f.mTop1First}</strong> al <strong>${f.mTop1Last}</strong> (${f.mTop1Change} puntos; Gini de ${f.mGiniFirst} a ${f.mGiniLast}). Al excluir los cargos cuyo inicio nunca se observó, la dirección nacional se mantiene: del ${f.bxFirst} al ${f.bxLast}.</p>`,
    ],
    cap1: `Cuota de cargos del 1 % de administradores con más cargos, empresas con inscripciones recientes (variante B), ${FIRST}–${LAST}. Línea continua: España como un solo grafo. Línea discontinua: Madrid. Mueva el cursor o use el control deslizante para elegir el año.`,
    play: 'Reproducir', pause: 'Pausar', yearLabel: 'Año',
    note1: `<b>Lo que esto no demuestra.</b> La concentración por sí sola no distingue entre prestadores de servicios profesionales, grupos empresariales, vehículos de inversión o cambios en la estructura de gobierno. Sin la cola (administradores persona jurídica y administradores con más de ${D.heavy_threshold} cargos en toda España en esa fecha) el Gini nacional pasa de ${f.tcGiniFirst} a ${f.tcGiniLast}: la mayor parte del movimiento está en la cola.`,
    s2eye: '02 · Provincias', s2h: 'La misma lente, provincia a provincia',
    s2: [
      `<p>Cada provincia se reconstruye con las mismas reglas y el mismo año. Un administrador que une una empresa madrileña con una barcelonesa cuenta en el grafo nacional y en ninguna de las dos provincias, por eso España no es la suma de sus filas.</p>`,
      `<p>Madrid gana ${f.pf.deltaFmt(f.pf.madrid.delta)} puntos entre ${FIRST} y ${LAST}; ${esc(f.pf.flat.name)} se mantiene plana y ${f.pf.down} de las ${f.pf.n} provincias con al menos 2.000 empresas bajan. La tabla recalcula la comparativa para el año seleccionado.</p>`,
    ],
    provCols: ['Provincia', 'Empresas', '1 % superior', 'Δ 1 % sup. desde ' + FIRST, 'Gini', 'Interconectadas', 'Mayor componente', 'Observado ÷ aleatorio', 'Excluidas por la regla de cierre'],
    spainRow: 'España (un solo grafo)', sortHint: 'Pulse un encabezado para ordenar', tblCap: 'Población B, año seleccionado. * Menos de 2.000 empresas: solo tres extracciones aleatorias, léase con cautela.',
    summary: 'De las {n} provincias con al menos 2.000 empresas, la cuota del 1 % superior sube más de un punto en {up} y baja en {down} entre ' + FIRST + ' y {year}. La mayor subida es la de {top}, {delta} puntos; {flat} se mantiene plana.',
    cap2: `Comparativa provincial para el año seleccionado. La cuota del 1 % superior y el mayor componente dependen del tamaño de la población: compare entre provincias el cociente observado ÷ aleatorio y el Gini, no la cuota bruta del componente. La regla de cierre administrativo se publica de forma muy desigual según el registro (última columna).`,
    s3eye: '03 · Conectividad', s3h: 'La conectividad tiene límites',
    s3: [
      `<p>En ${LAST}, el ${f.interlockedLast} de las empresas españolas comparte un administrador con otra empresa, pero solo el ${f.giantLast} pertenece al mayor componente conexo (${f.giantFirst} en ${FIRST}). Los cargos por empresa bajaron de ${f.ppcFirst} a ${f.ppcLast}.</p>`,
      `<p>El componente observado equivale al ${f.ratioFirst} de su referencia aleatoria en ${FIRST} y al ${f.ratioLast} en ${LAST}. La red está persistentemente fragmentada respecto a esa referencia; no se está fragmentando más. En Madrid el componente es mayor, ${f.mGiantLast} frente a ${f.mGiantRndLast} al azar, con la misma proporción.</p>`,
    ],
    netTitle: 'El mayor componente conexo', netIntro: 'Empresas conectadas mediante cadenas de administradores compartidos, como proporción de todas las empresas de la población seleccionada.',
    pops: { ES: 'España', MAD: 'Madrid' },
    full: 'Población completa', trimmed: 'Sin la cola', observed: 'Observado', random: 'Media aleatoria', range: 'Rango de las extracciones', start: 'Punto de partida', selected: 'Instantánea seleccionada',
    cap3: `La referencia aleatoria conserva el número de cargos de cada empresa y de cada administrador y recompone quién se sienta dónde. El rango muestra las extracciones (cinco para España, diez para Madrid); no es un intervalo de confianza.`,
    s4eye: '04 · Explorador', s4h: 'Cambie la lente',
    s4: [`<p>Dos poblaciones, trece instantáneas anuales, cinco definiciones de población y nueve medidas, todas del mismo panel fechado.</p>`],
    exPop: 'Ámbito', exVariant: 'Definición de población', exMetric: 'Medida', exChange: 'Variación desde ' + FIRST, exCols: ['Año', 'Pares', 'Empresas¹', 'Administradores', 'Pares / empresa', '1 % superior', 'Gini', 'Interconectadas', 'Mayor componente'],
    cap4: `¹ Empresas que conservan al menos un par. En TC y TL, los porcentajes de red usan todas las empresas de B, incluidas las que quedan sin pares. Los administradores pueden ser personas físicas o administradores persona jurídica.`,
    s5eye: '05 · Método', s5h: 'La evidencia, con sus límites',
    methods: [
      ['¿Qué es un cargo y quién está incluido?', [
        'Un cargo es un par empresa–administrador distinto en una instantánea a cierre de año, reconstruido a partir de los nombramientos, reelecciones, ceses y revocaciones publicados en el BORME desde 2009. Varios cargos de gobierno de la misma persona en la misma empresa cuentan una sola vez. Los administradores incluyen personas físicas y administradores persona jurídica.',
        'La extracción se dirige a los prefijos de cargos de administración (administradores, consejeros, presidentes, consejeros delegados). Los apoderados, auditores y liquidadores quedan fuera. Un cese que nombra un cargo sin asiento abierto correspondiente cierra el cargo abierto más reciente de ese par; un cese sin ningún antecedente se trata como un cargo anterior a la ventana y se marca como de inicio desconocido.',
      ]],
      ['¿En qué difieren las cinco variantes de población?', [
        'A: todos los pares abiertos, excluidas las empresas disueltas, extinguidas o dadas de baja. B: A más una inscripción en el año en curso o en los cuatro anteriores y ningún cierre administrativo sin levantar. BX: B sin los cargos de inicio desconocido. TC: B sin administradores persona jurídica ni administradores con más de ' + D.heavy_threshold + ' cargos en toda España en esa fecha. TL: como TC, pero con el recuento histórico de empresas por administrador (usa información futura).',
        'En TC y TL, las empresas que quedan sin pares permanecen como nodos aislados del grafo. El grafo nacional y las provincias se calculan con las mismas reglas que el panel de Madrid.',
      ]],
      ['¿Cuánta historia falta?', [
        `Los registros comienzan en 2009. En la población B nacional, el ${f.unknownFirst} de los pares en ${FIRST} y el ${f.unknownLast} en ${LAST} son cargos cuyo inicio nunca se observó. Iniciar la serie en ${FIRST} no elimina esa censura por la izquierda; BX es una comprobación de sensibilidad, no una corrección.`,
        'La regla de cinco años puede excluir empresas en funcionamiento con gobierno sin cambios. Una inscripción reciente no prueba actividad económica.',
      ]],
      ['¿Cómo deben leerse los gráficos?', [
        'La cuota del 1 % superior es la fracción de pares en manos del 1 % de administradores con más cargos. El Gini mide la desigualdad en pares por administrador. Las empresas interconectadas comparten al menos un administrador con otra; el mayor componente conexo incluye además cadenas indirectas. Estos vínculos no acreditan propiedad, control común, parentesco ni conducta irregular.',
        'La referencia aleatoria fija las dos secuencias de grados (pares por empresa y por administrador), recompone las aristas sin duplicados y aplica una ronda completa de intercambios que conservan los grados. Diez extracciones en Madrid, cinco en el grafo nacional y en las provincias.',
      ]],
      ['¿Qué sigue abierto?', [
        'Los cierres administrativos (Hacienda y NIF) se publican de forma muy desigual según el registro: afectan al 0,2 % de las empresas madrileñas frente a más del 30 % en Las Palmas o Tarragona. La regla es casi inoperante en Madrid y no es comparable entre provincias. La provincia es la provincia registral de la empresa; los vínculos entre provincias solo aparecen en el grafo nacional.',
        'Están previstas muestras de validación contra inscripciones de origen, el análisis de flujos de nombramientos (adónde van los nuevos cargos) y cohortes de constitución. Todavía no se ha establecido ningún mecanismo de «administración profesional».',
      ]],
    ],
    limH: 'Datos y limitaciones',
    lims: [
      'El BORME recoge <strong>actos jurídicos inscritos</strong>, no la situación económica de una empresa. Todo lo anterior es descriptivo: <strong>no se hace ninguna afirmación causal</strong>.',
      'La identidad de las personas se reconstruye a partir del nombre publicado; el BORME no incluye identificadores personales. Los homónimos pueden inflar las carteras grandes y la conectividad, más en un grafo de un millón de empresas que en una provincia.',
      'El año 2026, incompleto, se excluye. Los valores anteriores a ' + FIRST + ' no se muestran porque la ventana de observación todavía se estaba llenando.',
    ],
    ctaH: 'Explora cualquier empresa española', ctaP: 'El estudio mira el conjunto. La herramienta hace lo mismo con una sola empresa: busca una sociedad o un administrador y explora sus vínculos en un grafo interactivo.', ctaB: 'Abrir el buscador →',
    foot: 'Datos: Boletín Oficial del Registro Mercantil (BORME), 2009–2026. Análisis independiente elaborado mediante procesos automatizados; puede contener errores u omisiones. No es el Registro Mercantil y no emite certificaciones.',
    csvHead: ['Ámbito', 'Año', 'Variante', 'Pares', 'Empresas', 'Administradores', 'Pares por empresa', 'Cuota 1 % superior', 'Gini', 'Interconectadas', 'Mayor componente', 'Mayor componente (media aleatoria)'],
    variants: { A: 'Todos los pares abiertos', B: 'Empresas con inscripciones recientes', BX: 'Sensibilidad: inicio conocido', TC: 'Recorte contemporáneo', TL: 'Recorte histórico' },
    variantNotes: {
      A: 'Pares de administración abiertos reconstruidos, excluidas las empresas disueltas, extinguidas o dadas de baja.',
      B: 'Pares abiertos en empresas con una inscripción en el año en curso o en los cuatro anteriores y sin cierre administrativo pendiente.',
      BX: 'Variante B sin los cargos cuyo inicio nunca se observó. Análisis de sensibilidad, no una población histórica completa.',
      TC: `Variante B sin administradores persona jurídica ni administradores con más de ${D.heavy_threshold} cargos en toda España en esa fecha.`,
      TL: `Variante B sin administradores persona jurídica ni administradores asociados a más de ${D.heavy_threshold} empresas a lo largo de toda la historia registrada (usa información futura).`,
    },
    metrics: { top1pct: 'Cuota del 1 % superior', gini: 'Gini de cargos', interlocked: 'Empresas interconectadas', giant: 'Mayor componente conexo', pairs: 'Pares empresa–administrador', companies: 'Empresas con pares', officers: 'Administradores con pares', pairs_per_officer: 'Pares por administrador', pairs_per_company: 'Pares por empresa' },
  }),
  en: (f) => ({
    htmlLang: 'en', ogLocale: 'en_GB',
    title: `${STUDY.en.title} | Mapa Societario`,
    desc: `${f.companies} active companies, thirteen annual snapshots (${FIRST}–${LAST}) and all 52 provinces: the 1% of directors with the most seats go from ${f.top1First} to ${f.top1Last} of seats in Spain and from ${f.mTop1First} to ${f.mTop1Last} in Madrid, while only ${f.giantLast} of companies belong to the largest connected component.`,
    crumbHome: 'Mapa Societario', crumbHub: 'Studies', kicker: 'Original research · BORME · Provisional edition',
    dek: `${f.companies} active companies and ${f.pairs} company–director pairs in ${LAST}, reconstructed from BORME as one national graph. The 1% of directors with the most seats gain ground, from ${f.top1First} to ${f.top1Last}; in Madrid the rise is three times larger, from ${f.mTop1First} to ${f.mTop1Last}, while Barcelona does not move. The network of shared directors stays fragmented everywhere.`,
    publishedLabel: 'Published', dataLabel: 'Data as of', editionLabel: 'Edition',
    heroes: [
      { n: f.top1Last, t: `of seats in Spain held by the <strong>top 1%</strong> of directors in ${LAST} (${f.top1First} in ${FIRST})`, hi: true },
      { n: f.mTop1Last, t: `in Madrid, the province with the largest rise (${f.mTop1First} in ${FIRST})`, hi: true },
      { n: f.giantLast, t: `of Spanish companies belong to the largest connected component, against ${f.giantRndLast} expected at random`, hi: false },
    ],
    s1eye: '01 · Concentration', s1h: 'A larger share at the top, above all in Madrid',
    s1: [
      `<p class="lede">Each company–director relationship counts once. The charts follow reconstructed year-end snapshots of recently filing companies; Spain is one graph, not the sum of its provinces.</p>`,
      `<p>In Spain, the 1% of directors with the most seats held <strong>${f.top1First}</strong> of observed seats in ${FIRST} and <strong>${f.top1Last}</strong> in ${LAST}, ${f.top1Change} points more. The Gini index of seats per director moves from ${f.giniFirst} to ${f.giniLast}.</p>`,
      `<p>Madrid holds ${f.mShare} of the pairs and accounts for most of the movement: there the top 1% goes from <strong>${f.mTop1First}</strong> to <strong>${f.mTop1Last}</strong> (${f.mTop1Change} points; Gini from ${f.mGiniFirst} to ${f.mGiniLast}). Excluding seats whose start was never observed, the national direction holds: ${f.bxFirst} to ${f.bxLast}.</p>`,
    ],
    cap1: `Share of seats held by the 1% of directors with the most seats, recently filing companies (variant B), ${FIRST}–${LAST}. Solid line: Spain as one graph. Dashed line: Madrid. Move over the chart or use the slider to pick a year.`,
    play: 'Play', pause: 'Pause', yearLabel: 'Year',
    note1: `<b>What this does not establish.</b> Concentration alone cannot distinguish professional service providers from business groups, ownership vehicles or changes in governance structure. Without the tail (corporate officers and directors holding more than ${D.heavy_threshold} seats nationwide at that date) the national Gini moves from ${f.tcGiniFirst} to ${f.tcGiniLast}: most of the movement is in the tail.`,
    s2eye: '02 · Provinces', s2h: 'The same lens, province by province',
    s2: [
      `<p>Every province is reconstructed with the same rules and the same year. A director who links a Madrid company to a Barcelona company counts in the national graph and in neither province, which is why Spain is not the sum of its rows.</p>`,
      `<p>Madrid gains ${f.pf.deltaFmt(f.pf.madrid.delta)} points between ${FIRST} and ${LAST}; ${esc(f.pf.flat.name)} is flat and ${f.pf.down} of the ${f.pf.n} provinces with at least 2,000 companies fall. The table recomputes the comparison for the selected year.</p>`,
    ],
    provCols: ['Province', 'Companies', 'Top 1%', 'Δ top 1% since ' + FIRST, 'Gini', 'Interlocked', 'Largest component', 'Observed ÷ random', 'Removed by closure rule'],
    spainRow: 'Spain (one graph)', sortHint: 'Click a heading to sort', tblCap: 'Population B, selected year. * Fewer than 2,000 companies: three random draws only, read with care.',
    summary: 'Among the {n} provinces with at least 2,000 companies, the top 1% share rose by more than one point in {up} and fell in {down} between ' + FIRST + ' and {year}. The largest rise is {top}, {delta} points; {flat} is flat.',
    cap2: `Province comparison for the selected year. The top 1% share and the largest component scale with population size: compare the observed ÷ random ratio and the Gini across provinces, not the raw component share. The administrative-closure rule is published very unevenly across registries (last column).`,
    s3eye: '03 · Connectivity', s3h: 'Connectivity has limits',
    s3: [
      `<p>In ${LAST}, ${f.interlockedLast} of Spanish companies share a director with another company, but only ${f.giantLast} belong to the largest connected component (${f.giantFirst} in ${FIRST}). Seats per company fell from ${f.ppcFirst} to ${f.ppcLast}.</p>`,
      `<p>The observed component is ${f.ratioFirst} of its random benchmark in ${FIRST} and ${f.ratioLast} in ${LAST}. The network is persistently fragmented relative to that benchmark; it is not becoming more fragmented. Madrid's component is larger, ${f.mGiantLast} against ${f.mGiantRndLast} at random, with the same ratio.</p>`,
    ],
    netTitle: 'The largest connected component', netIntro: 'Companies connected through chains of shared directors, as a share of all companies in the selected population.',
    pops: { ES: 'Spain', MAD: 'Madrid' },
    full: 'Full population', trimmed: 'Tail removed', observed: 'Observed', random: 'Random mean', range: 'Range of the draws', start: 'Starting point', selected: 'Selected snapshot',
    cap3: `The benchmark keeps every company’s and every director’s number of seats and rewires who sits where. The range shows the draws (five for Spain, ten for Madrid); it is not a confidence interval.`,
    s4eye: '04 · Explorer', s4h: 'Change the lens',
    s4: [`<p>Two populations, thirteen annual snapshots, five population definitions and nine measures, all from the same dated panel.</p>`],
    exPop: 'Scope', exVariant: 'Population definition', exMetric: 'Measure', exChange: 'Change since ' + FIRST, exCols: ['Year', 'Pairs', 'Companies¹', 'Officers', 'Pairs / company', 'Top 1%', 'Gini', 'Interlocked', 'Largest component'],
    cap4: `¹ Companies retaining at least one pair. For TC and TL, graph percentages use all B companies, including companies left with no retained pairs. Officers may be natural persons or corporate administrators.`,
    s5eye: '05 · Method', s5h: 'The evidence, with its limits',
    methods: [
      ['What is a seat, and who is included?', [
        'A seat is one distinct company–officer pair at a year-end snapshot, reconstructed from the appointments, re-elections, cessations and revocations published in BORME since 2009. Several governance roles held by the same person at the same company count once. Officers include both natural persons and corporate administrators.',
        'The extraction targets director-role prefixes (administrators, board members, chairs, managing directors). Powers of attorney, auditors and liquidators are out of scope. A cessation naming a role with no matching open seat closes the most recently opened seat of that pair; a cessation with no prior history is treated as a seat that predates the window and flagged unknown-start.',
      ]],
      ['How do the five population variants differ?', [
        'A: all open pairs, excluding dissolved, extinct or deregistered companies. B: A plus a filing in the current or preceding four years and no unlifted administrative closure. BX: B without unknown-start seats. TC: B without corporate officers and without directors holding more than ' + D.heavy_threshold + ' seats nationwide at that date. TL: as TC, but using the lifetime count of companies per director (uses future information).',
        'For TC and TL, companies left with no pairs stay as isolated graph nodes. The national graph and the provinces use the same rules as the Madrid panel.',
      ]],
      ['How much history is missing?', [
        `Records start in 2009. In the national B population, ${f.unknownFirst} of pairs in ${FIRST} and ${f.unknownLast} in ${LAST} are seats whose start was never observed. Starting the series in ${FIRST} does not eliminate that left-censoring; BX is a sensitivity check, not a correction.`,
        'The five-year recency rule can exclude functioning companies with unchanged governance. Recent filing is not proof of economic activity.',
      ]],
      ['How should the charts be read?', [
        'The top 1% share is the fraction of pairs held by the 1% of directors with the most seats. Gini measures inequality in pairs per director. Interlocked companies share at least one director with another; the largest connected component also includes indirect chains. These links do not establish ownership, common control, family ties or misconduct.',
        'The random benchmark fixes both degree sequences (pairs per company and per director), rewires the edges without duplicates and applies one full round of degree-preserving swaps. Ten draws for Madrid, five for the national graph and the provinces.',
      ]],
      ['What remains open?', [
        'Administrative closures (tax and NIF) are published very unevenly across registries: they touch 0.2% of Madrid companies against more than 30% in Las Palmas or Tarragona. The rule is close to inert in Madrid and not comparable across provinces. The province is the company’s registry province; links between provinces appear only in the national graph.',
        'Validation samples against source filings, an appointment-flow analysis (where new seats go) and incorporation cohorts are planned. No “professional administration” mechanism has yet been established.',
      ]],
    ],
    limH: 'Data and limitations',
    lims: [
      'BORME records <strong>registered legal acts</strong>, not a company’s economic situation. Everything above is descriptive: <strong>no causal claim is made</strong>.',
      'Person identity is reconstructed from the published name; BORME carries no personal identifiers. Namesakes can inflate large portfolios and connectivity, more so in a graph of a million companies than in one province.',
      'The incomplete year 2026 is excluded. Values before ' + FIRST + ' are not shown because the observation window was still filling.',
    ],
    ctaH: 'Explore any Spanish company', ctaP: 'The study looks at the whole. The tool does the same for a single company: search a company or a director and explore their links in an interactive graph.', ctaB: 'Open the search →',
    foot: 'Data: Boletín Oficial del Registro Mercantil (BORME), 2009–2026. Independent analysis produced through automated processes; it may contain errors or omissions. Not the Registro Mercantil, and it issues no certificates.',
    csvHead: ['Scope', 'Year', 'Variant', 'Pairs', 'Companies', 'Officers', 'Pairs per company', 'Top 1% share', 'Gini', 'Interlocked', 'Largest component', 'Largest component (random mean)'],
    variants: { A: 'All open pairs', B: 'Recently filing companies', BX: 'Known-start sensitivity', TC: 'Contemporaneous trim', TL: 'Lifetime trim' },
    variantNotes: {
      A: 'Reconstructed open directorship pairs, excluding companies treated as dissolved, extinct or deregistered.',
      B: 'Open directorship pairs at companies with a filing in the current or preceding four years and no unlifted administrative closure.',
      BX: 'Variant B excluding seats whose start was never observed. A sensitivity analysis, not a complete historical population.',
      TC: `Variant B with corporate officers and directors holding more than ${D.heavy_threshold} nationwide seats at that date removed.`,
      TL: `Variant B with corporate officers and directors associated with more than ${D.heavy_threshold} companies over the recorded history removed (uses future information).`,
    },
    metrics: { top1pct: 'Top 1% share of seats', gini: 'Gini of seats', interlocked: 'Interlocked companies', giant: 'Largest connected component', pairs: 'Company–director pairs', companies: 'Companies with retained pairs', officers: 'Officers with retained pairs', pairs_per_officer: 'Pairs per officer', pairs_per_company: 'Pairs per company' },
  }),
};

const STUDY_STYLE = `
.hero-num .n{white-space:nowrap;font-size:30px}
.fig.wide .col{max-width:1120px}
.readout{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:6px}
.readout>div{display:flex;gap:18px}
.rv{display:flex;flex-direction:column;align-items:flex-end}
.rv b{font:600 26px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:-.02em}
.rv small{font-size:11.5px;color:var(--ink-3);margin-top:4px}
.timeline{display:flex;align-items:center;gap:12px;margin:16px 0 0;font:500 12px/1 "IBM Plex Mono",ui-monospace,monospace;color:var(--ink-3)}
.timeline input[type=range]{flex:1;accent-color:var(--stamp)}
.timeline output{font-size:15px;color:var(--ink);font-weight:600;min-width:3.2em;text-align:right}
.net-bars{margin-top:12px}
.net-year{padding:16px 0;border-top:1px solid var(--rule-2)}
.net-h{display:flex;align-items:baseline;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.net-h b{font:600 24px/1 "IBM Plex Serif",Georgia,serif}
.net-h small{font-size:12.5px;color:var(--ink-3)}
.bar-line{display:grid;grid-template-columns:110px 1fr 70px;align-items:center;gap:12px;margin:6px 0;font-size:13px}
.bar-name{color:var(--ink-2)}
.bar-track{height:14px;background:var(--rule-2);border-radius:2px;overflow:hidden}
.bar-fill{height:100%;border-radius:2px}
.bar-fill.obs{background:var(--stamp)}.bar-fill.rnd{background:var(--base-ink)}
.bar-line strong{font:600 13px/1 "IBM Plex Mono",ui-monospace,monospace;text-align:right}
.range{display:block;font-size:12px;color:var(--ink-3);margin-top:6px}
.net-axis{display:grid;grid-template-columns:110px 1fr 70px;font:400 11px/1 "IBM Plex Mono",ui-monospace,monospace;color:var(--ink-3)}
.net-axis div{display:flex;justify-content:space-between}
.ctrls.net{gap:10px}
th button{all:unset;cursor:pointer;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit}
th button:focus-visible{outline:2px solid var(--stamp);outline-offset:2px}
th[aria-sort=ascending] button:after{content:" ↑"}th[aria-sort=descending] button:after{content:" ↓"}
tr.spain td{background:var(--rule-2);font-weight:600}
tr.small td{color:var(--ink-3)}
tr.sel td{background:var(--rule-2)}
.prov-summary{font-size:16px;color:var(--ink);margin:0 0 6px}
.sel-row{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px}
.sel-row label{display:flex;flex-direction:column;gap:5px;font:500 11.5px/1.4 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.sel-row select{font:400 14px/1.3 "IBM Plex Sans",sans-serif;padding:7px 10px;border:1px solid var(--rule);border-radius:3px;background:var(--raise);color:var(--ink);min-width:200px}
.ex-sum{display:flex;gap:26px;flex-wrap:wrap;margin:14px 0 0;font:400 12px/1.4 "IBM Plex Mono",ui-monospace,monospace;color:var(--ink-3)}
.ex-sum b{display:block;font-size:18px;color:var(--ink);font-weight:600}
.ex-note{font-size:13px;color:var(--ink-3);margin:8px 0 0}
details{border-top:1px solid var(--rule-2);padding:14px 0}
details:last-of-type{border-bottom:1px solid var(--rule-2)}
summary{cursor:pointer;font-weight:600;font-family:"IBM Plex Serif",Georgia,serif;font-size:17px;list-style:none;display:flex;justify-content:space-between;gap:12px}
summary::-webkit-details-marker{display:none}
summary:after{content:"+";color:var(--ink-3);font-family:"IBM Plex Mono",monospace}
details[open] summary:after{content:"−"}
details p{font-size:15px;color:var(--ink-2);margin:10px 0 0}
.play{appearance:none;border:1px solid var(--rule);background:var(--raise);color:var(--ink-2);cursor:pointer;font:500 12px/1 "IBM Plex Mono",ui-monospace,monospace;padding:7px 11px;border-radius:3px}
.play[aria-pressed=true]{border-color:var(--stamp);color:var(--stamp)}
`;

function heroes(t) {
  return t.heroes.map((h) => `<div><div class="n${h.hi ? '' : ' plain'}">${esc(h.n)}</div><div class="t">${h.t}</div></div>`).join('');
}

function csvFor(t, lang) {
  const rows = [t.csvHead];
  for (const [pop, panel] of Object.entries(POPS)) for (const r of panel) for (const v of ['A', 'B', 'BX', 'TC', 'TL']) {
    const x = r[v];
    rows.push([t.pops[pop], r.year, v, x.pairs, x.companies, x.officers, num(x.pairs_per_company, lang, 3), num(x.top1pct, lang, 4), num(x.gini, lang, 4), num(x.interlocked, lang, 4), num(x.giant, lang, 4), num(x.giant_rnd_mean, lang, 4)]);
  }
  return toCsv(rows);
}

/** Everything the browser script needs, so no copy is templated into JS. */
function chartPayload(t, lang) {
  return {
    lang, first: FIRST, last: LAST,
    pops: POPS, provinces: D.provinces,
    labels: {
      pct: lang === 'es' ? ' %' : '%',
      pops: t.pops, variants: t.variants, variantNotes: t.variantNotes, metrics: t.metrics,
      observed: t.observed, random: t.random, range: t.range, start: t.start, selected: t.selected,
      spainRow: t.spainRow, summary: t.summary, play: t.play, pause: t.pause,
    },
  };
}

const CHART_JS = readFileSync(path.join(__dirname, '_directorships_charts.js'), 'utf8');

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
  return `<section><div class="col">
    <span class="eyebrow">${esc(eye)}</span>
    <h2>${esc(h)}</h2>
    ${paras.join('\n    ')}
  </div>${figure || ''}</section>`;
}
const figure = (inner, cap, wide = false) => `<figure class="fig${wide ? ' wide' : ''}"><div class="col">${inner}
    <figcaption>${esc(cap)}</figcaption>
  </div></figure>`;

const tablist = (id, label, items, selected) => `<div role="tablist" id="${id}" aria-label="${esc(label)}">${items.map(([k, v]) =>
  `<button role="tab" aria-selected="${k === selected ? 'true' : 'false'}" data-k="${k}">${esc(v)}</button>`).join('')}</div>`;

function provinceTable(t) {
  return `<p class="prov-summary" id="prov-summary"></p>
    <div class="tbl-wrap"><table><caption>${esc(t.tblCap)} ${esc(t.sortHint)}.</caption>
    <thead><tr id="prov-head">${t.provCols.map((c) => `<th scope="col" aria-sort="none"><button type="button">${esc(c)}</button></th>`).join('')}</tr></thead>
    <tbody id="prov-body"></tbody></table></div>`;
}

function explorer(t) {
  const opt = (k, v, sel) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`;
  return `<div class="sel-row">
      <label>${esc(t.exPop)}<select id="ex-pop">${Object.entries(t.pops).map(([k, v]) => opt(k, v, 'ES')).join('')}</select></label>
      <label>${esc(t.exVariant)}<select id="ex-variant">${Object.entries(t.variants).map(([k, v]) => opt(k, `${k} · ${v}`, 'B')).join('')}</select></label>
      <label>${esc(t.exMetric)}<select id="ex-metric">${Object.entries(t.metrics).map(([k, v]) => opt(k, v, 'top1pct')).join('')}</select></label>
    </div>
    <p class="ex-note" id="ex-note"></p>
    <div class="readout" id="r-ex"></div>
    <div class="plot"><svg id="s-ex" role="img" aria-label="${esc(t.s4h)}"></svg></div>
    <div class="ex-sum"><div>${FIRST}<b id="ex-first"></b></div><div><span class="year-out">${LAST}</span><b id="ex-cur"></b></div><div>${esc(t.exChange)}<b id="ex-delta"></b></div></div>
    <div class="tbl-wrap"><table><caption id="ex-title"></caption>
    <thead><tr>${t.exCols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody id="ex-body"></tbody></table></div>`;
}

function render(lang) {
  const f = F(lang);
  const t = T[lang](f);
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
<style>${PAGE_STYLE}${STUDY_STYLE}</style>
${gaSnippet()}
</head>
<body>
<header class="mast"><div class="wrap"><div class="col">
    <nav class="crumbs" aria-label="breadcrumb"><a href="/">${esc(t.crumbHome)}</a> / <a href="${hubPath(lang)}">${esc(t.crumbHub)}</a>
      <span class="langs"><a href="${studyPath(STUDY, altLang)}" hreflang="${altLang}" lang="${altLang}">${altLabel}</a></span></nav>
    <span class="eyebrow">${esc(t.kicker)}</span>
    <h1>${esc(STUDY[lang].title)}</h1>
    <p class="dek">${esc(t.dek)}</p>
    <div class="byline">
      <span><b>${esc(D.author)}</b></span>
      <span>${esc(t.publishedLabel)} ${esc(formatDate(D.published, lang))}</span>
      <span>${esc(t.dataLabel)} ${esc(formatDate(D.as_of, lang))}</span>
      <span>${esc(t.editionLabel)} ${esc(D.edition)}</span>
    </div>
  </div></div>
</header>

<div class="wrap">
  <div class="col"><div class="hero-num">${heroes(t)}</div></div>

  ${section(t.s1eye, t.s1h, t.s1, figure(`
    <div class="readout" id="r-conc"></div>
    <div class="plot"><svg id="s-conc" role="img" aria-label="${esc(t.cap1)}"></svg></div>
    <div class="timeline"><button type="button" class="play" id="year-play" aria-pressed="false">${esc(t.play)}</button><span>${FIRST}</span>
      <input type="range" id="year-range" min="${FIRST}" max="${LAST}" step="1" value="${LAST}" aria-label="${esc(t.yearLabel)}"><span>${LAST}</span><output for="year-range" class="year-out">${LAST}</output></div>
    <div class="key"><span><i style="background:var(--stamp)"></i>${esc(t.pops.ES)} · B</span><span><i style="background:var(--amber)"></i>${esc(t.pops.MAD)} · B</span></div>`, t.cap1))}
  <div class="wrap"><div class="col"><div class="note">${t.note1}</div></div></div>

  ${section(t.s2eye, t.s2h, t.s2, figure(provinceTable(t), t.cap2, true))}

  ${section(t.s3eye, t.s3h, t.s3, figure(`
    <div class="ctrls net"><h3 style="margin:0">${esc(t.netTitle)}</h3>
      <span style="margin-left:auto"></span>
      ${tablist('net-pop', t.exPop, Object.entries(t.pops), 'ES')}
      ${tablist('net-var', `${t.full} / ${t.trimmed}`, [['B', t.full], ['TC', t.trimmed]], 'B')}</div>
    <p style="font-size:14px;color:var(--ink-2)">${esc(t.netIntro)}</p>
    <div class="net-axis"><span></span><div><span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>40%</span></div><span></span></div>
    <div class="net-bars" id="net-bars"></div>`, t.cap3))}

  ${section(t.s4eye, t.s4h, t.s4, figure(explorer(t), t.cap4, true))}

  <section><div class="col">
    <span class="eyebrow">${esc(t.s5eye)}</span>
    <h2>${esc(t.s5h)}</h2>
    ${t.methods.map(([h, ps], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(h)}</summary>${ps.map((p) => `<p>${esc(p)}</p>`).join('')}</details>`).join('\n    ')}
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
  writeFileSync(path.join(outDir, CSV_NAME[lang]), csvFor(T[lang](F(lang)), lang), 'utf8');
  console.log(`  Study: ${STUDY.paths[lang]}/index.html + ${CSV_NAME[lang]}`);
}
