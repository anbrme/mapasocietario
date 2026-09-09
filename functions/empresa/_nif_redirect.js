import { nameToSlug } from './_slug.js';

const API_BASE = 'https://api.ncdata.eu';
const SITE = 'https://mapasocietario.es';

// Spanish legal-entity NIFs are nine characters and begin with a letter.
// Keep this route deliberately narrower than a general search endpoint: it is
// an integration permalink, not a fuzzy company resolver.
export function normalizeCompanyNif(value) {
  const nif = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9]{8}$/.test(nif) ? nif : null;
}

export function companyDestination(companyName, lang = 'es') {
  const slug = nameToSlug(companyName);
  if (!slug) return null;
  return lang === 'en'
    ? `${SITE}/en/company/${slug}`
    : `${SITE}/empresa/${slug}`;
}

function errorResponse(status, message) {
  return new Response(message, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, follow',
    },
  });
}

/**
 * Resolve a stable NIF permalink to the ordinary name-slug company page.
 *
 * The API declines ambiguous NIFs rather than choosing a company. The redirect
 * therefore remains exact while the destination slug is free to follow later
 * company-name changes.
 */
export async function handleNifRedirect(ctx, lang = 'es') {
  const nif = normalizeCompanyNif(ctx?.params?.nif);
  if (!nif) return errorResponse(404, 'Company not found');

  let response;
  try {
    response = await fetch(
      `${API_BASE}/bormes/company-by-nif?nif=${encodeURIComponent(nif)}`,
      { headers: { accept: 'application/json' } },
    );
  } catch {
    return errorResponse(502, 'Company lookup unavailable');
  }

  if (response.status === 404 || response.status === 409) {
    return errorResponse(404, 'Company not found');
  }
  if (!response.ok) return errorResponse(502, 'Company lookup unavailable');

  let payload;
  try {
    payload = await response.json();
  } catch {
    return errorResponse(502, 'Company lookup unavailable');
  }

  // Bind the response to the requested identifier. A malformed or mismatched
  // upstream response must never become a redirect to an unrelated company.
  if (payload?.success !== true || payload.nif !== nif) {
    return errorResponse(502, 'Company lookup unavailable');
  }
  const destination = companyDestination(payload.company_name, lang);
  if (!destination) return errorResponse(502, 'Company lookup unavailable');

  return new Response(null, {
    status: 302,
    headers: {
      location: destination,
      // A NIF is stable but the company name, and therefore its slug, can
      // change. Cache briefly and never make this a permanent redirect.
      'cache-control': 'public, max-age=3600',
      'x-robots-tag': 'noindex, follow',
    },
  });
}
