/**
 * POST /feedback — receives the FeedbackWidget submission and emails it via
 * the Cloudflare Email Routing `send_email` binding (see wrangler.toml).
 * All validation/formatting logic lives in ../src/utils/feedbackSubmission.js
 * so it's covered by the vitest suite (vitest only scans src/**\/*.test.js).
 */
import { EmailMessage } from 'cloudflare:email';
import { validateFeedbackPayload, buildFeedbackEmail } from '../src/utils/feedbackSubmission.js';

const FEEDBACK_FROM = 'feedback@mapasocietario.es';
const FEEDBACK_TO = 'mapasocietario@ncdata.eu';

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const result = validateFeedbackPayload(body);

  if (!result.ok && result.reason === 'honeypot') {
    // Pretend success to whatever filled the honeypot — no email sent, and
    // no signal given that the check exists.
    return jsonResponse({ ok: true }, 200);
  }

  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.reason }, 400);
  }

  const { raw } = buildFeedbackEmail(result.payload, {
    from: FEEDBACK_FROM,
    to: FEEDBACK_TO,
    timestamp: new Date().toISOString(),
  });

  try {
    const message = new EmailMessage(FEEDBACK_FROM, FEEDBACK_TO, raw);
    await env.SEND_EMAIL.send(message);
  } catch (err) {
    console.error('[feedback] send failed:', err.message);
    return jsonResponse({ ok: false, error: 'send_failed' }, 502);
  }

  return jsonResponse({ ok: true }, 200);
}
