/**
 * Proves the two load-bearing VERIFY_DB constraints actually fire. They are SQL
 * guarantees, not JavaScript ones, so they are tested against a real local D1
 * rather than mocked:
 *
 *   attestations.invitation_id UNIQUE   the only thing stopping a replayed
 *     invitation link from creating a second attestation. A conditional
 *     "UPDATE ... WHERE used_at IS NULL" would NOT work: an update matching zero
 *     rows is a SUCCESSFUL statement in SQLite, and D1 rolls a batch back only
 *     when a statement FAILS.
 *
 *   idx_attestations_current            forces an approval to supersede
 *     whatever the incumbent is, so a stale record can never compete with its
 *     own successor.
 *
 * Skipped when no local D1 has been provisioned, so `npm test` stays green on a
 * clean checkout and in CI.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const DB = 'mapasocietario-verify';
const hasLocalD1 = existsSync('.wrangler/state/v3/d1');
const opts = { skip: hasLocalD1 ? false : 'no local D1 provisioned' };

function sql(command) {
  return execFileSync(
    'npx', ['wrangler', 'd1', 'execute', DB, '--local', '--command', command],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

function expectFailure(command, fragment) {
  try {
    sql(command);
    assert.fail(`expected failure containing "${fragment}"`);
  } catch (e) {
    if (e?.code === 'ERR_ASSERTION') throw e;
    const output = `${e.stdout || ''}${e.stderr || ''}${e.message}`;
    assert.match(output, new RegExp(fragment, 'i'));
  }
}

const attestation = (id, invitation, status) => `INSERT INTO attestations
  (id, subject_id, claimant_id, invitation_id, method, status, representation_basis,
   identity_snapshot, assertion_hash, registry_snapshot, sealed_key, sealed_hash,
   accepted_at, expires_at)
  VALUES ('${id}','s1','c1','${invitation}','email-confirmed','${status}','sole_admin',
   '{}','d1','{}','k','kh','2026-09-08T00:00:00Z','2027-03-07T00:00:00Z')`;

before(() => {
  if (!hasLocalD1) return;
  for (const t of ['attestation_facts', 'attestations', 'draft_assertions', 'invitations',
                   'claimants', 'subject_identifiers', 'subjects', 'audit_events']) {
    sql(`DELETE FROM ${t}`);
  }
  sql(`INSERT INTO subjects (subject_id, display_name) VALUES ('s1','Test SL')`);
  sql(`INSERT INTO claimants (id, subject_id, declared_name, email, claimed_role, email_domain_basis)
       VALUES ('c1','s1','A B','a@b.es','Administrador unico','website')`);
  sql(`INSERT INTO invitations (id, token_hash, claimant_id, subject_id, expires_at)
       VALUES ('i1','h1','c1','s1','2030-01-01'), ('i2','h2','c1','s1','2030-01-01')`);
  sql(`INSERT INTO draft_assertions (hash, invitation_id, subject_id, canonical_json, registry_snapshot)
       VALUES ('d1','i1','s1','{}','{}')`);
});

test('a second attestation for the same invitation is refused', opts, () => {
  sql(attestation('a1', 'i1', 'pending_review'));
  expectFailure(attestation('a2', 'i1', 'pending_review'), 'UNIQUE constraint failed');
});

test('two CURRENT attestations for one subject are refused, whatever their status', opts, () => {
  sql(`UPDATE attestations SET status='live' WHERE id='a1'`);
  // 'outdated' is a current state too: approving a successor must supersede it.
  expectFailure(attestation('a3', 'i2', 'outdated'), 'UNIQUE constraint failed');
});

test('a superseded predecessor frees the slot for its successor', opts, () => {
  sql(`UPDATE attestations SET status='superseded' WHERE id='a1'`);
  sql(attestation('a4', 'i2', 'live'));
  const out = sql(`SELECT COUNT(*) AS n FROM attestations WHERE status='live'`);
  assert.match(out, /"n":\s*1/);
});

test('mancomunados is not an accepted representation basis', opts, () => {
  expectFailure(
    `UPDATE claimants SET representation_basis='joint_admin_pair' WHERE id='c1'`,
    'CHECK constraint failed');
});

test('the audit chain cannot fork on the same previous hash', opts, () => {
  sql(`INSERT INTO audit_events (action, actor, prev_hash, hash)
       VALUES ('created','operator','0','h_a')`);
  expectFailure(
    `INSERT INTO audit_events (action, actor, prev_hash, hash)
     VALUES ('created','operator','0','h_b')`,
    'UNIQUE constraint failed');
});
