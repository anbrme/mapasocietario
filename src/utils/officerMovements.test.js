import { describe, it, expect } from 'vitest';
import { isAppointmentMovement } from './officerMovements';

describe('isAppointmentMovement', () => {
  it('trusts the backend classification when present', () => {
    expect(isAppointmentMovement({ movement: 'appointment' })).toBe(true);
    expect(isAppointmentMovement({ movement: 'cessation' })).toBe(false);
  });

  it('an unmapped act is not an appointment', () => {
    // /bormes/v3/officer-events returns 'other' rather than guessing; a
    // timeline must not draw it as the start of a term.
    expect(isAppointmentMovement({ movement: 'other', event_type: 'Otros conceptos' })).toBe(false);
  });

  it('classifies the registry vocabulary regardless of case', () => {
    // The events index publishes 'Nombramientos'; expand-officer publishes
    // 'nombramientos'. A case-sensitive list read the capitalised form as a
    // cessation and drew every appointment as the END of a term.
    expect(isAppointmentMovement({ event_type: 'Nombramientos' })).toBe(true);
    expect(isAppointmentMovement({ event_type: 'nombramientos' })).toBe(true);
    expect(isAppointmentMovement({ event_type: 'Reelecciones' })).toBe(true);
    expect(isAppointmentMovement({ event_type: 'Revocaciones' })).toBe(false);
    expect(isAppointmentMovement({ event_type: 'Ceses/Dimisiones' })).toBe(false);
  });

  it('treats a missing act as not an appointment', () => {
    expect(isAppointmentMovement({})).toBe(false);
  });
});
