// Did a registry act put someone INTO a seat, or take them out of it?
//
// Two sources publish the act with different casing: /bormes/v3/officer-events
// (the event log) returns 'Nombramientos', /bormes/v3/expand-officer returns
// 'nombramientos'. The timeline used to test membership of a lowercase list
// case-sensitively, so the capitalised form fell through and every appointment
// was drawn as the END of a term.
//
// officer-events also classifies the act server-side into
// appointment/cessation/other using the registry vocabulary in
// borme_v3_enricher/normalize.py. Prefer that when it's there; the string
// fallback only covers records from the older endpoint.
const APPOINTMENT_ACTS = new Set([
  'NOMBRAMIENTOS', 'REELECCIONES', 'APPOINTMENT', 'REELECTION',
]);

export const isAppointmentMovement = (record) => {
  if (!record) return false;
  if (record.movement) return record.movement === 'appointment';
  return APPOINTMENT_ACTS.has((record.event_type || '').trim().toUpperCase());
};
