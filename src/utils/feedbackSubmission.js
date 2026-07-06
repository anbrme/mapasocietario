export const MAX_COMMENT_LENGTH = 2000;

const VALID_REACTIONS = ['bad', 'neutral', 'good'];

const REACTION_LABEL = {
  bad: '🙁 Not good',
  neutral: '😐 Neutral',
  good: '🙂 Good',
};

// Strips newlines and trims — used for any value that ends up inside a MIME
// header (Subject/From/To) or inline in a header-adjacent line, so a comment
// or page path can never inject an extra header/line into the raw message.
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

export function buildFeedbackEmail(payload, { from, to, timestamp }) {
  const reactionLabel = REACTION_LABEL[payload.reaction] || '(no reaction selected)';
  const subject = sanitizeLine(`Mapa Societario feedback (${payload.lang}) — ${reactionLabel}`);
  const body = [
    `Reaction: ${reactionLabel}`,
    `Language: ${payload.lang}`,
    `Page: ${sanitizeLine(payload.page) || '(unknown)'}`,
    `Time: ${timestamp}`,
    '',
    'Comment:',
    payload.comment || '(none)',
  ].join('\n');

  // Cloudflare's Email Routing send_email binding rejects raw MIME messages
  // without a Message-ID header. timestamp + a random component keeps this
  // unique even for two submissions arriving in the same millisecond.
  const messageId = `<${timestamp}-${Math.random().toString(36).slice(2)}@mapasocietario.es>`;

  const raw = [
    `From: ${sanitizeLine(from)}`,
    `To: ${sanitizeLine(to)}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');

  return { subject, body, raw };
}
