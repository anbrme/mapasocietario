/**
 * Build the `intake` payload for POST /api/stripe/create-dd-checkout.
 *
 * Only the free-report path collects intake at checkout, and there role and
 * free-text need are OPTIONAL — see findCheckoutBlocker below for why. An empty
 * value is a user choice, and both this builder and the worker accept it.
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

/**
 * What blocks the checkout submit, if anything. Returns a reason key, or null
 * when the form may be sent.
 *
 * Email is the only requirement, on the paid and the free path alike: it is
 * where the report is delivered, and it is the sole field the worker itself
 * insists on (`free_report_email_required`).
 *
 * Role and need are asked on the free path but never required. Requiring them
 * made the dialog stricter than the API behind it: a user who claimed the free
 * report and skipped the questionnaire could not submit at all, and the button
 * gave no hint beforehand that the fields were mandatory. The free report is
 * the offer — a questionnaire is not its price.
 */
export function findCheckoutBlocker({ email } = {}) {
  if (!String(email || '').trim()) return 'email';
  return null;
}
