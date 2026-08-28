import { describe, it, expect } from 'vitest';
import { companyRecencyLine } from './companyRecencyLine';

// Dates come from src/utils/formatDate (dd/mm/yyyy, es-ES and en-GB alike).
// This module never formats a date itself.
describe('companyRecencyLine', () => {
  it('names the last filing and dates it once', () => {
    expect(companyRecencyLine({
      lastEventType: 'Nombramientos', lastSeen: '2026-08-04',
      firstSeen: '2009-02-03', eventCount: 24, lang: 'es',
    })).toBe('Última publicación: Nombramientos · 04/08/2026 · 24 en total desde 2009');
  });

  it('falls back to the date alone when the filing has no readable type', () => {
    expect(companyRecencyLine({
      lastSeen: '2026-08-04', firstSeen: '2009-02-03', eventCount: 24, lang: 'es',
    })).toBe('Última publicación: 04/08/2026 · 24 en total desde 2009');
  });

  it('drops the total when there is no count to give', () => {
    expect(companyRecencyLine({ lastSeen: '2026-08-04', lang: 'es' }))
      .toBe('Última publicación: 04/08/2026');
  });

  it('drops "desde" when the first filing is unknown', () => {
    expect(companyRecencyLine({ lastSeen: '2026-08-04', eventCount: 3, lang: 'es' }))
      .toBe('Última publicación: 04/08/2026 · 3 en total');
  });

  it('speaks English too', () => {
    expect(companyRecencyLine({
      lastEventType: 'Nombramientos', lastSeen: '2026-08-04',
      firstSeen: '2009-02-03', eventCount: 24, lang: 'en',
    })).toBe('Last filing: Nombramientos · 04/08/2026 · 24 in total since 2009');
  });

  it('is null with no date — a sparse doc must not render a broken line', () => {
    expect(companyRecencyLine({ lang: 'es' })).toBeNull();
    expect(companyRecencyLine({ eventCount: 5, lang: 'es' })).toBeNull();
    expect(companyRecencyLine({})).toBeNull();
  });

  it('states no severity and asks for nothing', () => {
    const line = companyRecencyLine({
      lastEventType: 'Reducción de capital', lastSeen: '2026-08-04',
      firstSeen: '2009-02-03', eventCount: 24, lang: 'es',
    });
    expect(line).not.toMatch(/riesgo|atención|alerta|revisar|risk|concern|warning/i);
  });
});
