import { SEED, V3_TO_SLUG } from '../../functions/empresa/_ibex35.js';

// A trailing registry-office annotation ("(R.M. A CORUÑA)", "(RM MADRID)")
// that live graph names carry but the SEED's v3Name never does — e.g.
// "INDUSTRIA DE DISEÑO TEXTIL, S.A.(R.M. A CORUÑA)". Stripped BEFORE
// punctuation removal, since the regex itself needs the parens/dots intact.
const REGISTRY_OFFICE_SUFFIX = /\s*\(R\.?M\.?\s+[^)]*\)\s*$/i;

// Resolves a BORME/v3 company name to its IBEX 35 SEED entry, or null if the
// company is not one of the curated IBEX 35 seed entries. Matching is
// punctuation-insensitive ("BANCO SANTANDER, S.A." ≡ "BANCO SANTANDER, SA"):
// enrichment runs re-canonicalize doc names between the two forms, so graph
// nodes can carry either depending on when their doc was last rebuilt.
const nameKey = (s) =>
  String(s)
    .toUpperCase()
    .replace(REGISTRY_OFFICE_SUFFIX, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const KEY_TO_SLUG = Object.fromEntries(
  Object.entries(V3_TO_SLUG).map(([v3Name, slug]) => [nameKey(v3Name), slug]),
);

export function matchIbexSeed(companyName) {
  if (!companyName) return null;
  const slug = KEY_TO_SLUG[nameKey(companyName)];
  if (!slug) return null;
  return SEED[slug] || null;
}

// A query shorter than this never pins anything — short prefixes ("in", "a")
// would otherwise match too many brands and dominate the dropdown.
const MIN_BRAND_QUERY_LENGTH = 3;

// Fold a raw string for brand-prefix matching: upper-case, strip diacritics,
// trim. Deliberately looser than nameKey (which is for exact name comparison,
// punctuation-insensitive) — this only needs to compare a typed query against
// a brand name like "Inditex" or "Acciona Energía".
const foldForBrandMatch = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

// True when `suggestion` already represents the given seed entity, either by
// its stable id/groupKey or by its punctuation-insensitive name.
function suggestionMatchesSeedEntity(suggestion, id, brandNameKey) {
  if (!suggestion) return false;
  if (suggestion.id === id || suggestion.groupKey === id) return true;
  const suggestionKey = nameKey(suggestion.name || suggestion.label || suggestion.display_name || '');
  return suggestionKey !== '' && suggestionKey === brandNameKey;
}

/**
 * Prepend a synthetic suggestion for every curated IBEX 35 seed entity whose
 * brand name (e.g. "Inditex") the (folded) query is a prefix of — either of
 * the brand as a whole, or of any of its whitespace-separated words (e.g.
 * "santander" prefixes the second word of "Banco Santander") — the listed
 * entity (e.g. "INDUSTRIA DE DISEÑO TEXTIL, S.A.") never surfaces on its own
 * because its registered name doesn't contain the brand people search for. A
 * word-internal substring that is not a prefix of that word ("tander") does
 * not match. Skips a seed already represented in `suggestions` (same
 * id/groupKey, or the same name once punctuation is ignored). Multiple
 * brands can match one query (e.g. "banco" matches both Banco Santander and
 * Banco Sabadell) — all are pinned, in seed declaration order. Pure: never
 * mutates `suggestions`; returns the SAME array reference when nothing is
 * pinned.
 * @param {string} query
 * @param {Array<object>} suggestions
 * @returns {Array<object>}
 */
export function pinListedEntities(query, suggestions) {
  const list = Array.isArray(suggestions) ? suggestions : [];
  const folded = foldForBrandMatch(query);
  if (folded.length < MIN_BRAND_QUERY_LENGTH) return list;

  const pins = Object.values(SEED).reduce((acc, seed) => {
    const brandFolded = foldForBrandMatch(seed.name);
    const brandWords = brandFolded.split(/\s+/).filter(Boolean);
    const isBrandPrefixMatch = brandFolded.startsWith(folded)
      || brandWords.some(word => word.startsWith(folded));
    if (!isBrandPrefixMatch) return acc;

    const id = `H:${seed.hoja.replace(/\s+/g, '-')}`;
    const brandNameKey = nameKey(seed.v3Name);
    const alreadyPresent = list.some(s => suggestionMatchesSeedEntity(s, id, brandNameKey));
    if (alreadyPresent) return acc;

    return [
      ...acc,
      {
        name: seed.v3Name,
        label: seed.v3Name,
        display_name: seed.v3Name,
        id,
        groupKey: id,
        type: 'company',
        source: 'ibex_seed',
        listed: true,
      },
    ];
  }, []);

  return pins.length > 0 ? [...pins, ...list] : list;
}

// "Listed company" badge copy for the autocomplete and findings header — see
// listedBadgeFor below. Bilingual here (not in the graph's `text` dict)
// because the badge is IBEX-35-specific and only ever needs these two forms.
const LISTED_BADGE_LABEL = {
  en: 'Listed · IBEX 35',
  es: 'Cotizada · IBEX 35',
};

/**
 * Badge to show next to a company name that resolves to a curated IBEX 35
 * SEED entry — distinguishes a listed entity (e.g. "INDUSTRIA DE DISEÑO
 * TEXTIL, S.A.", the listed Inditex) from an unlisted sibling that shares
 * part of its name (e.g. "INDITEX, SA", the unlisted group entity) and would
 * otherwise be indistinguishable in a search list.
 * @param {string} companyName
 * @param {string} lang
 * @returns {{label: string, ticker: string} | null}
 */
export function listedBadgeFor(companyName, lang) {
  const match = matchIbexSeed(companyName);
  if (!match) return null;
  return { label: LISTED_BADGE_LABEL[lang === 'en' ? 'en' : 'es'], ticker: match.ticker };
}

// Matches every spanish-company-group node against the IBEX 35 SEED,
// deduplicated by NIF. Used by the Android prefetch effect in
// SpanishCompanyNetworkGraph.jsx to discover which currently-loaded nodes
// are worth fetching market data for.
export function matchAllIbexNodes(nodes) {
  const seen = new Set();
  const matches = [];
  (Array.isArray(nodes) ? nodes : []).forEach(n => {
    if (!n || n.type !== 'spanish-company-group' || !n.name) return;
    const match = matchIbexSeed(n.name);
    if (match && !seen.has(match.nif)) {
      seen.add(match.nif);
      matches.push(match);
    }
  });
  return matches;
}

// Excel/Google Sheets serial date (days since 1899-12-30) -> JS Date, or null
// if the value isn't a finite number. The upstream sheet occasionally stores
// a plain date string instead of a serial (e.g. Naturgy's "Sonatrach" row has
// reportDate: "15/11/2011") — Number(...) on that yields NaN, which used to
// produce an Invalid Date and throw downstream when formatted.
function excelSerialToDate(serial) {
  const num = Number(serial);
  if (!Number.isFinite(num)) return null;
  return new Date(Date.UTC(1899, 11, 30) + num * 86400000);
}

function formatReportDate(reportDate, lang) {
  const date = excelSerialToDate(reportDate);
  return date ? formatDateForLang(date, lang) : null;
}

function formatDateForLang(date, lang) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatCurrency(value, lang) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactCurrency(value, lang) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

// API percent-ish fields (change_percent, dividend_yield, shareholder percentage)
// are already expressed as percent units (e.g. 6.5 means 6.5%), not fractions.
function formatPercentValue(value, lang, { showSign = false } = {}) {
  if (value === null || value === undefined) return null;
  const formatted = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: showSign ? 'exceptZero' : 'auto',
  }).format(Number(value));
  return `${formatted}%`;
}

