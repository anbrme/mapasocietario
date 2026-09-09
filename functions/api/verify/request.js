/**
 * POST /api/verify/request - a company asks to be verified.
 *
 * PUBLIC and unauthenticated, and the strongest thing it can cause is one row
 * in the operator's queue. It issues no token, creates no subject and sends the
 * requester nothing. The path to an invitation still runs through a person who
 * records representation_basis, identification_note and email_domain_basis by
 * hand.
 *
 * The success response is IDENTICAL for a real company, a fictional one and one
 * that already holds a live attestation: the form must never become an oracle
 * against a private pilot.
 *
 * All decision logic lives in src/verify/request.js where vitest reaches it;
 * this file moves data and sends one mail.
 */
import { validateRequestPayload, buildRequestEmail } from '../../../src/verify/request.js';
import { newId } from '../../../src/verify/ids.js';

// Not sensitive: visible in the dashboard URL and in `wrangler whoami`.
const CLOUDFLARE_ACCOUNT_ID = 'e0f6d4652827b154cc920fd53ed54101';
const MAIL_FROM = 'verificacion@ncdata.eu';
const MAIL_TO = 'mapasocietario@ncdata.eu';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/**
 * Fails CLOSED. A missing secret rejects the submission rather than waving it
 * through: an unprotected public write that degrades open silently is worse
 * than one that stops visibly.
 */
async function turnstilePassed(token, env, ip) {
  if (!env.VERIFY_TURNSTILE_SECRET || !token) return false;
  try {
    const form = new FormData();
    form.append('secret', env.VERIFY_TURNSTILE_SECRET);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const res = await fetch(SITEVERIFY, { method: 'POST', body: form,
                                          signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return data.success === true;
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const result = validateRequestPayload(body);

  // Pretend success, write nothing, send nothing - and give no signal that the
  // check exists. Checked BEFORE Turnstile so a bot cannot distinguish the two.
  if (!result.ok && result.reason === 'honeypot') return json({ ok: true }, 200);

  if (!result.ok) {
    return json({ ok: false, error: result.reason, field: result.field || null }, 400);
  }

  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!(await turnstilePassed(body?.turnstileToken, env, ip))) {
    return json({ ok: false, error: 'turnstile_failed' }, 400);
  }

  const id = newId('req');
  const p = result.payload;

  try {
    await env.VERIFY_DB.prepare(
      `INSERT INTO verification_requests
        (id, company_query, nif, contact_name, contact_role, contact_email,
         referrer_note, note)
       VALUES (?,?,?,?,?,?,?,?)`)
      .bind(id, p.company_query, p.nif, p.contact_name, p.contact_role,
            p.contact_email, p.referrer_note, p.note).run();
  } catch (e) {
    console.error('[verify-request] insert failed:', e.message);
    return json({ ok: false, error: 'store_failed' }, 502);
  }

  // Best-effort. The row is the record; losing the notification costs the
  // operator a console visit, losing the lead costs the pilot a company.
  try {
    const mail = buildRequestEmail(p, {
      from: MAIL_FROM, to: MAIL_TO, timestamp: new Date().toISOString(), id,
    });
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
      { method: 'POST',
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
                   'Content-Type': 'application/json' },
        body: JSON.stringify(mail) });
    if (!res.ok) console.error('[verify-request] mail failed:', res.status, await res.text());
  } catch (e) {
    console.error('[verify-request] mail failed:', e.message);
  }

  // Says nothing about the company. Never "found", never "already verified".
  return json({ ok: true }, 200);
}
