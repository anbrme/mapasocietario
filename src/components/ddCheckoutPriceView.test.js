import { describe, it, expect } from 'vitest';
import { checkoutPriceView } from './ddCheckoutPriceView';

// The subset of the dialog's copy the price view reads. Real English strings,
// so a regression that re-surfaces Stripe wording on a free order is caught
// by content, not by key name.
const copy = {
  basePrice: 'Base price',
  financialStatements: 'Financial Statements (Cuentas Anuales)',
  taxVat: 'Tax / VAT',
  calculatedStripe: 'Calculated by Stripe',
  total: 'Total',
  shownAtStripe: 'Shown at Stripe Checkout',
  continueStripe: subtotal => `Continue to Stripe · from EUR ${subtotal.toFixed(2)}`,
  redirectingStripe: 'Redirecting to Stripe...',
  googlePlayPrice: 'Google Play price',
  includedGooglePlay: 'Included - set by Google Play per country',
  payGooglePlay: price => `Pay with Google Play · ${price}`,
  googlePlaySoon: 'Google Play payment coming soon',
  openingGooglePlay: 'Opening Google Play...',
  freeDiscount: 'First report — on us',
  freePrice: 'Free',
  freeFsExcluded: 'Not included in the free report',
  freeNoTax: 'Nothing to pay',
  generateFree: 'Generate my free report',
  placingFreeOrder: 'Placing your free order...',
  freeDelivery: email => `No payment page. We generate the report now and email it to ${email}, usually within a few minutes.`,
};

const DD = 22.5;
const FS = 17.5;
const base = { isAndroidApp: false, loading: false, ddPrice: DD, fsPrice: FS, includeFS: false, copy, email: 'a@b.c' };

describe('checkoutPriceView', () => {
  it('shows the Stripe subtotal and CTA for a paid web order', () => {
    const v = checkoutPriceView({ ...base, freeActive: false });
    expect(v.rows).toEqual([
      { label: 'Base price', value: 'EUR 22.50' },
      { label: 'Tax / VAT', value: 'Calculated by Stripe' },
    ]);
    expect(v.total).toEqual({ label: 'Total', value: 'Shown at Stripe Checkout' });
    expect(v.cta).toBe('Continue to Stripe · from EUR 22.50');
    expect(v.note).toBeNull();
  });

  it('adds the financial-statements add-on to a paid subtotal', () => {
    const v = checkoutPriceView({ ...base, freeActive: false, includeFS: true });
    expect(v.rows[0]).toEqual({ label: 'Base price', value: 'EUR 40.00' });
    expect(v.cta).toBe('Continue to Stripe · from EUR 40.00');
  });

  it('shows a EUR 0.00 total and a free CTA when the free first report is active', () => {
    const v = checkoutPriceView({ ...base, freeActive: true });
    expect(v.rows).toEqual([
      { label: 'Base price', value: 'EUR 22.50' },
      { label: 'First report — on us', value: '−EUR 22.50' },
      { label: 'Tax / VAT', value: 'Nothing to pay' },
    ]);
    expect(v.total).toEqual({ label: 'Total', value: 'EUR 0.00' });
    expect(v.cta).toBe('Generate my free report');
    expect(v.note).toBe('No payment page. We generate the report now and email it to a@b.c, usually within a few minutes.');
  });

  it('never mentions Stripe anywhere on a free order', () => {
    const v = checkoutPriceView({ ...base, freeActive: true, includeFS: true });
    expect(JSON.stringify(v)).not.toMatch(/stripe/i);
  });

  it('marks the financial-statements add-on as excluded, not charged, on a free order', () => {
    const v = checkoutPriceView({ ...base, freeActive: true, includeFS: true });
    expect(v.rows).toContainEqual({ label: 'Financial Statements (Cuentas Anuales)', value: 'Not included in the free report' });
    expect(v.total.value).toBe('EUR 0.00');
  });

  it('uses the free busy label while a free order is being placed', () => {
    const v = checkoutPriceView({ ...base, freeActive: true, loading: true });
    expect(v.cta).toBe('Placing your free order...');
  });

  it('uses the Stripe busy label while a paid order redirects', () => {
    const v = checkoutPriceView({ ...base, freeActive: false, loading: true });
    expect(v.cta).toBe('Redirecting to Stripe...');
  });

  it('keeps the Google Play presentation on Android regardless of the free flag', () => {
    const v = checkoutPriceView({ ...base, freeActive: true, isAndroidApp: true, androidDisplayPrice: 'EUR 22.50', androidBillingEnabled: true });
    expect(v.rows).toEqual([
      { label: 'Google Play price', value: 'EUR 22.50' },
      { label: 'Tax / VAT', value: 'Included - set by Google Play per country' },
    ]);
    expect(v.total).toEqual({ label: 'Total', value: 'EUR 22.50' });
    expect(v.cta).toBe('Pay with Google Play · EUR 22.50');
    expect(v.note).toBeNull();
  });
});

describe('checkoutPriceView — the product card price', () => {
  it('shows Free, and the price it replaces, on the free path', () => {
    // Arrange / Act — the card used to keep showing EUR 22.50 beside a
    // "Generate my free report" button, so the dialog contradicted itself.
    const v = checkoutPriceView({ ...base, freeActive: true });

    // Assert
    expect(v.product).toEqual({ value: 'Free', was: 'EUR 22.50', isFree: true });
  });

  it('shows the plain price on the paid path, with nothing struck through', () => {
    // Arrange / Act
    const v = checkoutPriceView({ ...base, freeActive: false });

    // Assert
    expect(v.product).toEqual({ value: 'EUR 22.50', was: null, isFree: false });
  });

  it('keeps the base price on the card when the add-on is ticked', () => {
    // Arrange / Act — the add-on has its own row; the card prices the report
    const v = checkoutPriceView({ ...base, freeActive: false, includeFS: true });

    // Assert
    expect(v.product.value).toBe('EUR 22.50');
  });

  it('prefers the Google Play price on Android when that product is selected', () => {
    // Arrange / Act
    const v = checkoutPriceView({
      ...base, freeActive: false, isAndroidApp: true,
      androidDisplayPrice: '24,99 \u20ac', androidCardPrice: '24,99 \u20ac',
    });

    // Assert
    expect(v.product).toEqual({ value: '24,99 \u20ac', was: null, isFree: false });
  });

  it('falls back to the EUR price on Android when no product is selected', () => {
    // Arrange / Act
    const v = checkoutPriceView({
      ...base, freeActive: false, isAndroidApp: true,
      androidDisplayPrice: '24,99 \u20ac', androidCardPrice: null,
    });

    // Assert
    expect(v.product).toEqual({ value: 'EUR 22.50', was: null, isFree: false });
  });
});
