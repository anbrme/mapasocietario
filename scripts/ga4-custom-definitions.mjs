#!/usr/bin/env node
/**
 * Register the GA4 event-scoped custom definitions this app's events depend on.
 *
 * GA4 only exposes an event PARAMETER to the reporting API once it is registered
 * as a custom dimension or metric, and REGISTRATION IS NOT RETROACTIVE: every
 * day a parameter goes unregistered is a permanent hole, not a delay. The
 * daily report has already been unable to answer three questions for this
 * reason — whether a checkout redirect was free or paid, why a checkout failed,
 * and where an abandoned checkout died.
 *
 * Idempotent: it lists what the property already has and creates only what is
 * missing, so it is safe to re-run after adding a tier.
 *
 *   node scripts/ga4-custom-definitions.mjs                  # dry run, all tiers
 *   node scripts/ga4-custom-definitions.mjs --tier=conversion
 *   node scripts/ga4-custom-definitions.mjs --apply --tier=conversion,graph
 *
 * Needs a service account key with the Admin API enabled on its GCP project and
 * EDITOR on the GA4 property (Admin > Property access management). Viewer is not
 * enough to create a definition, and the Data API role does not imply it.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

import { getAccessToken } from '../workers/analytics/src/index.js';

const ADMIN = 'https://analyticsadmin.googleapis.com/v1beta';
const SCOPE = 'https://www.googleapis.com/auth/analytics.edit';
const PROPERTY = process.env.GA_PROPERTY_ID || '530829482';
const KEY_FILE =
  process.env.GA_SA_KEY_FILE || `${homedir()}/ga-sa.json`;

// GA4 standard properties cap event-scoped definitions at 50 of each. The cap
// is why this file is tiered rather than "register everything the app sends":
// 47 parameters exist, and spending the budget on one-off debug parameters
// would leave nothing for the ones a decision actually rests on.
const LIMIT = 50;

/**
 * Deliberately NOT registered:
 *
 *   company,
 *   company_slug - one value per company viewed, so thousands within a month.
 *                 GA4 collapses a high-cardinality dimension into "(other)",
 *                 which corrupts the rows around it rather than just its own.
 *                 The company is already in page_location; read it from there.
 *   transaction_id - unique per order by definition: the worst possible
 *                 cardinality, and GA4 reports it natively on purchase anyway.
 *   link_url,
 *   link_text,
 *   file_name   - constant or derivable; they would buy nothing.
 *   message     - free-text crash strings, unbounded cardinality and a PII risk.
 *   items,
 *   currency,
 *   price,
 *   value,
 *   quantity,
 *   item_name,
 *   item_category - GA4 ecommerce built-ins. Registering them would shadow the
 *                 native dimensions with a worse copy.
 */
