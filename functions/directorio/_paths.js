/**
 * Directory hub URL paths, per language.
 *
 * Its own module, with NO imports, on purpose: functions/empresa/_siblings.js
 * needs these to point an EN company page at the EN hub, and _siblings.js is
 * imported by functions/empresa/_lib.js, which functions/directorio/_lib.js
 * imports for HUB_STYLE. Putting the paths in directorio/_lib.js would close
 * that loop into an import cycle and leave HUB_STYLE in the temporal dead zone
 * on whichever module loaded second.
 *
 * The province slug is the SAME in both languages — provinces are proper nouns,
 * so "Madrid" needs no translation and the slug itself is the hreflang pair.
 */

export const DIRECTORY_LANGS = Object.freeze(['es', 'en']);

export function directoryPath(lang) {
  return lang === 'en' ? '/en/directory' : '/directorio';
}

export function provincePath(lang, slug) {
  return `${directoryPath(lang)}/${slug}`;
}
