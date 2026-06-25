export const POSITION_CATEGORY_ORDER = [
  'Presidente',
  'Vicepresidente',
  'Consejero',
  'Administrador',
  'Representante 143 RRM',
  'Secretario',
  'Liquidador',
  'Vocal / Comisión',
  'Apoderado',
  'Auditor',
  'Otros',
];

// Tokens marking that the role is held within an organ (comisión, comité,
// junta, consejo rector, asamblea). COM(?!ISAR|SAR|ISIN) keeps COMISARIO /
// COMSARIO / COMISINOBLI (bondholder-syndicate trustees) out — those are
// "Otros", not commission members.
const ORGAN_CONTEXT = /COM(?!ISAR|SAR|ISIN)|CMS|CMTE|CTE[.\s]|JTA|JUNTA|JUN[.\s]|J\.\s?DIR|J\.\s?ADM|J\.\s?G|J\.\s?REC|J\.D\b|J\.R\b|JT\.\s?DI|CON[S]?\.?\s?RE[CG]?\b|C\.\s?RE[CT]|C\.PERM|CJO|ASAMBL|CONS\.GO|CON\.GOB|CONADM|CONS\.\s?LIQ|C\.DIR|CO\.E|C\.C\.|C\.D\.|C\.N\.|C\.A\.|CO\.DE|C\.RIESGO|C\.SEGURI|C\.INV|C\.RET|C\.PRO|C\.AUD/;

// Role-prefix shapes that combine with ORGAN_CONTEXT (pre/vice/sec/tes/vocal/
// member/suplente abbreviations, down to single letters like "P.COM.EJEC.").
const ORGAN_ROLE_PREFIX = /^(P\b|P\.|PR\b|PR\.|PRE|PRES|V\b|V\.|V-|VP|VPR|VPRE|VPTE|VICE|VIC|VS|VSE|VSEC|VCS|VCP|S\b|S\.|SC|SCR|SCT|SE\.|SEC|VOC|VO\.|VOTI|VOSU|MIE|MIEM|MMBR|MBRO|MRO|M\.|TES|SUPL|SUP\b|SUP\.|VTE|CO\.|COPRE)/;

export const positionCategoryFor = pos => {
  const p = (pos || '').trim().toUpperCase();
  if (!p) return 'Otros';

  // Organ roles first — except consejero/presidente titles, which stay
  // company-level even when the abbreviation mentions an organ (CON.DEL.COM.,
  // PRESIDENTE...). Bare commission names used as the cargo ("COM. AUDIT.",
  // "COMS.SEGUIM.") and fused chair/secretary forms (PRECOMAUDIT, SECOAUDI)
  // are organ roles too.
  if (/^COMS?[.\s]/.test(p)) return 'Vocal / Comisión';
  if (/^(PRE|SEC|VP|VS)CO/.test(p)) return 'Vocal / Comisión';
  if (
    ORGAN_CONTEXT.test(p) &&
    ORGAN_ROLE_PREFIX.test(p) &&
    !/^(CONSEJER|CONSJ|CONS\.\s?DEL|CON\.DEL|PRESIDENT)/.test(p)
  ) {
    return 'Vocal / Comisión';
  }

  if (/^(PRESIDENT|PDTE|PTE\b|PTE\.|PRES|PRESID|COPRE)/.test(p)) return 'Presidente';
  if (/^(VICEPRESIDEN|VICEPRESID|VICEPRESI|VICEPRE|VICEPR|VICPRES|VICPTE|VICEPTE|VPDTE|V-PRE|VPRE|VPTE)/.test(p)) return 'Vicepresidente';
  if (/^(CONSEJER|CONSEJ|CONSJ|CONS[.\s]|CON\.)/.test(p)) return 'Consejero';
  if (/^(ADMINISTRADOR|ADMINISTRAD|ADMINISTR|ADMIN|ADM[.\s]|ADMR|ADMOR|ADMPROV)/.test(p)) return 'Administrador';
  if (/^(SECRETARI|SECRET|SECRE|SECR|SEC[.\s]|SRIO|VICESECRETAR|VICESECRET|VICESEC|VICSEC|VSECR|VSEC|VCSEC|V-SEC|SCR|SCRT)/.test(p)) return 'Secretario';
  if (/^(LIQUIDADOR|LIQUID|LIQ[.\s])/.test(p)) return 'Liquidador';
  if (/^VOC(AL|[\d.])/.test(p)) return 'Vocal / Comisión';
  if (/^(MIE|MIEM|MMBR|MBRO|MRO|M)\.?COM/.test(p)) return 'Vocal / Comisión';
  if (/^(AUDITOR|AUDIT|AUDT|AUD[.\s]|COAUD|CO-AUD)/.test(p)) return 'Auditor';
  // Art. 143 RRM organic *permanent* physical representative that a CORPORATE
  // administrator must designate to exercise the post — administrator-level,
  // NOT a voluntary power. Forms: "REPR.143 RRM", "R.L.C.PERMA./PER.S./PER.M."
  // (representante legal con carácter permanente), "REPR.PERMAN.". Generic /
  // voluntary reps (REPRESENTAN, REPRE.FISCAL, REPR.SUCURS., REP.SUC.,
  // REPRESSUPLEN) deliberately fall through to Otros.
  if (/143/.test(p) || /^R\.?L\.?C/.test(p) || /^REPR\.?\s?PERMAN/.test(p)) {
    return 'Representante 143 RRM';
  }
  // DTOR.APO.SUC = director apoderado de sucursal — apoderado variant.
  if (/^(APO|APD)/.test(p) || /^DTOR\.APO/.test(p)) return 'Apoderado';
  return 'Otros';
};

export const BOARD_CATEGORIES = new Set([
  'Presidente', 'Vicepresidente', 'Consejero', 'Administrador',
  'Representante 143 RRM', 'Secretario', 'Liquidador',
]);
export const isBoardPosition = (pos) => BOARD_CATEGORIES.has(positionCategoryFor(pos));
