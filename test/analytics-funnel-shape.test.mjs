import assert from 'node:assert/strict';
import test from 'node:test';

import { FUNNEL_STAGES, SIDE_SIGNALS, reportWarnings } from '../workers/analytics/src/index.js';

// A funnel is a claim that each stage is a SUBSET of the one above it. The
// report drew one chain across two journeys that do not pass through each
// other, and printed a last stage larger than the two before it (13 "viewed a
// paid item" against 9 "opened a full profile") for three days running.
test('the funnel contains only stages nested in the one above', () => {
  const events = FUNNEL_STAGES.map((s) => s.event);

  // Fires only on the server-rendered /empresa pages, which arrive from Google
  // without ever touching the graph.
  assert.ok(
    !events.includes('company_profile_cta_click'),
    'company_profile_cta_click is an SEO-surface event, not a graph funnel stage',
  );
  // Opens from the graph toolbar, a node card, AND /due-diligence, so it is not
  // downstream of any single stage. It already heads the checkout funnel.
  assert.ok(
    !events.includes('view_item'),
    'view_item heads the checkout funnel; it is not the tail of the exploration funnel',
  );
  assert.equal(events[0], 'session_start');
  assert.equal(events.at(-1), 'company_full_profile_click');
});

test('the events cut from the funnel are still reported, not dropped', () => {
  const reported = SIDE_SIGNALS.map((s) => s.event);
  assert.ok(reported.includes('company_profile_cta_click'));
});

// The guard that makes this class of defect self-announcing rather than
// something a human has to notice in a table three days later.
test('a funnel stage larger than the one above it is reported', () => {
  const warnings = reportWarnings({
    funnel: [
      { label: 'Arrived', users: 282 },
      { label: 'Reached the graph', users: 53 },
      { label: 'Opened a full profile', users: 9 },
      { label: 'Viewed a paid item', users: 13 },
    ],
  });

  const warning = warnings.find((w) => w.includes('Viewed a paid item'));
  assert.ok(warning, `expected a monotonicity warning, got: ${warnings.join(' | ')}`);
  assert.match(warning, /13/);
  assert.match(warning, /9/);
});

test('a properly nested funnel raises no monotonicity warning', () => {
  const warnings = reportWarnings({
    funnel: [
      { label: 'Arrived', users: 282 },
      { label: 'Reached the graph', users: 53 },
      { label: 'Started a search', users: 44 },
      { label: 'Opened a full profile', users: 9 },
    ],
  });

  assert.equal(warnings.filter((w) => w.includes('larger than')).length, 0);
});
