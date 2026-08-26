import { describe, expect, it } from 'vitest';
import { furthestCheckoutStage } from './checkoutAbandon';

describe('furthestCheckoutStage', () => {
  it('reports an untouched dialog as opened', () => {
    expect(furthestCheckoutStage({})).toBe('opened');
  });

  it('counts a typed email as the first real step', () => {
    expect(furthestCheckoutStage({ email: 'a@b.com' })).toBe('email_entered');
  });

  it('ignores whitespace-only input', () => {
    expect(furthestCheckoutStage({ email: '   ' })).toBe('opened');
    expect(furthestCheckoutStage({ needContext: '  ' })).toBe('opened');
  });

  it('ranks ticking the free-report box above typing an email', () => {
    expect(furthestCheckoutStage({ email: 'a@b.com', useFreeReport: true }))
      .toBe('free_selected');
  });

  it('ranks answering an intake field above ticking the box', () => {
    expect(furthestCheckoutStage({ useFreeReport: true, buyerRole: 'lawyer' }))
      .toBe('intake_started');
    expect(furthestCheckoutStage({ useFreeReport: true, needContext: 'supplier check' }))
      .toBe('intake_started');
  });

  it('reports a submitted order regardless of how much was filled in', () => {
    expect(furthestCheckoutStage({ submitted: true })).toBe('submitted');
  });
});
