import { SEED, V3_TO_SLUG } from '../../functions/empresa/_ibex35.js';
import { entityNameKey, stripRegistryOffice } from './companyName';

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

/**
 * Every EXACT name under which one seed entity may be printed: its registered
 * v3 name and its brand, both reduced to the shared entity key (legal form
 * canonicalized, accents/punctuation folded). Deliberately a fixed set of
 * WHOLE names — never a prefix, substring or token reordering.
 *
 * `nameKey(seed.name)` is kept alongside `entityNameKey(seed.name)` because the
 * two agree for plain ASCII brands and the second is what rescues an accented
 * brand ("Enagás" -> "ENAGAS"), which a raw nameKey could never match.
 */
const LISTED_KEY_TO_SLUG = (() => {
  const map = {};
  Object.entries(SEED).forEach(([slug, seed]) => {
    [
      entityNameKey(seed.v3Name),
      nameKey(seed.name),
      entityNameKey(seed.name),
    ].forEach(key => {
      if (key && !(key in map)) map[key] = slug;
    });
  });
  return map;
})();

/**
 * Resolve a raw registry name — a company name OR an officer/cargo spelling —
 * to its curated IBEX 35 seed entry, by EXACT whole-name equality only.
 *
 * The reason this exists next to matchIbexSeed: BORME prints a corporate
 * officer under whatever spelling the filing used, and a filing may omit the
 * legal form entirely ("BANCO SANTANDER" as APODERADO of BANCO DE VASCONIA SA,
 * 2009). matchIbexSeed only knows the registered v3 name, so that officer reads
 * as a PERSON — person icon, no company affordances, its own graph node.
 *
 * SAFETY (binding): only the 35 curated entities can ever match, and only on a
 * whole name. A person whose surname is a brand ("GRIFOLS ROURA VICTOR",
 * "PUIG LOPEZ MARIA") keys differently and stays a person; an unrelated
 * company and its founder ("LUIS SANCHEZ SL" / "LUIS SANCHEZ") are untouched
 * because neither is in the seed. There is no lookup against the companies
 * index, so no name outside this list can ever be reclassified.
 *
 * @param {string} name
 * @returns {(object & {slug: string, groupKey: string}) | null} the seed entry,
 *   plus its slug and the "H:<hoja>" group key of its canonical doc, or null.
 */
export function listedEntityForName(name) {
  if (!name) return null;
  // A live graph name can carry a trailing "(R.M. …)" office annotation that the
  // seed's v3Name never does; strip it first (entityNameKey would otherwise fold
  // the annotation into the key and never match).
  const key = entityNameKey(stripRegistryOffice(String(name)));
  if (!key) return null;
  const slug = LISTED_KEY_TO_SLUG[key];
  if (!slug) return null;
  const seed = SEED[slug];
  if (!seed) return null;
  return { ...seed, slug, groupKey: `H:${seed.hoja.replace(/\s+/g, '-')}` };
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

/**
 * Ensure every curated IBEX 35 seed entity whose brand name (e.g. "Inditex")
 * the (folded) query is a prefix of — either of the brand as a whole, or of
 * any of its whitespace-separated words (e.g. "santander" prefixes the
 * second word of "Banco Santander") — appears FIRST in the returned list.
 * The listed entity (e.g. "INDUSTRIA DE DISEÑO TEXTIL, S.A.") never surfaces
 * on its own because its registered name doesn't contain the brand people
 * search for, and a raw suggestion payload is capped downstream (the graph
 * autocomplete slices to the first 14 company results) — so the seed's
 * doc must lead, never just be *present somewhere* in the list. A
 * word-internal substring that is not a prefix of that word ("tander") does
 * not match.
 *
 * Dedup is by id/groupKey ONLY — never by name. A suggestion whose name
 * happens to match the seed's registered name but carries a different id
 * (e.g. a name-keyed owner/officer record, as opposed to the seed's own
 * `H:<hoja>` document) is a different record and is left in place, not
 * treated as a stand-in for the listed entity. When a suggestion with the
 * seed's own id/groupKey IS already present, it is PROMOTED to the front
 * (a new object with `listed: true` added, original never mutated) instead
 * of adding a synthetic twin; otherwise a synthetic entry is prepended, as
 * before. Multiple brands can match one query (e.g. "banco" matches both
 * Banco Santander and Banco Sabadell) — all are pinned/promoted, in seed
 * declaration order. Pure: never mutates `suggestions`; returns the SAME
 * array reference when no seed brand matches the query.
 * @param {string} query
 * @param {Array<object>} suggestions
 * @returns {Array<object>}
 */
export function pinListedEntities(query, suggestions) {
  const list = Array.isArray(suggestions) ? suggestions : [];
  const folded = foldForBrandMatch(query);
  if (folded.length < MIN_BRAND_QUERY_LENGTH) return list;

  const matchedSeeds = Object.values(SEED).filter(seed => {
    const brandFolded = foldForBrandMatch(seed.name);
    const brandWords = brandFolded.split(/\s+/).filter(Boolean);
    return brandFolded.startsWith(folded) || brandWords.some(word => word.startsWith(folded));
  });
  if (matchedSeeds.length === 0) return list;

  const promotedIndices = new Set();
  const fronts = matchedSeeds.map(seed => {
    const id = `H:${seed.hoja.replace(/\s+/g, '-')}`;
    const existingIndex = list.findIndex(s => s && (s.id === id || s.groupKey === id));
    if (existingIndex !== -1) {
      promotedIndices.add(existingIndex);
      return { ...list[existingIndex], listed: true };
    }
    return {
      name: seed.v3Name,
      label: seed.v3Name,
      display_name: seed.v3Name,
      id,
      groupKey: id,
      type: 'company',
      source: 'ibex_seed',
      listed: true,
    };
  });

  const rest = list.filter((_, idx) => !promotedIndices.has(idx));
  return [...fronts, ...rest];
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
  // listedEntityForName, not matchIbexSeed: the badge must also appear on the
  // suffix-less officer spelling of a listed entity ("BANCO SANTANDER"), which
  // the registered-name-only lookup does not recognize.
  const match = listedEntityForName(companyName);
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
