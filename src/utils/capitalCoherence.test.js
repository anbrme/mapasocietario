import { describe, it, expect } from 'vitest';
import { hasIncoherentCapital } from './capitalCoherence';

const entry = (text) => ({ has_capital_change: true, full_entry: text });
const MAIER = entry('Reducción de capital. Importe reducción: 700.872,80 Euros. '
  + 'Resultante Suscrito: 6.231.559.999,99 Euros.');

describe('hasIncoherentCapital', () => {
  it('condemns a figure its own filing contradicts', () => {
    // A EUR 700.872,80 reduction leaving EUR 6.23bn moves 0.011% of the result.
    expect(hasIncoherentCapital(6231559999.99, [MAIER])).toBe(true);
  });

  it('accepts a nominal-value redenomination, which is a real filing', () => {
    // TESTA RESIDENCIAL SOCIMI SA moved EUR 0,57 against EUR 132m so the share
    // nominal divides cleanly. Magnitude alone would delete this.
    expect(hasIncoherentCapital(132270202, [entry(
      'Reducción de capital. Importe reducción: 0,57 Euros. '
      + 'Resultante Suscrito: 132.270.202,00 Euros.')])).toBe(false);
  });

  it('accepts a substantial reduction that moves a real share', () => {
    expect(hasIncoherentCapital(7729020, [entry(
      'Reducción de capital. Importe reducción: 15.458,04 Euros. '
      + 'Resultante Suscrito: 7.729.020,00 Euros.')])).toBe(false);
  });

  it('lets an older incoherent filing say nothing about a later capital', () => {
    expect(hasIncoherentCapital(60000, [MAIER])).toBe(false);
  });

  it('accepts a figure with no checkable filing behind it', () => {
    expect(hasIncoherentCapital(3000000, [])).toBe(false);
    expect(hasIncoherentCapital(3000000, [entry('Nombramientos. Apoderado: X.')])).toBe(false);
  });

  it('reads a capital the graph carries as a formatted string', () => {
    // The graph takes capital off the event, where it can arrive as text.
    expect(hasIncoherentCapital('6231559999.99', [MAIER])).toBe(true);
  });

  it('ignores absent, zero and unparseable figures', () => {
    for (const value of [null, undefined, 0, '', 'n/d']) {
      expect(hasIncoherentCapital(value, [MAIER])).toBe(false);
    }
  });
});
