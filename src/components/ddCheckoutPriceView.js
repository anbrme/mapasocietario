// Pure view-model for the checkout dialog's price breakdown and primary CTA.
// No rendering deps, so it runs under the node-env unit test config; the MUI
// rows and button live in DDCheckoutDialog.jsx and consume this.
//
// Why it exists: a free first report is fulfilled server-side with no payment
// page, but the dialog used to keep showing "EUR 22.50 / Calculated by Stripe /
// Continue to Stripe" after the user ticked "Use my free first report" — which
// reads as bait-and-switch next to the "no card" promise. Every price string
// the user sees now comes from one place that knows whether the order is free.

const eur = amount => `EUR ${amount.toFixed(2)}`;

/**
 * @param {object} p
 * @param {boolean} p.freeActive - free-first-report path is on for this order
 * @param {boolean} p.isAndroidApp - Google Play is the merchant of record
 * @param {boolean} p.loading - order is being placed / redirect in flight
 * @param {number} p.ddPrice
 * @param {number} p.fsPrice
 * @param {boolean} p.includeFS - financial statements add-on ticked
 * @param {object} p.copy - the dialog's language dictionary
 * @param {string} p.email - buyer email, named in the free delivery note
 * @param {string} [p.androidDisplayPrice]
 * @param {string} [p.androidCardPrice] - Google Play price for the report card,
 *   or null when no matching Play product is selected
 * @param {boolean} [p.androidBillingEnabled]
 * @returns {{ rows: {label: string, value: string}[], total: {label: string, value: string},
 *   product: {value: string, was: string|null, isFree: boolean}, cta: string, note: string|null }}
 */
export function checkoutPriceView({
  freeActive, isAndroidApp, loading, ddPrice, fsPrice, includeFS, copy, email,
  androidDisplayPrice, androidBillingEnabled, androidCardPrice,
}) {
  if (isAndroidApp) {
    return {
      rows: [
        { label: copy.googlePlayPrice, value: androidDisplayPrice },
        { label: copy.taxVat, value: copy.includedGooglePlay },
      ],
      total: { label: copy.total, value: androidDisplayPrice },
      product: { value: androidCardPrice || eur(ddPrice), was: null, isFree: false },
      cta: loading
        ? copy.openingGooglePlay
        : (androidBillingEnabled ? copy.payGooglePlay(androidDisplayPrice) : copy.googlePlaySoon),
      note: null,
    };
  }

  if (freeActive) {
    // The free tier never includes financial statements (they cost real money
    // at the Registro Mercantil), so the add-on is shown as excluded, never
    // priced — the worker drops it from the order regardless.
    const fsRow = includeFS ? [{ label: copy.financialStatements, value: copy.freeFsExcluded }] : [];
    return {
      rows: [
        { label: copy.basePrice, value: eur(ddPrice) },
        { label: copy.freeDiscount, value: `−${eur(ddPrice)}` },
        ...fsRow,
        { label: copy.taxVat, value: copy.freeNoTax },
      ],
      total: { label: copy.total, value: eur(0) },
      // The card leads the dialog, so it must say Free too — it used to keep
      // showing the full price beside a "Generate my free report" button.
      // `was` keeps the number visible, struck through, so the gift is legible.
      product: { value: copy.freePrice, was: eur(ddPrice), isFree: true },
      cta: loading ? copy.placingFreeOrder : copy.generateFree,
      note: copy.freeDelivery(email),
    };
  }

  const subtotal = ddPrice + (includeFS ? fsPrice : 0);
  return {
    rows: [
      { label: copy.basePrice, value: eur(subtotal) },
      { label: copy.taxVat, value: copy.calculatedStripe },
    ],
    total: { label: copy.total, value: copy.shownAtStripe },
    product: { value: eur(ddPrice), was: null, isFree: false },
    cta: loading ? copy.redirectingStripe : copy.continueStripe(subtotal),
    note: null,
  };
}
