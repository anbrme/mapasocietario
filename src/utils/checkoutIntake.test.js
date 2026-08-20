import { describe, it, expect } from 'vitest';
import { buildCheckoutIntake } from './checkoutIntake';

describe('buildCheckoutIntake', () => {
  it('sends nothing on the paid path — that question moved to after payment', () => {
    // Arrange
    const input = { freeActive: false, role: 'compliance', need: 'AML review' };

    // Act
    const intake = buildCheckoutIntake(input);

    // Assert — a paying buyer is asked nothing in the checkout dialog
    expect(intake).toBeNull();
  });

  it('sends role, need and opt-in on the free path', () => {
    // Arrange
    const input = { freeActive: true, role: 'advisor', need: '  checking supplier  ', followUpOptIn: true };

    // Act
    const intake = buildCheckoutIntake(input);

    // Assert — need is trimmed, opt-in coerced to a real boolean
    expect(intake).toEqual({ role: 'advisor', need: 'checking supplier', followUpOptIn: true });
  });

  it('still returns an object on the free path when fields are blank', () => {
    // Arrange — the gate, not this builder, is what rejects an empty intake
    const input = { freeActive: true, role: '', need: '' };

    // Act
    const intake = buildCheckoutIntake(input);

    // Assert
    expect(intake).toEqual({ role: '', need: '', followUpOptIn: false });
  });

  it('trims padding on the free path', () => {
    // Arrange / Act
    const intake = buildCheckoutIntake({ freeActive: true, role: '  investor  ', need: ' x ' });

    // Assert
    expect(intake).toEqual({ role: 'investor', need: 'x', followUpOptIn: false });
  });

  it('returns null when called with no arguments', () => {
    // Arrange / Act
    const intake = buildCheckoutIntake();

    // Assert
    expect(intake).toBeNull();
  });
});
