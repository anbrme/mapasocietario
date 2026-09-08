/**
 * How a fact is PRESENTED and what confirming one actually means.
 *
 * The acceptance screen used to bind its radio group straight to
 * `declared_status`, so the three options WERE the status values. Insolvency
 * derives the status 'none' ("no concurso on record"), which matched no option:
 * nothing rendered as selected, and confirming wrote 'current' - a declaration
 * that insolvency IS in force, on a company with none. The representative did
 * the right thing and the form recorded the opposite.
 *
 * So the control is now an INTENT - confirm / correct / not applicable - and
 * confirming restores the status the registry derived, whatever that was.
 */
export const UI_MODES = ['confirm', 'correct', 'na'];

export const uiModeFor = (declaredStatus) =>
  declaredStatus === 'corrected' ? 'correct'
  : declaredStatus === 'not_applicable' ? 'na'
  : 'confirm';

// `derivedStatus` is the status the registry produced for this fact before any
// edit - 'current' for most, 'none' for insolvency with no concurso,
// 'not_applicable' where the registry holds nothing.
export const statusForMode = (mode, derivedStatus) =>
  mode === 'correct' ? 'corrected'
  : mode === 'na' ? 'not_applicable'
  : (derivedStatus || 'current');

export const FACT_LABELS = {
  es: {
    representation: 'Representación',
    officers: 'Administradores vigentes',
    address: 'Domicilio social',
    insolvency: 'Situación concursal',
    nif: 'NIF',
    vat_intraeu: 'Registro VIES (operaciones intracomunitarias)',
    operational: 'Sociedad activa y operativa (declaración)',
  },
  en: {
    representation: 'Representation',
    officers: 'Current officers',
    address: 'Registered address',
    insolvency: 'Insolvency status',
    nif: 'NIF (tax identification number)',
    vat_intraeu: 'Intra-EU VAT registration (VIES)',
    operational: 'Active and trading (declaration)',
  },
};

const VALUE_PHRASES = {
  es: { none: 'Sin constancia de concurso', concurso: 'Concurso de acreedores' },
  en: { none: 'No insolvency on record', concurso: 'Insolvency proceeding on record' },
};

export const factLabel = (factKey, lang = 'es') =>
  (FACT_LABELS[lang] || FACT_LABELS.es)[factKey] || factKey;

/**
 * A raw registry token is not a sentence. 'none' rendered verbatim beside
 * "Situación concursal" reads as a shrug rather than as the affirmative
 * statement it is.
 */
export function displayValue(factKey, value, lang = 'es') {
  if (value === null || value === undefined || value === '') return '—';
  if (factKey === 'insolvency') {
    const phrases = VALUE_PHRASES[lang] || VALUE_PHRASES.es;
    return phrases[value] || value;
  }
  return value;
}
