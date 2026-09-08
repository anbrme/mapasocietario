/**
 * POST /api/verify/invite — the operator issues one invitation.
 *
 * Two refusals are deliberate. It will not invite someone the registry does not
 * place in the company (matchSeat must hit). And it will not accept a joint
 * administrator: mancomunados must act together, so a single signature would
 * misstate LSC art. 233 — the pilot refuses them by name rather than
 * approximating (spec section 4.3).
 *
 * representation_basis and identification_note are operator judgements the
 * system cannot infer, and both are mandatory: an undocumented identification
 * is worse than a weak one.
 */
import { matchSeat } from '../../../src/verify/seat.js';
import { newId, newToken, tokenHash } from '../../../src/verify/ids.js';
import { requireAdmin, fetchCompanyByGroupKey, auditStatement, jsonResponse } from './_db.js';

const BASES = new Set(['sole_admin', 'joint_several_admin', 'delegated_board_member', 'apoderado']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_HOURS = 72;  // a compliance officer will not click within the hour

const text = (v) => (typeof v === 'string' ? v.trim() : '');

export function validateInvitePayload(body) {
  const b = body || {};
  const value = {
    group_key: text(b.group_key),
    declared_name: text(b.declared_name),
    email: text(b.email).toLowerCase(),
    claimed_role: text(b.claimed_role),
    representation_basis: text(b.representation_basis),
    identification_note: text(b.identification_note),
    email_domain_basis: text(b.email_domain_basis),
  };
  if (!value.group_key) return { ok: false, reason: 'missing_group_key' };
  if (!value.declared_name) return { ok: false, reason: 'missing_declared_name' };
  if (!EMAIL_RE.test(value.email)) return { ok: false, reason: 'invalid_email' };
  if (!value.claimed_role) return { ok: false, reason: 'missing_claimed_role' };
  if (value.representation_basis === 'joint_admin_pair') {
    return { ok: false, reason: 'joint_administrators_excluded' };
  }
  if (!BASES.has(value.representation_basis)) {
    return { ok: false, reason: 'invalid_representation_basis' };
  }
  if (!value.identification_note) return { ok: false, reason: 'missing_identification_note' };
  if (!value.email_domain_basis) return { ok: false, reason: 'missing_email_domain_basis' };
  return { ok: true, value };
}

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const parsed = validateInvitePayload(body);
  if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.reason }, 400);
  const v = parsed.value;

  let company;
  try { company = await fetchCompanyByGroupKey(v.group_key, env); }
  catch (e) { return jsonResponse({ ok: false, error: e.message }, 502); }

  const seat = matchSeat(v.declared_name, company.officers_active);
  if (!seat) {
    // The officer list comes back so the operator can see whether this is a
    // spelling difference or genuinely the wrong person.
    return jsonResponse({
      ok: false, error: 'no_matching_officer_seat',
      officers: (company.officers_active || []).map((o) => o.name || o.name_normalized),
    }, 422);
  }

  const existing = await env.VERIFY_DB.prepare(
    `SELECT subject_id FROM subject_identifiers
      WHERE kind = 'group_key' AND value = ? AND valid_to IS NULL`).bind(v.group_key).first();

  const subjectId = existing ? existing.subject_id : newId('sub');
  const claimantId = newId('clm');
  const invitationId = newId('inv');
  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600_000).toISOString();

  const statements = [];
  if (!existing) {
    statements.push(
      env.VERIFY_DB.prepare('INSERT INTO subjects (subject_id, display_name) VALUES (?,?)')
        .bind(subjectId, company.company_name),
      env.VERIFY_DB.prepare(
        `INSERT INTO subject_identifiers (subject_id, kind, value) VALUES (?,'group_key',?)`)
        .bind(subjectId, v.group_key),
    );
    const nif = company.nif || company.enriched_nif;
    if (nif) {
      statements.push(env.VERIFY_DB.prepare(
        `INSERT INTO subject_identifiers (subject_id, kind, value) VALUES (?,'nif',?)`)
        .bind(subjectId, nif));
    }
    for (const hoja of company.hojas || []) {
      statements.push(env.VERIFY_DB.prepare(
        `INSERT INTO subject_identifiers (subject_id, kind, value) VALUES (?,'hoja',?)`)
        .bind(subjectId, hoja));
    }
  }

  statements.push(
    env.VERIFY_DB.prepare(
      `INSERT INTO claimants (id, subject_id, declared_name, email, claimed_role,
        representation_basis, identification_note, email_domain_basis, role)
       VALUES (?,?,?,?,?,?,?,?,'attester')`)
      .bind(claimantId, subjectId, v.declared_name, v.email, v.claimed_role,
            v.representation_basis, v.identification_note, v.email_domain_basis),
    env.VERIFY_DB.prepare(
      `INSERT INTO invitations (id, token_hash, claimant_id, subject_id, expires_at)
       VALUES (?,?,?,?,?)`)
      .bind(invitationId, await tokenHash(token), claimantId, subjectId, expiresAt),
    await auditStatement(env, {
      subject_id: subjectId, action: 'invitation_issued', actor: 'operator',
      detail: JSON.stringify({ claimant_id: claimantId, seat, basis: v.representation_basis }),
      public_summary: null,
    }),
  );

  await env.VERIFY_DB.batch(statements);

  // The token is returned ONCE, to the operator. Only its hash is stored.
  return jsonResponse({
    ok: true, subject_id: subjectId, invitation_id: invitationId, seat,
    confirm_url: `https://mapasocietario.es/verificacion/confirmar?t=${token}`,
    expires_at: expiresAt,
  });
}