const DIMENSIONS = [
  // --- conversion: what the report currently cannot answer ------------------
  ['free_report', 'Free report', 'conversion',
    'Whether the checkout was a waived free report or a paid one. Without it a checkout_redirect with no purchase cannot be told from lost revenue — the exact ambiguity that made three consecutive reports unreadable.'],
  ['destination', 'Checkout destination', 'conversion',
    'free_order vs stripe_new_tab vs stripe_same_tab. Splits "redirected" into fulfilled and payment-bound.'],
  ['reason', 'Checkout failure reason', 'conversion',
    'Why a checkout failed before redirect. Currently every failure reads "(not set)".'],
  ['platform', 'Platform', 'conversion',
    'web vs android fulfilment path. An Android return follows a different route and is otherwise invisible.'],
  ['furthest_stage', 'Furthest checkout stage', 'conversion',
    'How far an abandoned checkout got before it died.'],
  ['had_error', 'Checkout hit an error', 'conversion',
    'Whether an abandoned checkout had already errored, separating rejection from friction.'],
  ['include_financials', 'Financials included', 'conversion',
    'Which product variant was being bought.'],
  ['action', 'Company page CTA', 'conversion',
    'Which CTA on a server-rendered /empresa page was clicked. The SEO-arrival to product hand-off: it separates a company page that converts from one merely read.'],
  ['surface', 'Monitoring surface', 'conversion',
    'Where a BORME monitoring request came from.'],

  // --- intent: where a session came from and what it was after -------------
  ['entry_source', 'Entry source', 'intent',
    'Used by 8 events. The single most reusable dimension here: it attributes every graph interaction to the surface that started it.'],
  ['entity_type', 'Entity type', 'intent',
    'Company vs officer. Separates two audiences that behave differently.'],
  ['search_origin', 'Search origin', 'intent',
    'Which search surface produced the query.'],
  ['result_state', 'Search result state', 'intent',
    'Hit, empty, or error — the difference between "did not search" and "searched and found nothing".'],
  ['placement', 'Placement', 'intent',
    'Which instance of a repeated CTA was clicked.'],
  ['language', 'UI language', 'intent',
    'The interface language chosen, not the browser language GA4 reports natively.'],

  // --- graph: the four probes the report asks for and never gets -----------
  ['expand_origin', 'Expand origin', 'graph',
    'Double-click or context menu. graph_node_expand conflates both without it.'],
  ['expand_result', 'Expand result', 'graph',
    'Whether the node was already expanded. Re-expansion refires the event, so raw counts overstate discovery.'],
  ['interaction_source', 'Interaction source', 'graph',
    'Right-click, touch long-press, or pointer. A touch source is a double-tap, not a right-click.'],
  ['click_action', 'Click action', 'graph',
    'What a single click actually did (select, select_and_inspect, ...).'],
  ['context_action', 'Context menu action', 'graph', 'Which context-menu item was chosen.'],
  ['toolbar_action', 'Toolbar action', 'graph', 'Which toolbar control was used.'],
  ['selected_action', 'Selected node action', 'graph', 'Action taken on an already-selected node.'],
  ['selection_method', 'Selection method', 'graph', 'Keyboard or pointer selection of a search result.'],
  ['activation_source', 'Monitor activation source', 'graph', 'Which surface activated BORME monitoring.'],
  ['kind', 'Evidence kind', 'graph', 'Which evidence type was opened from the findings block.'],
];

/**
 * Numeric parameters must be custom METRICS. Registered as a dimension a
 * duration becomes a string: every distinct millisecond value is its own row,
 * it cannot be averaged, and it burns cardinality for nothing.
 */
const METRICS = [
  ['time_to_activation_ms', 'Time to graph activation', 'intent', 'MILLISECONDS',
    'How long from arrival to the first real graph interaction.'],
  ['time_to_type_ms', 'Time to first keystroke', 'intent', 'MILLISECONDS',
    'How long a visitor waits before searching at all.'],
  ['time_to_focus_ms', 'Time to search focus', 'intent', 'MILLISECONDS', 'Arrival to search-box focus.'],
  ['time_to_selection_ms', 'Time to selection', 'intent', 'MILLISECONDS', 'Search to chosen result.'],
  ['time_to_suggestions_ms', 'Time to suggestions', 'intent', 'MILLISECONDS',
    'Autocomplete latency as the user experienced it, not as the server logged it.'],
  ['result_count', 'Result count', 'intent', 'STANDARD', 'How many results a search returned.'],
  ['suggestion_count', 'Suggestion count', 'intent', 'STANDARD', 'Autocomplete suggestions offered.'],
  ['company_suggestion_count', 'Company suggestions', 'intent', 'STANDARD', 'Company half of the suggestions.'],
  ['officer_suggestion_count', 'Officer suggestions', 'intent', 'STANDARD', 'Officer half of the suggestions.'],
  ['selection_rank', 'Selection rank', 'intent', 'STANDARD',
    'Which rank was chosen. A high mean rank means the top result is wrong.'],
];

/* ------------------------------------------------------------------ auth */

// One implementation of the service-account JWT dance, owned by the worker that
// depends on it most. This script had its own copy; a second copy is a second
// thing to get wrong.
/* ------------------------------------------------------------------ api */

