import { describe, it, expect } from 'vitest';
import { orderConversionEvent, isFreeOrderSession } from './orderConversionEvent';

describe('isFreeOrderSession', () => {
  it('treats direct free sessions (waiver, free-first, Google Play) as free', () => {
    expect(isFreeOrderSession('cs_free_1789190323592_0arfqbxd')).toBe(true);
    expect(isFreeOrderSession('cs_free_gp_1789190323592_abcdefghij')).toBe(true);
  });

  it('treats Stripe sessions as paid', () => {
    expect(isFreeOrderSession('cs_live_b1xk4Qm2xxxxxxxxxxxx')).toBe(false);
    expect(isFreeOrderSession('cs_test_a1b2c3d4e5f6g7h8i9')).toBe(false);
  });

  it('treats a missing or malformed id as free rather than as revenue', () => {
    expect(isFreeOrderSession('')).toBe(true);
    expect(isFreeOrderSession(undefined)).toBe(true);
  });
});

describe('orderConversionEvent', () => {
  it('emits a purchase with the report price for a paid Stripe order', () => {
    // Arrange
    const order = { sessionId: 'cs_live_b1xk4Qm2xxxxxxxxxxxx', country: 'es', priceEur: 22.5 };

    // Act
    const ev = orderConversionEvent(order);

    // Assert
    expect(ev.name).toBe('purchase');
    expect(ev.params.transaction_id).toBe(order.sessionId);
    expect(ev.params.value).toBe(22.5);
    expect(ev.params.currency).toBe('EUR');
    expect(ev.params.items).toEqual([
      { item_name: 'DD Report — ES', item_category: 'Due Diligence', price: 22.5, quantity: 1 },
    ]);
  });

  it('emits free_report_delivered with zero value for a free order, never a purchase', () => {
    const ev = orderConversionEvent({ sessionId: 'cs_free_1789190323592_0arfqbxd', country: 'es', priceEur: 22.5 });
    expect(ev.name).toBe('free_report_delivered');
    expect(ev.params.value).toBe(0);
    expect(ev.params.transaction_id).toBe('cs_free_1789190323592_0arfqbxd');
    expect(ev.params.items[0].price).toBe(0);
  });

  it('upper-cases the country in the item name and tolerates a missing country', () => {
    expect(orderConversionEvent({ sessionId: 'cs_live_x', country: 'fr', priceEur: 22.5 }).params.items[0].item_name).toBe('DD Report — FR');
    expect(orderConversionEvent({ sessionId: 'cs_live_x', priceEur: 22.5 }).params.items[0].item_name).toBe('DD Report — ES');
  });
});
