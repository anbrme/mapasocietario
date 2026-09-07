/**
 * Example searches shown under the landing-page field.
 *
 * Each one is bound to the company's registry group key, never to a name
 * search: the autocomplete ranks by prefix, so typing "Inditex" surfaces
 * INDITEX LOGISTICA first and never the parent, whose legal name is INDUSTRIA
 * DE DISEÑO TEXTIL. Identities verified against the live directory on
 * 2026-09-07 (autocomplete ids and the /empresa pages' own graph deep links).
 */
export const LANDING_EXAMPLES = Object.freeze([
  { label: 'Endesa', name: 'ENDESA SA', id: 'H:M-6405' },
  { label: 'Inditex', name: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.', id: 'H:C-3342' },
  { label: 'FTI Consulting', name: 'FTI CONSULTING SPAIN SL', id: 'H:M-445656' },
]);

/** The same option shape a picked autocomplete suggestion has. */
export function exampleSearchOption(example) {
  return {
    type: 'company',
    name: example.name,
    value: example.name,
    label: example.name,
    id: example.id,
  };
}
