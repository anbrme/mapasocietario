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
export const UI_MODES = ['confirm', 'correct', 'na', 'declare'];

/**
 * Three kinds of fact, and one control never fitted all three.
 *
 *   registry       derived from BORME, so it can be confirmed or corrected.
 *   declaration    NO registry basis (is_dissolved === false does not establish
 *                  that a company trades). Nothing to confirm - it is either
 *                  declared or left out. Offering "confirm" here restored the
 *                  derived 'not_applicable' and the radio snapped back, so the
 *                  option could not be selected at all.
 *   platform_check WE run it (VIES), the representative cannot attest to it.
 *                  It is shown for transparency and never asked as a question.
 */
export const FACT_KIND = {
  representation: 'registry',
  officers: 'registry',
  address: 'registry',
  insolvency: 'registry',
  nif: 'registry',
  operational: 'declaration',
  vat_intraeu: 'platform_check',
};

export const factKind = (factKey) => FACT_KIND[factKey] || 'registry';

// A declaration needs a value of its own: there is no registry value to carry.
export const DECLARATION_VALUES = { operational: 'active_trading' };

export const uiModeFor = (declaredStatus, factKey) => {
  if (declaredStatus === 'corrected') return 'correct';
  if (declaredStatus === 'not_applicable') return 'na';
  return factKind(factKey) === 'declaration' ? 'declare' : 'confirm';
};

// `derivedStatus` is the status the registry produced for this fact before any
// edit - 'current' for most, 'none' for insolvency with no concurso,
// 'not_applicable' where the registry holds nothing.
export const statusForMode = (mode, derivedStatus) =>
  mode === 'correct' ? 'corrected'
  : mode === 'na' ? 'not_applicable'
  // A declaration asserts something the registry does not hold, so it is
  // 'current' outright - restoring the derived status here (which is
  // 'not_applicable', there being no registry value) made the option inert.
  : mode === 'declare' ? 'current'
  : (derivedStatus || 'current');

// The value a declaration carries when it is made.
export const declarationValueFor = (factKey) => DECLARATION_VALUES[factKey] || null;

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

const DECLARATION_PHRASES = {
  es: { active_trading: 'La sociedad está activa y en funcionamiento' },
  en: { active_trading: 'The company is active and trading' },
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
  const declared = (DECLARATION_PHRASES[lang] || DECLARATION_PHRASES.es)[value];
  return declared || value;
}
