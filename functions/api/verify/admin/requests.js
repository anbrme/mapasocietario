/**
 * GET  /api/verify/admin/requests?status=   - the inbound queue.
 * POST /api/verify/admin/requests           - set a row's status and note.
 *
 * A request is a LEAD. Nothing here issues a token: converting one means the
 * operator resolves the company and goes through /api/verify/admin/invite,
 * which still demands representation_basis, identification_note and
 * email_domain_basis by hand.
 */
import { requireAdmin, jsonResponse } from '../_db.js';

const STATUSES = ['new', 'contacted', 'invited', 'ineligible', 'declined', 'spam'];
const DEFAULT_LIMIT = 100;

export async function onRequestGet({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const status = (new URL(request.url).searchParams.get('status') || '').trim();
  const filtered = STATUSES.includes(status);

  const { results } = await (filtered
    ? env.VERIFY_DB.prepare(
        `SELECT * FROM verification_requests WHERE status = ?
          ORDER BY created_at DESC LIMIT ?`).bind(status, DEFAULT_LIMIT)
    : env.VERIFY_DB.prepare(
        `SELECT * FROM verification_requests
          ORDER BY created_at DESC LIMIT ?`).bind(DEFAULT_LIMIT)).all();

  return jsonResponse({ ok: true, count: (results || []).length, items: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!requireAdmin(request, env)) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: 'invalid_json' }, 400); }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const status = typeof body.status === 'string' ? body.status : '';
  if (!id) return jsonResponse({ ok: false, error: 'id_required' }, 400);
  if (!STATUSES.includes(status)) {
    return jsonResponse({ ok: false, error: 'invalid_status', allowed: STATUSES }, 400);
  }

  const note = typeof body.operator_note === 'string' ? body.operator_note.trim() : null;
  const res = await env.VERIFY_DB.prepare(
    `UPDATE verification_requests SET status = ?, operator_note = ?, updated_at = ?
      WHERE id = ?`).bind(status, note, new Date().toISOString(), id).run();

  // The row count is checked: a mistyped id matched nothing and the operator
  // would otherwise be told the request was filed.
  if (!res?.meta?.changes) return jsonResponse({ ok: false, error: 'not_found' }, 404);
  return jsonResponse({ ok: true, id, status });
}