async function api(token, path, init = {}) {
  const res = await fetch(`${ADMIN}/properties/${PROPERTY}/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${init.method || 'GET'} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

async function listAll(token, kind) {
  const out = [];
  let pageToken = '';
  do {
    const page = await api(token, `${kind}?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`);
    out.push(...(page[kind] || []));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return out;
}

/* ----------------------------------------------------------------- main */

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const tierArg = (args.find((a) => a.startsWith('--tier=')) || '').slice(7);
const tiers = tierArg ? new Set(tierArg.split(',').map((t) => t.trim())) : null;
const wanted = (tier) => !tiers || tiers.has(tier);

let sa;
try {
  sa = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
} catch (e) {
  console.error(`Cannot read the service account key at ${KEY_FILE}`);
  console.error('Set GA_SA_KEY_FILE, or export the worker key:');
  console.error('  cd workers/analytics && npx wrangler secret list   # confirms GA_SA_KEY exists');
  console.error(`\n(${e.message})`);
  process.exit(1);
}

const token = await getAccessToken(sa, SCOPE);
console.log(`property ${PROPERTY}  ·  ${sa.client_email}\n`);

let existingDims;
let existingMets;
try {
  [existingDims, existingMets] = await Promise.all([
    listAll(token, 'customDimensions'),
    listAll(token, 'customMetrics'),
  ]);
} catch (e) {
  console.error(`Could not list existing definitions.\n  ${e.message}\n`);
  if (String(e.message).includes('has not been used in project')) {
    console.error('The Google Analytics Admin API is not enabled on this key\'s GCP project.');
    console.error('Enable it, wait a minute, and re-run.');
  } else if (e.status === 403) {
    console.error(`Grant ${sa.client_email} the Editor role on property ${PROPERTY}`);
    console.error('(GA4 Admin > Property access management). Viewer cannot create definitions.');
  }
  process.exit(1);
}

const haveDim = new Set(existingDims.map((d) => d.parameterName));
const haveMet = new Set(existingMets.map((m) => m.parameterName));

const missingDims = DIMENSIONS.filter(([p, , tier]) => wanted(tier) && !haveDim.has(p));
const missingMets = METRICS.filter(([p, , tier]) => wanted(tier) && !haveMet.has(p));

console.log(`dimensions: ${existingDims.length}/${LIMIT} used, ${missingDims.length} to create`);
console.log(`metrics:    ${existingMets.length}/${LIMIT} used, ${missingMets.length} to create\n`);

if (existingDims.length + missingDims.length > LIMIT) {
  console.error(`Refusing: that would need ${existingDims.length + missingDims.length} dimensions, over the ${LIMIT} cap.`);
  console.error('Narrow with --tier=conversion first — a definition cannot be freed and re-earned retroactively.');
  process.exit(1);
}

const created = [];
const failed = [];

for (const [parameterName, displayName, tier, description] of missingDims) {
  if (!apply) { console.log(`  would create  dim   ${parameterName.padEnd(26)} [${tier}]`); continue; }
  try {
    await api(token, 'customDimensions', {
      method: 'POST',
      body: JSON.stringify({ parameterName, displayName: safeName(displayName), description: safeDesc(description), scope: 'EVENT' }),
    });
    created.push(`dim ${parameterName}`);
    console.log(`  created  dim   ${parameterName}`);
  } catch (e) {
    failed.push(`dim ${parameterName}: ${e.message}`);
    console.error(`  FAILED   dim   ${parameterName}  ${e.message}`);
  }
}

for (const [parameterName, displayName, tier, measurementUnit, description] of missingMets) {
  if (!apply) { console.log(`  would create  met   ${parameterName.padEnd(26)} [${tier}] ${measurementUnit}`); continue; }
  try {
    await api(token, 'customMetrics', {
      method: 'POST',
      body: JSON.stringify({
        parameterName,
        displayName: safeName(displayName),
        description: safeDesc(description),
        scope: 'EVENT',
        measurementUnit,
      }),
    });
    created.push(`met ${parameterName}`);
    console.log(`  created  met   ${parameterName}`);
  } catch (e) {
    failed.push(`met ${parameterName}: ${e.message}`);
    console.error(`  FAILED   met   ${parameterName}  ${e.message}`);
  }
}

if (!apply) {
  console.log('\nDry run. Nothing was written. Re-run with --apply to create these.');
} else {
  console.log(`\ncreated ${created.length}, failed ${failed.length}`);
  console.log('Registration is not retroactive: these begin collecting from now, not from history.');
}
process.exit(failed.length ? 1 : 0);
