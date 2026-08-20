/**
 * Build the `intake` payload for POST /api/stripe/create-dd-checkout.
 *
 * Only the free-report gate collects intake at checkout, and there role and
 * free-text need are REQUIRED — they are the price of the free report, so an
 * empty value is a caller bug, not a user choice, and the gate rejects it.
 *
 * Paying buyers are asked nothing here. That question moved to the order page
 * after payment (see OrderStatusPage and the worker's set-order-intake route):
 * GA over the 28 days to 2026-08-20 showed 23 users opening the checkout dialog
 * and 6 submitting it, so the dialog is the worst-converting step in the funnel
 * and the wrong place to add an optional field.
 *
 * Returns null when there is nothing to send, so callers can spread it
 * conditionally instead of posting an empty object the worker would persist.
 */
export function buildCheckoutIntake({ freeActive, role, need, followUpOptIn } = {}) {
  if (!freeActive) return null;

  return {
    role: String(role || '').trim(),
    need: String(need || '').trim(),
    followUpOptIn: !!followUpOptIn,
  };
}
