// The GA4 conversion event for a delivered DD report.
//
// Until 2026-09-16 the order page sent `purchase` with the full report price
// for EVERY delivered report, free ones included, so GA4 counted free-first
// reports and waivers as revenue while the two real Stripe orders of the
// summer never appeared. Free orders are fulfilled directly by the payments
// worker under a `cs_free_` session id (waiver, free-first programme, Google
// Play); only Stripe sessions (`cs_live_` / `cs_test_`) carry money.
//
// Residual: a Stripe session settled with a 100 % coupon still reads as paid
// here — the verify endpoint does not return the amount. That path is legacy
// (the free-first programme no longer goes through Stripe), so the prefix is
// the honest boundary today.

export const FREE_SESSION_PREFIX = 'cs_free_';

export const isFreeOrderSession = sessionId => (
  typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.startsWith(FREE_SESSION_PREFIX)
);

export function orderConversionEvent({ sessionId, country, priceEur }) {
  const free = isFreeOrderSession(sessionId);
  const value = free ? 0 : priceEur;
  return {
    name: free ? 'free_report_delivered' : 'purchase',
    params: {
      transaction_id: sessionId,
      currency: 'EUR',
      value,
      items: [{
        item_name: `DD Report — ${String(country || 'es').toUpperCase()}`,
        item_category: 'Due Diligence',
        price: value,
        quantity: 1,
      }],
    },
  };
}
