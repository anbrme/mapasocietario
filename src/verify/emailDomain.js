/**
 * Is this address on a corporate domain?
 *
 * A NEGATIVE check, and the distinction is the whole point: it establishes that
 * an address is not a KNOWN CONSUMER MAILBOX. It establishes nothing whatsoever
 * about affiliation with any company - anyone can buy a domain in minutes. It
 * therefore does NOT satisfy `email_domain_basis`, which the operator still
 * records by hand, and no copy may present it as evidence of anything.
 *
 * It will also reject real companies: a large share of legitimate Spanish SLs
 * run on Gmail. That is why the rule is stated ABOVE the form and its rejection
 * carries a way through. It is a pilot rule, labelled as one, so relaxing it
 * later is a planned step rather than a climbdown.
 */

// Unambiguous consumer mailboxes only. A domain in doubt is left OUT: a false
// accept costs one row in a queue, a false reject costs a real lead.
// Exported so the public request page can run the SAME check as the user types.
// A second, hand-copied list on the client would drift, and the first symptom of
// the drift is exactly the thing the rule forbids: an address the form accepted
// being rejected at submit.
export const CONSUMER_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'outlook.es', 'hotmail.com', 'hotmail.es', 'hotmail.co.uk',
  'live.com', 'live.es', 'msn.com',
  'yahoo.com', 'yahoo.es', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'gmx.com', 'gmx.es', 'gmx.net', 'mail.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'yandex.com', 'yandex.ru', 'tutanota.com', 'zoho.com',
  // Spanish ISP mailboxes - the local equivalent of the list above.
  'terra.es', 'telefonica.net', 'wanadoo.es', 'ono.com', 'movistar.es',
  'orange.es', 'vodafone.es', 'euskaltel.net', 'telecable.es', 'ya.com',
  // Disposable: a SHORT list on purpose. Turnstile and operator review handle
  // the long tail, and chasing it is a losing game.
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'yopmail.com',
  'temp-mail.org', 'throwawaymail.com', 'sharklasers.com',
];

const CONSUMER = new Set(CONSUMER_DOMAINS);
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * 'invalid' | 'consumer' | 'corporate' - three outcomes, not two, so the form
 * can say WHICH thing is wrong. Telling a real company its address is malformed
 * when it is merely Gmail sends it chasing the wrong problem.
 */
export function classifyEmailDomain(email) {
  const value = String(email == null ? '' : email).trim().toLowerCase();
  if (!value || /\s/.test(value)) return 'invalid';

  const at = value.lastIndexOf('@');
  if (at < 1 || at === value.length - 1) return 'invalid';

  const domain = value.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return 'invalid';
  if (IPV4.test(domain) || domain.startsWith('[')) return 'invalid';

  if (CONSUMER.has(domain)) return 'consumer';
  // Only a DOT boundary counts as a subdomain, so "notgmail.com" stays
  // corporate while "foo.gmail.com" does not.
  for (const entry of CONSUMER_DOMAINS) {
    if (domain.endsWith(`.${entry}`)) return 'consumer';
  }
  return 'corporate';
}

export const isCorporateEmailDomain = (email) => classifyEmailDomain(email) === 'corporate';
