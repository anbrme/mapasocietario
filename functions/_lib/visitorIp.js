// Visitor address behind the Hetzner front (see memory: project_hetzner_front).
//
// Cloudflare sets CF-Connecting-IP to whoever connected to it. Since the site
// is fronted by Nginx on Hetzner, that is the front's own address for every
// visitor. Nginx overwrites X-Forwarded-For with the real visitor and adds a
// shared-secret header; only when that secret matches do we trust the
// forwarded address. Requests that reach Pages directly keep the Cloudflare
// value, so nobody can spoof an address by sending X-Forwarded-For themselves.

const FRONT_SECRET_HEADER = 'x-front-secret';

/** First hop of an X-Forwarded-For chain, or '' when absent. */
function firstForwardedHop(request) {
  const chain = request.headers.get('x-forwarded-for') || '';
  return chain.split(',')[0].trim();
}

function isFromTrustedFront(request, env) {
  const expected = env?.FRONT_SECRET;
  if (!expected) return false;
  return request.headers.get(FRONT_SECRET_HEADER) === expected;
}

/**
 * @param {Request} request
 * @param {{ FRONT_SECRET?: string }} env
 * @returns {string} the visitor's address, or '' when unknown
 */
export function visitorIp(request, env) {
  if (isFromTrustedFront(request, env)) {
    const forwarded = firstForwardedHop(request);
    if (forwarded) return forwarded;
  }
  return request.headers.get('cf-connecting-ip') || '';
}
