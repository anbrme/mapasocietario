// Build-time HTML for the homepage hero, injected into the prerendered #root
// by scripts/prerender.mjs so the first screen paints from HTML alone.
//
// Why this exists: the landing is a React SPA whose entry bundle is large.
// Before this, nothing visible painted until that bundle had downloaded and
// run — a blank frame of several seconds on a mid-range phone on 4G. This
// block mirrors the React hero (same copy, same geometry, styled by the
// `.ms-hero` rules in src/index.css) so the visitor sees the headline and a
// working search form immediately; React replaces the whole subtree on mount.
//
// The search form is real progressive enhancement: submitting it before the
// bundle arrives navigates to /app/?search=… which the workspace understands.
import {
  LANDING_HERO_COPY,
  LANDING_TOP_LINKS,
  LANDING_SEARCH_ACTION,
  LANDING_SEARCH_SOURCE,
  LANDING_SEARCH_MIN_LENGTH,
} from '../../src/copy/landingHero.js';

export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const navLinkHtml = (link) => {
  const classes = ['ms-hero__link', link.highlight ? 'ms-hero__link--highlight' : null]
    .filter(Boolean)
    .join(' ');
  return `<a class="${classes}" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`;
};

const navHtml = (lang, copy) => {
  const links = LANDING_TOP_LINKS[lang];
  const languageLink = links.find((link) => link.alignRight);
  const mainLinks = links.filter((link) => !link.alignRight);
  const languageHtml = languageLink
    ? `<a class="ms-hero__link ms-hero__lang" href="${escapeHtml(languageLink.href)}">${escapeHtml(languageLink.label)}</a>`
    : '';
  return `
    <nav class="ms-hero__nav" aria-label="${escapeHtml(copy.navLabel)}">
      <div class="ms-hero__links">${mainLinks.map(navLinkHtml).join('')}</div>
      ${languageHtml}
    </nav>`;
};

const searchFormHtml = (lang, copy) => {
  const langField = lang === 'es' ? '<input type="hidden" name="lang" value="es" />' : '';
  return `
        <form class="ms-hero__search" action="${LANDING_SEARCH_ACTION}" method="get" role="search">
          <input
            class="ms-hero__input"
            type="search"
            name="search"
            placeholder="${escapeHtml(copy.searchPlaceholder)}"
            aria-label="${escapeHtml(copy.searchPlaceholder)}"
            autocomplete="off"
            required
            minlength="${LANDING_SEARCH_MIN_LENGTH}"
          />
          ${langField}
          <input type="hidden" name="source" value="${LANDING_SEARCH_SOURCE}" />
          <button class="ms-hero__button" type="submit">${escapeHtml(copy.searchButton)}</button>
        </form>
        <p class="ms-hero__hint">${escapeHtml(copy.searchHint)}</p>`;
};

/**
 * @param {'en'|'es'} lang
 * @returns {string} HTML for the visible, pre-hydration homepage hero
 */
export function staticHeroHtml(lang = 'en') {
  const copy = LANDING_HERO_COPY[lang];
  if (!copy) throw new Error(`staticHeroHtml: no hero copy for lang "${lang}"`);
  return `
  <div class="ms-hero" lang="${lang}">
    ${navHtml(lang, copy)}
    <section class="ms-hero__section">
      <div class="ms-hero__grid">
        <div class="ms-hero__text">
          <p class="ms-hero__eyebrow">${escapeHtml(copy.eyebrow)}</p>
          <h1 class="ms-hero__h1">${escapeHtml(copy.h1)}</h1>
          <p class="ms-hero__subtitle">${escapeHtml(copy.subtitle)}</p>
          <p class="ms-hero__intro">${escapeHtml(copy.intro)}</p>
          ${searchFormHtml(lang, copy)}
        </div>
        <div class="ms-hero__demo" role="img" aria-label="${escapeHtml(copy.demoAlt)}"></div>
      </div>
    </section>
  </div>`;
}
