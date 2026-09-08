/**
 * Tamper-EVIDENT audit chain. Each event commits to its predecessor's hash, so
 * rewriting any row invalidates every hash after it. This does NOT make the log
 * immutable — whoever holds database access can rewrite rows and recompute the
 * chain. Its value comes from the daily head being checkpointed off-system.
 * Never describe the result as immutable (spec section 4.2).
 */
import { canonicalJson, sha256Hex } from './hash.js';

export const GENESIS_HASH = '0'.repeat(64);

// Only these fields are committed to. `seq` is excluded on purpose: it is
// assigned by the database after the hash is computed.
const COMMITTED = ['attestation_id', 'subject_id', 'action', 'actor',
                   'detail', 'public_summary', 'created_at'];

const payload = (event) =>
  Object.fromEntries(COMMITTED.map((k) => [k, event[k] === undefined ? null : event[k]]));

export async function buildAuditEvent(prevHash, event) {
  const hash = await sha256Hex(`${prevHash}|${canonicalJson(payload(event))}`);
  return { ...event, prev_hash: prevHash, hash };
}

// Rows must arrive in ascending seq order.
export async function verifyChain(rows) {
  let prev = GENESIS_HASH;
  for (const row of rows) {
    if (row.prev_hash !== prev) return { ok: false, brokenAtSeq: row.seq ?? null };
    const expected = await sha256Hex(`${prev}|${canonicalJson(payload(row))}`);
    if (expected !== row.hash) return { ok: false, brokenAtSeq: row.seq ?? null };
    prev = row.hash;
  }
  return { ok: true, brokenAtSeq: null };
}
