#!/usr/bin/env node
/**
 * Enforce the robots.txt parameter disallows at the Cloudflare edge.
 *
 * robots.txt is advisory. In the three days to 26 Aug 2026 meta-externalagent
 * fetched /app/ and /due-diligence/ 56,916 times -- ~19k/day against ~12 real
 * visitors/day -- because it had a per-crawler group of its own and robots.txt
 * groups do not inherit, so the parameter traps in "User-agent: *" never
 * applied to it. The traps are now repeated in every group
 * (scripts/generate-seo-files.mjs); this rule is what happens when a crawler
 * ignores them anyway.
 *
 * The rule mirrors robots.txt EXACTLY: only the unbounded parameters, only for
 * the crawlers that already have a group. The bare /app/ and /due-diligence/
 * stay open to everyone -- being read by AI answer engines is the point of the
 * AEO work, and blocking the pages themselves would trade a crawl problem for
 * a visibility one.
 *
 * Usage:
 *   CLOUDFLARE_WAF_TOKEN=... node scripts/cf-crawl-guard.mjs           # dry run
 *   CLOUDFLARE_WAF_TOKEN=... node scripts/cf-crawl-guard.mjs --apply
 *
 * The token needs Zone:Read plus Zone WAF:Edit on the zone. The analytics
 * token cannot do this -- it is read-only by design, keep it that way.
 */

const ZONE_NAME = process.env.CF_ZONE_NAME || 'mapasocietario.es';
const PHASE = 'http_request_firewall_custom';

// Stable: the rule is upserted by this description, so changing it creates a
// second rule instead of updating the first.
const RULE_DESCRIPTION = 'AI crawlers: enforce robots.txt parameter disallows on /app/ and /due-diligence/';

const CRAWLERS = ['meta-externalagent', 'GPTBot', 'ClaudeBot', 'CCBot', 'Applebot-Extended'];

const uaMatch = CRAWLERS.map((ua) => `http.user_agent contains "${ua}"`).join(' or ');

const RULE = {
  action: 'block',
  description: RULE_DESCRIPTION,
  enabled: true,
  expression:
    `(${uaMatch}) and (` +
    '(starts_with(http.request.uri.path, "/app/") and ' +
    '(http.request.uri.query contains "search=" or http.request.uri.query contains "gk=")) or ' +
    '(starts_with(http.request.uri.path, "/due-diligence/") and ' +
    'http.request.uri.query contains "company="))',
};

async function cf(path, token, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(`Cloudflare API ${res.status}: ${JSON.stringify(body.errors || body).slice(0, 400)}`);
  }
  return body.result;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const token = process.env.CLOUDFLARE_WAF_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  console.log(`\nRule: ${RULE.action.toUpperCase()} — ${RULE_DESCRIPTION}`);
  console.log(`  ${RULE.expression}\n`);

  if (!token) {
    console.error(
      'CLOUDFLARE_WAF_TOKEN is not set. Create a token at\n' +
        '  https://dash.cloudflare.com/profile/api-tokens\n' +
        `with Zone:Read and Zone WAF:Edit on ${ZONE_NAME}, then:\n` +
        `  CLOUDFLARE_WAF_TOKEN=... node scripts/cf-crawl-guard.mjs --apply`,
    );
    process.exit(1);
  }

  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`, token);
  if (!zones?.length) throw new Error(`zone ${ZONE_NAME} not visible to this token`);
  const zoneId = zones[0].id;

  // The entrypoint ruleset holds every custom rule on the zone, and a PUT
  // replaces the whole list -- so read what is there and upsert into a copy.
  // Overwriting somebody else's rule would be a silent security regression.
  let existing = { rules: [] };
  try {
    existing = await cf(`/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`, token);
  } catch (error) {
    if (!/404/.test(error.message)) throw error;
  }

  const currentRules = existing.rules || [];
  const previous = currentRules.find((rule) => rule.description === RULE_DESCRIPTION);
  const nextRules = previous
    ? currentRules.map((rule) => (rule.description === RULE_DESCRIPTION ? { ...rule, ...RULE } : rule))
    : [...currentRules, RULE];

  console.log(`Zone ${ZONE_NAME} has ${currentRules.length} custom rule(s).`);
  console.log(previous ? '  This rule already exists and would be updated.' : '  This rule would be added.');
  for (const rule of currentRules) {
    console.log(`  - [${rule.action}] ${rule.description || '(no description)'}`);
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write it.\n');
    return;
  }

  await cf(`/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`, token, {
    method: 'PUT',
    body: JSON.stringify({ rules: nextRules }),
  });
  console.log('\nApplied. Check the effect in a day:');
  console.log('  node scripts/cf-zone-analytics.mjs\n');
  console.log('If crawler volume on those two paths does NOT fall, the traffic was');
  console.log('hitting the bare paths rather than the parameter variants, and the next');
  console.log('step is a rate limit rather than a wider block.\n');
}

main().catch((error) => {
  console.error(`failed: ${error.message}`);
  process.exit(1);
});
