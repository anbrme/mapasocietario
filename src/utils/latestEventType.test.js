import { describe, it, expect } from 'vitest';
import { latestEventType } from './latestEventType';

// v3 events carry event_types: [{ category, type }]. "Datos registrales" rides
// along on nearly every BORME entry and describes bookkeeping rather than an
// event, so it is never the answer while a real act is present.
describe('latestEventType', () => {
  it('names the act on the newest filing', () => {
    expect(latestEventType([
      { event_types: [{ category: 'officers', type: 'Nombramientos' },
                      { category: 'administrative', type: 'Datos registrales' }] },
    ])).toBe('Nombramientos');
  });

  it('prefers a real act over the registry boilerplate', () => {
    expect(latestEventType([
      { event_types: [{ category: 'administrative', type: 'Datos registrales' },
                      { category: 'capital', type: 'Reducción de capital' }] },
    ])).toBe('Reducción de capital');
  });

  it('falls back to boilerplate when it is genuinely all there is', () => {
    expect(latestEventType([
      { event_types: [{ category: 'administrative', type: 'Datos registrales' }] },
    ])).toBe('Datos registrales');
  });

  it('reads a plain string event type', () => {
    expect(latestEventType([{ event_types: ['Constitución'] }])).toBe('Constitución');
  });

  it('reads only the newest filing, never an older one', () => {
    expect(latestEventType([
      { event_types: [{ type: 'Nombramientos' }] },
      { event_types: [{ type: 'Constitución' }] },
    ])).toBe('Nombramientos');
  });

  it('is null when there is nothing to name', () => {
    expect(latestEventType([])).toBeNull();
    expect(latestEventType(null)).toBeNull();
    expect(latestEventType(undefined)).toBeNull();
    expect(latestEventType([{}])).toBeNull();
    expect(latestEventType([{ event_types: [] }])).toBeNull();
    expect(latestEventType([{ event_types: [{ category: 'x' }] }])).toBeNull();
  });
});
