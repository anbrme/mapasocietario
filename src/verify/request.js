/**
 * Validation and formatting for an inbound verification request.
 *
 * A request GRANTS NOTHING - it is a lead in the operator's queue. The path to
 * an invitation runs through a person who records representation_basis,
 * identification_note and email_domain_basis by hand, none of which the system
 * can infer. Keep it that way.
 *
 * Lives here rather than in the Function so vitest can reach it, matching the
 * split used by the rest of src/verify/.
 */
import { classifyEmailDomain } from './emailDomain.js';

export const MAX = {
  company_query: 200,
  nif: 20,
  contact_name: 120,
  contact_role: 120,
  contact_email: 254,   // RFC 5321 maximum path length
  referrer_note: 500,
  note: 2000,
};

const REQUIRED = ['company_query', 'contact_name', 'contact_role', 'contact_email'];

// Single-line fields render into an email subject and an operator table, so a
// newline in them is noise at best.
const line = (v) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim();

export function validateRequestPayload(body) {
  // The honeypot is checked FIRST and reported alone: a bot that also omitted
  // required fields must learn nothing from which complaint comes back.
  if (line(body?.website)) return { ok: false, reason: 'honeypot' };

  const payload = {
    company_query: line(body?.company_query).slice(0, MAX.company_query),
    nif: line(body?.nif).slice(0, MAX.nif).toUpperCase() || null,
    contact_name: line(body?.contact_name).slice(0, MAX.contact_name),
    contact_role: line(body?.contact_role).slice(0, MAX.contact_role),
    contact_email: line(body?.contact_email).slice(0, MAX.contact_email).toLowerCase(),
    referrer_note: line(body?.referrer_note).slice(0, MAX.referrer_note) || null,
    // The only multi-line field: a note may legitimately have paragraphs.
    note: String(body?.note == null ? '' : body.note).trim().slice(0, MAX.note) || null,
  };

  for (const field of REQUIRED) {
    if (!payload[field]) return { ok: false, reason: `${field}_required`, field };
  }

  const domain = classifyEmailDomain(payload.contact_email);
  if (domain === 'invalid') {
    return { ok: false, reason: 'contact_email_invalid', field: 'contact_email' };
  }
  if (domain === 'consumer') {
    return { ok: false, reason: 'contact_email_not_corporate', field: 'contact_email' };
  }

  return { ok: true, payload };
}

/**
 * The operator notification. Mirrors buildFeedbackEmail's shape for
 * Cloudflare's Email Sending REST API: plain `from`/`to` strings, a subject and
 * a text body.
 */
export function buildRequestEmail(payload, { from, to, timestamp, id }) {
  const subject = line(`Solicitud de verificación — ${payload.company_query}`);
  const text = [
    `Empresa:   ${payload.company_query}`,
    `NIF:       ${payload.nif || '(no indicado)'}`,
    `Contacto:  ${payload.contact_name} — ${payload.contact_role}`,
    `Correo:    ${payload.contact_email}`,
    `Se lo pidió: ${payload.referrer_note || '(no indicado)'}`,
    `Recibida:  ${timestamp}`,
    `Id:        ${id}`,
    '',
    'Nota:',
    payload.note || '(ninguna)',
    '',
    'Esto es una SOLICITUD, no una invitación. Nadie ha recibido ningún enlace.',
    'Resuelva la empresa y emita la invitación desde /admin/verificacion.',
  ].join('\n');

  return { to, from, subject, text };
}

// Only spam and ineligible rows are purged. A request that became an invitation
// is retained under the attestation record's terms (spec section 9 of the pilot
// design), because it is then part of that record's provenance.
export const REQUEST_RETENTION_DAYS = 90;

export const requestRetentionCutoff = (nowMs = Date.now()) =>
  new Date(nowMs - REQUEST_RETENTION_DAYS * 86_400_000).toISOString();
