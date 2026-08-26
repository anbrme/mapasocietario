/**
 * How far a visitor got inside the DD checkout dialog before closing it.
 *
 * GA4 already records the two ends of this step — view_item when the dialog
 * opens, begin_checkout when it is submitted — but nothing in between, so a
 * dialog that opens and closes is indistinguishable from one that was filled
 * in and then abandoned at the last moment. Those need different fixes.
 *
 * One low-cardinality dimension reports better than five booleans, so the
 * flags collapse onto a single ladder ordered by depth of commitment: typing
 * an email is idle curiosity, ticking the free-report box is intent, and
 * answering an intake question means the visitor was willing to trade
 * information for the report.
 */

// Ordered least to most committed; the last matching rung wins.
const STAGES = [
  { name: 'opened', reached: () => true },
  { name: 'email_entered', reached: ({ email }) => hasText(email) },
  { name: 'free_selected', reached: ({ useFreeReport }) => !!useFreeReport },
  {
    name: 'intake_started',
    reached: ({ buyerRole, needContext }) => hasText(buyerRole) || hasText(needContext),
  },
  { name: 'submitted', reached: ({ submitted }) => !!submitted },
];

function hasText(value) {
  return String(value ?? '').trim().length > 0;
}

export function furthestCheckoutStage(state = {}) {
  return STAGES.reduce(
    (furthest, stage) => (stage.reached(state) ? stage.name : furthest),
    'opened'
  );
}
