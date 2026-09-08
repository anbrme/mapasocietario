import { describe, it, expect } from 'vitest';
import { GENESIS_HASH, buildAuditEvent, verifyChain } from './chain.js';

const base = { attestation_id: 'a1', subject_id: 's1', actor: 'operator', detail: null,
               public_summary: null, created_at: '2026-09-08T10:00:00Z' };

async function chainOf(actions) {
  const rows = [];
  let prev = GENESIS_HASH;
  for (const [i, action] of actions.entries()) {
    const row = await buildAuditEvent(prev, { ...base, action });
    rows.push({ ...row, seq: i + 1 });
    prev = row.hash;
  }
  return rows;
}

describe('buildAuditEvent', () => {
  it('links each event to the previous hash', async () => {
    const rows = await chainOf(['created', 'accepted']);
    expect(rows[0].prev_hash).toBe(GENESIS_HASH);
    expect(rows[1].prev_hash).toBe(rows[0].hash);
  });
  it('gives different hashes to different actions', async () => {
    const a = await buildAuditEvent(GENESIS_HASH, { ...base, action: 'created' });
    const b = await buildAuditEvent(GENESIS_HASH, { ...base, action: 'accepted' });
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('verifyChain', () => {
  it('accepts an untouched chain', async () => {
    expect(await verifyChain(await chainOf(['created', 'accepted', 'approved'])))
      .toEqual({ ok: true, brokenAtSeq: null });
  });
  it('accepts an empty chain', async () => {
    expect(await verifyChain([])).toEqual({ ok: true, brokenAtSeq: null });
  });
  it('detects a tampered MIDDLE row', async () => {
    const rows = await chainOf(['created', 'accepted', 'approved']);
    rows[1] = { ...rows[1], action: 'rejected' };
    expect(await verifyChain(rows)).toEqual({ ok: false, brokenAtSeq: 2 });
  });
  it('detects a removed row', async () => {
    const rows = await chainOf(['created', 'accepted', 'approved']);
    const { ok } = await verifyChain([rows[0], rows[2]]);
    expect(ok).toBe(false);
  });
});
