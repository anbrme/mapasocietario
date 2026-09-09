/**
 * The preview banner.
 *
 * A screenshot of a preview must not be mistakable for the live page, so the
 * banner is non-dismissable and sits above everything. It is injected into the
 * rendered HTML rather than threaded through renderCompanyPage(), which already
 * takes eleven positional parameters: the banner is preview-only chrome, not
 * part of the page.
 */
import { grantState } from './grant.js';

const COPY = {
  es: {
    title: 'Vista previa',
    body: 'Así se verá la insignia en su página pública. Esta insignia todavía no es pública: solo usted, con este enlace, la está viendo.',
  },
  en: {
    title: 'Preview',
    body: 'This is how the badge will look on your public page. The badge is not public yet: only you, with this link, can see it.',
  },
};

export function previewBanner(lang = 'es') {
  const t = COPY[lang] || COPY.es;
  return `<div class="vp-banner" role="status" style="position:sticky;top:0;z-index:9999;`
    + `background:#b45309;color:#fff;padding:.7rem 1rem;font:600 14px/1.4 system-ui,sans-serif">`
    + `<strong>${t.title}</strong> — ${t.body}</div>`;
}

/**
 * Every condition that must produce a 404, in one place so it can be tested.
 * Unknown, expired, revoked, wrong kind and not-publishable are deliberately
 * indistinguishable to the caller: a distinct response would confirm which of
 * them was true, and therefore that the record exists. A rendered page can
 * also come back as handleCompany's own not-found; that path is header-safe
 * via notFoundPageHeaders, but it does not pass through here.
 */
export const PREVIEWABLE_STATUSES = ['live', 'outdated'];

export function previewGrantAllows(grant, attestation, nowMs = Date.now()) {
  if (grantState(grant, nowMs) !== 'valid') return false;
  // A counterparty token addresses /verificacion/g/ and nothing else.
  if (grant.kind !== 'preview') return false;
  // Only these render a badge on a company page (see _attestation.js), so
  // previewing anything else would show a company a badge it will never get.
  return Boolean(attestation) && PREVIEWABLE_STATUSES.includes(attestation.status);
}

const BODY_OPEN = /<body\b[^>]*>/i;

export function insertPreviewBanner(html, lang = 'es') {
  const banner = previewBanner(lang);
  const match = html.match(BODY_OPEN);
  // No body tag means we were handed something unexpected. Prepending still
  // shows the banner, which is the property that matters: a preview must never
  // render silently as if it were the live page.
  if (!match) return banner + html;
  const at = match.index + match[0].length;
  return html.slice(0, at) + banner + html.slice(at);
}
