/**
 * The public/internal reviewer-name asymmetry (spec section 8) has three
 * guards on the public half (projection.test.js). This is the internal half's
 * only guard: an approval must always bind a reviewer's name into the
 * attestation update, even though that name is later redacted for the public
 * projection (src/verify/projection.js). Without this test a "consistency"
 * cleanup could quietly drop the requirement and no test would notice.
 */
import { describe, it, expect } from 'vitest';
import { onRequestPost } from './decide.js';
import { sha256Hex } from '../../../../src/verify/hash.js';

const req = (body, token = 'secret') =>
  new Request('https://x/api/verify/admin/decide', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

// A statement built by prepare()/bind() that just records its own sql + args;
// nothing runs it individually, `batch()` on the fake VERIFY_DB does.
function fakeStatement(sql, args = []) {
  return {
    sql,
    args,
    bind: (...bindArgs) => fakeStatement(sql, bindArgs),
    first: async () => null,
  };
}

// A minimal fake D1 binding that answers the two SELECTs decide.js and
// batchWithAudit issue (the attestation row, and the audit chain head) and
// records every batch() call so a test can inspect what would have been
// written.
function fakeDb({ attestation, auditHead = null }) {
  const batches = [];
  return {
    batches,
    prepare(sql) {
      if (/FROM attestations WHERE id/.test(sql)) {
        return { ...fakeStatement(sql), bind: (...args) => ({
          ...fakeStatement(sql, args),
          first: async () => attestation,
        }) };
      }
      if (/FROM audit_events ORDER BY seq/.test(sql)) {
        return { ...fakeStatement(sql), first: async () => auditHead };
      }
      return fakeStatement(sql);
    },
    batch: async (statements) => {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
}

function fakeEvidence(contents) {
  return {
    get: async (key) => {
      if (!(key in contents)) return null;
      const text = contents[key];
      return { text: async () => text };
    },
  };
}

describe('POST /api/verify/admin/decide', () => {
  it('rejects an approval with no reviewer', async () => {
    const r = await onRequestPost({
      request: req({ attestation_id: 'att_1', decision: 'approve' }),
      env: { VERIFY_ADMIN_TOKEN: 'secret' },
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('reviewer_required');
  });

  it('binds the individual reviewer name into the attestation update on approval', async () => {
    const sealedText = 'sealed-evidence-body';
    const personalText = 'personal-evidence-body';
    const attestation = {
      id: 'att_1',
      subject_id: 'sub_1',
      status: 'pending_review',
      accepted_at: '2026-09-01T00:00:00Z',
      sealed_key: 'sealed/att_1',
      sealed_hash: await sha256Hex(sealedText),
      personal_key: 'personal/att_1',
      personal_hash: await sha256Hex(personalText),
    };
    const db = fakeDb({ attestation });
    const env = {
      VERIFY_ADMIN_TOKEN: 'secret',
      VERIFY_DB: db,
      VERIFY_EVIDENCE: fakeEvidence({
        'sealed/att_1': sealedText,
        'personal/att_1': personalText,
      }),
    };

    const r = await onRequestPost({
      request: req({
        attestation_id: 'att_1', decision: 'approve', reviewer: 'Ana Reviewer', note: 'looks right',
      }),
      env,
    });

    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe('live');

    // One batch call: [supersede-others, approve-this, audit-event].
    expect(db.batches).toHaveLength(1);
    const approveStatement = db.batches[0].find((s) =>
      /SET status='live'/.test(s.sql));
    expect(approveStatement).toBeTruthy();
    // bind(now, reviewer, now, note || null, attestationId)
    expect(approveStatement.args[1]).toBe('Ana Reviewer');
    expect(approveStatement.args[4]).toBe('att_1');
  });
});
