// Single source of truth for the datos.gob.es listing mention.
//
// On 2026-09-17 the Spanish Government's open data portal published Mapa
// Societario in its applications catalogue. The listing is a real, verifiable
// third-party reference, so it is stated once, in one wording, on every surface
// where a visitor is deciding whether to trust us with a purchase — and nowhere
// as a badge. The claim is inclusion in the catalogue, nothing more: the footer
// already says the service is not endorsed by the AEBOE, and this line must not
// contradict that.
//
// Kept free of JSX and of any browser or Node API so React components, the
// Cloudflare Pages Functions and the prerenderer can all import it.

export const OPEN_DATA_LISTING_URL = 'https://datos.gob.es/es/aplicaciones/mapa-societario';

export const OPEN_DATA_LISTING_COPY = {
  en: {
    prefix: 'Listed in the applications catalogue of ',
    linkText: 'datos.gob.es',
    suffix: ", the Spanish Government's open data portal.",
  },
  es: {
    prefix: 'Figura en el catálogo de aplicaciones de ',
    linkText: 'datos.gob.es',
    suffix: ', el portal de datos abiertos del Gobierno de España.',
  },
};

export function openDataListingCopy(lang = 'en') {
  return OPEN_DATA_LISTING_COPY[lang === 'es' ? 'es' : 'en'];
}

// Plain-text form, for tests and for any surface that cannot carry a link.
export function openDataListingText(lang = 'en') {
  const c = openDataListingCopy(lang);
  return `${c.prefix}${c.linkText}${c.suffix}`;
}

// HTML form for the server-rendered and static pages. The link text and URL
// are constants of ours, so no escaping is needed.
export function openDataListingHtml(lang = 'en') {
  const c = openDataListingCopy(lang);
  return `${c.prefix}<a href="${OPEN_DATA_LISTING_URL}" target="_blank" rel="noopener">${c.linkText}</a>${c.suffix}`;
}