function formatPlainNumber(value, lang) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES').format(value);
}

export function buildIbexCardViewModel(seedEntry, apiRow, lang = 'es') {
  if (!seedEntry || !apiRow) return null;

  const shareholders = (Array.isArray(apiRow.shareholders) ? apiRow.shareholders : [])
    .slice()
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    .map(s => ({
      name: s.name,
      percentageLabel: formatPercentValue(s.percentage, lang),
      asOfLabel: formatReportDate(s.reportDate, lang),
    }));

  return {
    name: seedEntry.name,
    priceLabel: formatCurrency(apiRow.current_price_eur, lang),
    changeLabel: formatPercentValue(apiRow.change_percent, lang, { showSign: true }),
    changePositive: Number(apiRow.change_percent || 0) >= 0,
    marketCapLabel: formatCompactCurrency(apiRow.market_cap_eur, lang),
    volumeLabel: formatPlainNumber(apiRow.volume, lang),
    peRatioLabel: formatPlainNumber(apiRow.pe_ratio, lang),
    epsLabel: formatCurrency(apiRow.eps, lang),
    high52Label: formatCurrency(apiRow.high_52, lang),
    low52Label: formatCurrency(apiRow.low_52, lang),
    dividendYieldLabel: formatPercentValue(apiRow.dividend_yield, lang),
    shareholders,
  };
}
