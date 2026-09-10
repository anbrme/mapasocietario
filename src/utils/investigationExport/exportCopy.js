// Strings for the exported situation-report file. It is a standalone document
// with no access to the app's `text` object, so its copy lives here.
//
// NAMING IS FIXED: "Informe de situación" / "Situation report". The medium is
// never part of the name — see the spec. An informe de situación is a genre in
// which the author is the authority, which is precisely this artefact's status;
// that is what makes it non-authoritative without a disclaimer doing the work.

const ES = {
  title: 'Informe de situación',
  subject: 'Asunto',
  generated: 'Generado el',
  nonAuthoritative: 'Documento no autoritativo — redactado por su autor, no por el registro.',
  sourceLine: 'Datos derivados del BORME (Registro Mercantil). Las notas son del autor de este informe.',
  summaryNote: 'Resumen',
  flagged: 'Señalado',
  companies: 'Empresas analizadas',
  connections: 'Conexiones compartidas',
  ownership: 'Vínculos de propiedad',
  otherNotes: 'Otras notas',
  corrections: 'Correcciones aplicadas por el autor',
  none: 'Ninguna detectada',
  person: 'Persona / entidad',
  inCompanies: 'Empresas',
  role: 'Cargo',
  status: 'Estado',
  active: 'Vigente',
  ceased: 'Cesado',
  mixed: 'Mixto',
  entity: 'Entidad',
  individual: 'Persona',
  walkthrough: 'Recorrido',
  next: 'Siguiente',
  prev: 'Anterior',
  exit: 'Salir del recorrido',
  soleOf: 'es socio único de',
  lostOf: 'fue socio único de',
  actionHide: 'ocultado',
  actionMerge: 'unificado con',
  actionResigned: 'marcado como cesado',
  actionActive: 'marcado como vigente',
  backLink: 'Ver en Mapa Societario',
};

const EN = {
  title: 'Situation report',
  subject: 'Subject',
  generated: 'Generated',
  nonAuthoritative: 'Non-authoritative document — written by its author, not by the registry.',
  sourceLine: 'Data derived from BORME (Registro Mercantil). The notes are the author’s own.',
  summaryNote: 'Summary',
  flagged: 'Flagged',
  companies: 'Companies analysed',
  connections: 'Shared connections',
  ownership: 'Ownership links',
  otherNotes: 'Other notes',
  corrections: 'Corrections applied by the author',
  none: 'None detected',
  person: 'Person / entity',
  inCompanies: 'Companies',
  role: 'Role',
  status: 'Status',
  active: 'Active',
  ceased: 'Ceased',
  mixed: 'Mixed',
  entity: 'Entity',
  individual: 'Person',
  walkthrough: 'Walkthrough',
  next: 'Next',
  prev: 'Previous',
  exit: 'Exit walkthrough',
  soleOf: 'is sole shareholder of',
  lostOf: 'was sole shareholder of',
  actionHide: 'hidden',
  actionMerge: 'merged into',
  actionResigned: 'marked as ceased',
  actionActive: 'marked as active',
  backLink: 'View on Mapa Societario',
};

export const EXPORT_COPY_KEYS = Object.freeze(Object.keys(ES));

export const exportCopy = (lang) => (lang === 'en' ? EN : ES);

// Shared action-verb mapping for a correction entry, used everywhere a
// correction is rendered (export file, Copy-for-Word, and the in-app
// preview) so the three stay in sync. Returns the raw (unescaped) verb —
// callers own escaping so it happens exactly once.
const CORRECTION_VERB_KEYS = {
  hide: 'actionHide',
  merge: 'actionMerge',
  mark_resigned: 'actionResigned',
  mark_active: 'actionActive',
};

export const correctionVerb = (t, action) => (
  CORRECTION_VERB_KEYS[action] ? t[CORRECTION_VERB_KEYS[action]] : action
);
