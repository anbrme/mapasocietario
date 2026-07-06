export const MAX_COMMENT_LENGTH = 2000;

const VALID_REACTIONS = ['bad', 'neutral', 'good'];

const REACTION_LABEL = {
  bad: '🙁 Not good',
  neutral: '😐 Neutral',
  good: '🙂 Good',
};

// Strips newlines and trims — general input normalization for values that
// render as a single display line (e.g. the page path shown in the email
// body). Cloudflare's Email Sending REST API takes structured JSON fields
// (subject/text), not a raw MIME string, so this is no longer a header-
// injection concern — just tidiness.
function sanitizeLine(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

export function validateFeedbackPayload(body) {
  const honeypot = typeof body?.honeypot === 'string' ? body.honeypot.trim() : '';
  if (honeypot) {
    return { ok: false, reason: 'honeypot' };
  }

  const reaction = VALID_REACTIONS.includes(body?.reaction) ? body.reaction : null;
  const comment = typeof body?.comment === 'string'
    ? body.comment.trim().slice(0, MAX_COMMENT_LENGTH)
    : '';
  const lang = body?.lang === 'es' ? 'es' : 'en';
  const page = sanitizeLine(body?.page).slice(0, 500);

  if (!reaction && !comment) {
    return { ok: false, reason: 'empty' };
  }

  return { ok: true, payload: { reaction, comment, lang, page } };
}

// Builds the request body for Cloudflare's Email Sending REST API
// (POST /accounts/{account_id}/email/sending/send) — see
// https://developers.cloudflare.com/api/resources/email_sending/methods/send.
// `from`/`to` are plain email address strings; the API accepts either a bare
// string or an `{ address, name }` object for `from` — we use the bare form
// since no display name is needed here.
export function buildFeedbackEmail(payload, { from, to, timestamp }) {
  const reactionLabel = REACTION_LABEL[payload.reaction] || '(no reaction selected)';
  const subject = sanitizeLine(`Mapa Societario feedback (${payload.lang}) — ${reactionLabel}`);
  const text = [
    `Reaction: ${reactionLabel}`,
    `Language: ${payload.lang}`,
    `Page: ${sanitizeLine(payload.page) || '(unknown)'}`,
    `Time: ${timestamp}`,
    '',
    'Comment:',
    payload.comment || '(none)',
  ].join('\n');

  return { to, from, subject, text };
}
