/**
 * Daily reconciliation of live attestations against BORME.
 *
 * This is the job that lets a published statement die on its own. Without it a
 * badge stands until a human notices, which is precisely the failure the whole
 * product exists to prevent.
 *
 * It lives in a Worker rather than a Pages Function because Pages Functions have
 * no scheduled handler.
 *
 * All classification logic is in src/verify/reconcile.js, where vitest can reach
 * it; this file moves data and sends mail.
 */
import { checkFact, nextStatus, isExpired, buildRunRow, runRetentionCutoff, RUN_RETENTION_DAYS }
  from '../../../src/verify/reconcile.js';
import { buildAuditEvent, GENESIS_HASH } from '../../../src/verify/chain.js';

// Every state an attestation can be in and still be the CURRENT record for its
// subject. Scanning only 'live' would mean nothing could ever recover or expire
// once it left that state.
const CURRENT = ['live', 'outdated', 'under_review', 'disputed'];
const RECONFIRM_NUDGE_DAYS = 75;

async function fetchJson(url, env) {
  const r = await fetch(url, { headers: { 'X-Internal-Key': env.INTERNAL_API_KEY } });
  if (!r.ok) throw new Error(`upstream_${r.status}`);
  return r.json();
}

async function appendAudit(env, event) {
  const head = await env.VERIFY_DB
    .prepare('SELECT hash FROM audit_events ORDER BY seq DESC LIMIT 1').first();
  const row = await buildAuditEvent(head ? head.hash : GENESIS_HASH, {
    created_at: new Date().toISOString(), ...event,
  });
  return env.VERIFY_DB.prepare(
    `INSERT INTO audit_events
      (attestation_id, subject_id, action, actor, detail, public_summary, created_at, prev_hash, hash)
     VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(row.attestation_id ?? null, row.subject_id ?? null, row.action, row.actor,
          row.detail ?? null, row.public_summary ?? null, row.created_at, row.prev_hash, row.hash);
}

const PUBLIC_SUMMARY = {
  outdated: 'A later registry event moved past this statement',
  disputed: 'Placed under review: registry evidence appears to contradict this statement',
  under_review: 'A verification check could not be completed',
  live: 'Checks resumed and the statement is consistent with the registry',
  expired: 'The statement passed its stated validity period',
};

async function reconcileOne(env, attestation, report) {
  const { results: facts } = await env.VERIFY_DB
    .prepare('SELECT * FROM attestation_facts WHERE attestation_id = ? ORDER BY id')
    .bind(attestation.id).all();

  // Expiry is a clock, not a check, and it wins over everything.
  if (isExpired(attestation.expires_at)) {
    if (attestation.status !== 'expired') {
      await env.VERIFY_DB.batch([
        env.VERIFY_DB.prepare(
          `UPDATE attestations SET status='expired', status_reason=? WHERE id = ?`)
          .bind('The statement passed its stated validity period.', attestation.id),
        await appendAudit(env, {
          attestation_id: attestation.id, subject_id: attestation.subject_id,
          action: 'expired', actor: 'reconciler', detail: null,
          public_summary: PUBLIC_SUMMARY.expired,
        }),
      ]);
      report.changed.push({ id: attestation.id, from: attestation.status, to: 'expired' });
    }
    return;
  }

  const groupKeyRow = await env.VERIFY_DB.prepare(
    `SELECT value FROM subject_identifiers
      WHERE subject_id = ? AND kind='group_key' AND valid_to IS NULL
      ORDER BY id DESC LIMIT 1`).bind(attestation.subject_id).first();

  let company = null;
  let events = [];
  let sourceFailed = false;
  try {
    if (!groupKeyRow) throw new Error('subject_unresolved');
    const c = await fetchJson(
      `${env.API_BASE}/bormes/v3/company?group_key=${encodeURIComponent(groupKeyRow.value)}`, env);
    company = c && c.company;
    if (!company) throw new Error('registry_no_company');
    const e = await fetchJson(
      `${env.API_BASE}/bormes/v3/events?group_key=${encodeURIComponent(groupKeyRow.value)}&size=100`, env);
    events = (e && e.events) || [];
  } catch (err) {
    sourceFailed = true;
    report.failures.push({ id: attestation.id, error: String(err.message || err) });
  }

  const outcomes = {};
  const now = new Date().toISOString();
  const factUpdates = [];
  if (!sourceFailed) {
    for (const f of facts || []) {
      const outcome = checkFact(f, company, events, attestation.accepted_at);
      if (!outcome) continue;
      outcomes[f.fact_key] = outcome;
      factUpdates.push(env.VERIFY_DB.prepare(
        `UPDATE attestation_facts SET last_check_outcome=?, last_checked_at=? WHERE id=?`)
        .bind(outcome, now, f.id));
    }
  }

  const decision = nextStatus({
    outcomes,
    consecutiveInconclusive: attestation.consecutive_inconclusive || 0,
    sourceFailed,
  });

  const statements = [...factUpdates];

  // The continuity record. Written on every check, including a no-op and a
  // failed upstream read - which the overwritten last_checked_at columns
  // cannot show. NOT written on expiry: the early return above fires first,
  // because expiry is a clock rather than a check and there is no outcome to
  // record. That act is in audit_events, where an act belongs.
  statements.push(env.VERIFY_DB.prepare(
    `INSERT INTO reconciliation_runs
      (attestation_id, subject_id, checked_at, source_failed, outcomes,
       status_before, status_after)
     VALUES (?,?,?,?,?,?,?)`)
    .bind(...buildRunRow({ attestation, outcomes, sourceFailed, decision, checkedAt: now })));

  // A successful check moves last_verified_at; a failed one must NOT, or the
  // page would claim a check that did not happen.
  statements.push(env.VERIFY_DB.prepare(
    `UPDATE attestations SET consecutive_inconclusive=?${sourceFailed ? '' : ', last_verified_at=?'}
      WHERE id=?`)
    .bind(...(sourceFailed
      ? [decision.consecutiveInconclusive, attestation.id]
      : [decision.consecutiveInconclusive, now, attestation.id])));

  if (decision.status && decision.status !== attestation.status) {
    // A disputed or under_review record never silently returns to live: only a
    // consistent check may restore it, and only from under_review.
    const mayRestore = attestation.status === 'under_review' || attestation.status === 'live';
    if (decision.status !== 'live' || mayRestore) {
      statements.push(
        env.VERIFY_DB.prepare('UPDATE attestations SET status=?, status_reason=? WHERE id=?')
          .bind(decision.status, decision.reason, attestation.id),
        await appendAudit(env, {
          attestation_id: attestation.id, subject_id: attestation.subject_id,
          action: `status_${decision.status}`, actor: 'reconciler',
          detail: JSON.stringify({ outcomes }),
          public_summary: PUBLIC_SUMMARY[decision.status] || null,
        }),
      );
      report.changed.push({ id: attestation.id, from: attestation.status, to: decision.status,
                            outcomes });
    }
  }

  await env.VERIFY_DB.batch(statements);

  const daysOld = Math.floor(
    (Date.now() - Date.parse(attestation.accepted_at)) / 86_400_000);
  if (daysOld >= RECONFIRM_NUDGE_DAYS && attestation.status === 'live') {
    report.nudge.push({ id: attestation.id, days: daysOld });
  }
}

export async function reconcileAll(env) {
  const report = { checked: 0, changed: [], failures: [], nudge: [], anchored: null, purged: 0 };

  const { results } = await env.VERIFY_DB.prepare(
    `SELECT * FROM attestations WHERE status IN (${CURRENT.map(() => '?').join(',')})`)
    .bind(...CURRENT).all();

  for (const attestation of results || []) {
    report.checked++;
    try {
      await reconcileOne(env, attestation, report);
    } catch (e) {
      report.failures.push({ id: attestation.id, error: String(e.message || e) });
    }
  }

  // The daily checkpoint. Writing the head into our own database anchors
  // NOTHING - we control that row. The anchor is only worth what its retention
  // OFF this system is worth, which is what the mail is for. So dispatched_to
  // is left null here and set only once a message has actually been accepted:
  // recording a dispatch that did not happen would be precisely the kind of
  // overclaim this whole system exists to avoid.
  const head = await env.VERIFY_DB
    .prepare('SELECT seq, hash FROM audit_events ORDER BY seq DESC LIMIT 1').first();
  if (head) {
    const day = new Date().toISOString().slice(0, 10);
    await env.VERIFY_DB.prepare(
      `INSERT OR REPLACE INTO chain_anchors (day, head_seq, head_hash, published_at, dispatched_to)
       VALUES (?,?,?,?,NULL)`)
      .bind(day, head.seq, head.hash, new Date().toISOString()).run();
    report.anchored = { day, seq: head.seq, hash: head.hash };
  }

  // Retention for the continuity record. Best-effort: losing a purge is a
  // storage cost, and failing the whole run over it would cost a day of checks.
  try {
    const purge = await env.VERIFY_DB
      .prepare('DELETE FROM reconciliation_runs WHERE checked_at < ?')
      .bind(runRetentionCutoff()).run();
    report.purged = purge?.meta?.changes || 0;
  } catch (e) {
    report.failures.push({ id: 'reconciliation_runs_purge', error: String(e.message || e) });
  }

  return report;
}

/**
 * Records that the day's chain head actually left the system. Called only after
 * the mail provider accepted the message.
 */
export async function markAnchorDispatched(env, day, to) {
  await env.VERIFY_DB
    .prepare('UPDATE chain_anchors SET dispatched_to = ? WHERE day = ?')
    .bind(to, day).run();
}

async function mail(env, report) {
  if (!env.CLOUDFLARE_EMAIL_API_TOKEN) return 'skipped_no_token';
  const lines = [
    `Checked: ${report.checked}`,
    `Status changes: ${report.changed.length}`,
    ...report.changed.map((c) => `  ${c.id}: ${c.from} -> ${c.to}`),
    `Failures: ${report.failures.length}`,
    ...report.failures.map((f) => `  ${f.id}: ${f.error}`),
    `Due for reconfirmation: ${report.nudge.length}`,
    `Check rows purged (older than ${RUN_RETENTION_DAYS} days): ${report.purged}`,
    report.anchored
      ? `Chain head ${report.anchored.day}: seq ${report.anchored.seq} ${report.anchored.hash}`
      : 'Chain head: none',
    '',
    'Retain this message: the chain head above is the daily external checkpoint.',
  ];
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/e0f6d4652827b154cc920fd53ed54101/email/routing/send`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
                 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.REPORT_EMAIL_FROM, to: env.REPORT_EMAIL_TO,
        subject: `Attestation reconciliation — ${report.changed.length} change(s)`,
        text: lines.join('\n'),
      }),
    });
  return r.ok ? 'sent' : `failed_${r.status}`;
}

export default {
  async scheduled(event, env, ctx) {
    // Refuse rather than degrade: an unkeyed batch caller consumes the
    // site-wide rate budget and can take the public site down with it.
    if (!env.INTERNAL_API_KEY) {
      console.error('verification-reconciler: INTERNAL_API_KEY missing, refusing to run');
      return;
    }
    ctx.waitUntil((async () => {
      const report = await reconcileAll(env);
      const mailed = await mail(env, report);
      // Only a delivered checkpoint counts as an external anchor.
      if (mailed === 'sent' && report.anchored) {
        await markAnchorDispatched(env, report.anchored.day, env.REPORT_EMAIL_TO);
      }
      if (mailed !== 'sent') {
        console.warn(`verification-reconciler: checkpoint NOT dispatched (${mailed}). `
          + 'The chain head is unanchored outside this system until it is.');
      }
      console.log(JSON.stringify({ ...report, mailed }));
    })());
  },
};
