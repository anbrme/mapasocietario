/**
 * GET /api/verify/badge?group_key=... — the attestation badge for one company.
 *
 * Exists because the in-app company panel used to read a build-time map that no
 * longer exists: attestations live in D1 now, so the SPA has to ask.
 *
 * It exposes exactly what the /empresa page already renders publicly, behind
 * exactly the same gate (_attestation.isBadgeVisible), so it can never show more
 * than the page it mirrors. Unauthenticated by design - this is the public
 * projection, not the record.
 */
import { liveAttestationFor } from '../../empresa/_attestation.js';

export async function onRequestGet({ request, env }) {
  const groupKey = new URL(request.url).searchParams.get('group_key') || '';
  const attestation = groupKey ? await liveAttestationFor(env, groupKey) : null;

  return new Response(JSON.stringify({ ok: true, attestation }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Short: a status change should reach the app within minutes, and there
      // are only a handful of these companies.
      'cache-control': 'public, max-age=0, s-maxage=300',
    },
  });
}
