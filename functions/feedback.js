/**
 * POST /feedback — receives the FeedbackWidget submission and emails it via
 * Cloudflare's Email Sending REST API (Cloudflare Pages projects cannot use
 * the `send_email` Workers binding — its wrangler.toml config validation
 * rejects it outright for Pages). All validation/formatting logic lives in
 * ../src/utils/feedbackSubmission.js so it's covered by the vitest suite
 * (vitest only scans src/**\/*.test.js).
 *
 * Requires one Pages project secret (set via the Cloudflare dashboard, not
 * committed to wrangler.toml): CLOUDFLARE_EMAIL_API_TOKEN — an API token
 * scoped to "Email Sending: Edit". The account ID is not sensitive (visible
 * in the dashboard URL and `wrangler whoami`), so it's inlined below.
 */
import { validateFeedbackPayload, buildFeedbackEmail } from '../src/utils/feedbackSubmission.js';

const CLOUDFLARE_ACCOUNT_ID = 'e0f6d4652827b154cc920fd53ed54101';
const FEEDBACK_FROM = 'feedback@ncdata.eu';
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

  const emailPayload = buildFeedbackEmail(result.payload, {
    from: FEEDBACK_FROM,
    to: FEEDBACK_TO,
    timestamp: new Date().toISOString(),
  });

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[feedback] send failed:', res.status, errBody);
      return jsonResponse({ ok: false, error: 'send_failed' }, 502);
    }
  } catch (err) {
    console.error('[feedback] send failed:', err.message);
    return jsonResponse({ ok: false, error: 'send_failed' }, 502);
  }

  return jsonResponse({ ok: true }, 200);
}
