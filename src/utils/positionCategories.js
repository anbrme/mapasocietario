// Map a raw position string (as stored on link.relationship / officer
// position_normalized, e.g. "APO.SOL", "CON.IND.", "VICEPRESID.",
// "PRECOMAUDIT") to one of ~11 canonical category labels (incl. the dedicated
// Art. 143 RRM organic permanent representative). Shared by the graph
// component (filter chips + simplified mode) and the officer-capping service
// so both classify positions identically. The full vocabulary of registry
// positions lives in src/data/terms.json (officersPositions, ~1045 entries);
// test/position-categories.test.mjs sweeps all of them.
//
// BORME abbreviations are wildly inconsistent (CONSEJERO / CONS. / CONSJ. /
// CON.IND. all mean consejero), so the rules are families of prefixes, with
// one structural rule first: a chair/vice-chair/secretary/member/suplente OF
// an organ (comisión, junta directiva, consejo rector…) is an organ role
// ("Vocal / Comisión"), not a company-level Presidente/Secretario.
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
// NOTE: committee-chair tokens (C.EJ = comité ejecutivo, NOMB/NYR = comisión de
// nombramientos [y retribuciones], spaced "C. AUD" = comité de auditoría,
// ESTRATEG = comisión de estrategia) are included so a chair OF such a committee
// (PTE.C.EJ, PRES.NOMB.RE, PTE. C. AUD.…) is an organ role, NOT the company-level
// apical "Presidente". Bare board-chair forms (PRESIDENTE, PDTE.) carry no organ
// token and stay "Presidente".
const ORGAN_CONTEXT = /COM(?!ISAR|SAR|ISIN)|CMS|CMTE|CTE[.\s]|JTA|JUNTA|JUN[.\s]|J\.\s?DIR|J\.\s?ADM|J\.\s?G|J\.\s?REC|J\.D\b|J\.R\b|JT\.\s?DI|CON[S]?\.?\s?RE[CG]?\b|C\.\s?RE[CT]|C\.PERM|CJO|ASAMBL|CONS\.GO|CON\.GOB|CONADM|CONS\.\s?LIQ|C\.DIR|CO\.E|C\.C\.|C\.D\.|C\.N\.|C\.A\.|CO\.DE|C\.RIESGO|C\.SEGURI|C\.INV|C\.RET|C\.PRO|C\.\s?AUD|C\.EJ|NOMB|NYR|ESTRATEG/;

// Role-prefix shapes that combine with ORGAN_CONTEXT (pre/vice/sec/tes/vocal/
// member/suplente abbreviations, down to single letters like "P.COM.EJEC.").
// PTE/PDTE (presidente del comité/comisión) are here so a committee chair
// resolves via ORGAN_CONTEXT above rather than falling through to "Presidente".
const ORGAN_ROLE_PREFIX = /^(P\b|P\.|PR\b|PR\.|PRE|PRES|PTE|PDTE|V\b|V\.|V-|VP|VPR|VPRE|VPTE|VICE|VIC|VS|VSE|VSEC|VCS|VCP|S\b|S\.|SC|SCR|SCT|SE\.|SEC|VOC|VO\.|VOTI|VOSU|MIE|MIEM|MMBR|MBRO|MRO|M\.|TES|SUPL|SUP\b|SUP\.|VTE|CO\.|COPRE)/;

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

// True when two raw position strings denote the same kind of post (same
// canonical category). Used to attach borme_events_v3 events to the correct
// officer→company link: one officer can hold several roles at one company with
// independent active/ceased status (e.g. an active CONSEJERO and a later-revoked
// APODERADO), so a role's events must never bleed onto another role's link.
// Matching is at category granularity because the two data sources format the
// same role differently (expand-officer "CONS. DELEG." vs events "CON.DELEGADO").
export const sameRoleCategory = (roleA, roleB) =>
  positionCategoryFor(roleA) === positionCategoryFor(roleB);

// Simplified mode ("Simplificar" chip) hides ONLY these categories. This is an
// exclusion list, NOT an admission list: unknown or unmapped positions must
// stay visible, otherwise legitimate roles disappear from the graph (e.g.
// independent directors "CON.IND." on Acerinox were silently dropped when
// unmapped positions fell into a collapsible "Otros").
export const SIMPLIFIED_EXCLUDED_CATEGORIES = new Set(['Apoderado']);
