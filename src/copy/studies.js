/**
 * The one registry of published data studies.
 *
 * Studies are the site's authority artifacts: unlike a company page, a study is
 * the kind of thing a journalist or a researcher will cite and link to, and a
 * link is the only lever that raises this domain's authority. That only pays off
 * if the studies are (a) reachable from a hub instead of sitting as orphans and
 * (b) mechanically citable. Both need one list, so paths live HERE and nowhere
 * else — the hub generator, each study generator and the sitemap all read this.
 *
 * Deliberately free of Node imports so it can be unit-tested and imported from
 * both build scripts and the SPA. Dates are NOT held here: each study's date is
 * read from its own snapshot in src/data/, so the page and the citation can
 * never disagree about when the data was taken.
 */

export const LANGS = ['es', 'en'];

export const HUB_PATHS = {
  es: '/estudios',
  en: '/en/studies',
};

export const STUDIES = [
  {
    id: 'ibex35-interlocking-boards',
    dataFile: 'interlock-ibex35.json',
    paths: {
      es: '/estudios/consejos-cruzados-ibex-35',
      en: '/en/studies/ibex-35-interlocking-boards',
    },
    es: {
      title: 'Los consejos cruzados del IBEX 35',
      blurb:
        'Quién se sienta en más de un consejo entre las 35 mayores cotizadas españolas, y qué empresas quedan unidas por un consejero compartido.',
    },
    en: {
      title: 'The interlocking boards of the IBEX 35',
      blurb:
        "Who sits on more than one board among Spain's 35 largest listed companies, and which companies a shared director links together.",
    },
  },
];

/** Canonical, trailing-slashed path for a study page. */
export const studyPath = (study, lang) => `${study.paths[lang]}/`;

/** Canonical, trailing-slashed path for the studies hub. */
export const hubPath = (lang) => `${HUB_PATHS[lang]}/`;

const MONTHS = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** "2026-07-09" → "julio de 2026" / "July 2026". */
export function formatMonth(iso, lang) {
  const [year, month] = String(iso).split('-');
  const name = MONTHS[lang][Number(month) - 1];
  return lang === 'en' ? `${name} ${year}` : `${name} de ${year}`;
}

/**
 * A single plain-text line a reader can paste into a footnote. Kept to one line
 * on purpose: a citation block that offers five export formats is a block people
 * skip. Publisher, title, what the data is, when it was taken, where it lives.
 */
export function citationText(study, lang, asOf, siteUrl) {
  const year = String(asOf).slice(0, 4);
  const url = `${String(siteUrl).replace(/\/+$/, '')}${studyPath(study, lang)}`;
  const when = formatMonth(asOf, lang);
  return lang === 'en'
    ? `Mapa Societario (${year}). ${study.en.title}. Study based on Spanish commercial-registry (BORME) data, ${when}. ${url}`
    : `Mapa Societario (${year}). ${study.es.title}. Estudio elaborado a partir de datos del Registro Mercantil (BORME), ${when}. ${url}`;
}
