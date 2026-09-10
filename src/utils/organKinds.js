// Which KIND of organ a "Vocal / Comisión" role is held within.
//
// positionCategoryFor answers "what seat is this?" and must never change, since
// seat identity is keyed off it (roleKey.js, and the backend's role_class /
// office_category). This module answers a different question — "is the organ a
// committee OF the board, the board itself, or something that is not a board at
// all?" — which is what display grouping needs and what the category alone
// cannot say. Keeping them apart is deliberate: it is why widening the display
// families cannot collapse two of a person's seats into one.
//
// Under the LSC a board committee (auditoría, nombramientos y retribuciones,
// ejecutiva, delegada, riesgos) is an internal committee OF the consejo, so its
// members must be sitting consejeros. A comisión de CONTROL is not: it is the
// statutory supervisory organ of pension funds and cooperativas de crédito,
// elected by the assembly and explicitly not part of the board. A comisión
// LIQUIDADORA winds a company up, and a comisión de ACREEDORES represents
// creditors in an insolvency. Only the first group are directors.
//
// DEFAULT-DENY. The registry vocabulary carries 543 organ codes, of which ~340
// name ad-hoc committees (COM.GERENCIA, MIEM.COM.FIN, PRE.COM.SCI…) whose
// relation to the board cannot be read off the abbreviation. A code is a
// BOARD_COMMITTEE only when it names a committee we recognise; everything else
// stays OTHER_ORGAN. Guessing in the other direction would assert that someone
// is a director of a company when the registry never said so.
//
// Keep in lockstep with the backend port borme_v3_enricher/organ_kinds.py.
import { positionCategoryFor } from './positionCategories.js';

export const ORGAN_KINDS = Object.freeze({
  /** A committee OF the board — every member is a sitting consejero. */
  BOARD_COMMITTEE: 'BOARD_COMMITTEE',
  /** The governing body itself (consejo rector, junta directiva). */
  GOVERNING_BODY: 'GOVERNING_BODY',
  /** A bare vocal — a consejero holding no special office. */
  PLAIN_VOCAL: 'PLAIN_VOCAL',
  /** Comisión de control — a supervisory organ, NOT the board. */
  CONTROL: 'CONTROL',
  /** Comisión liquidadora — winding-up, not governance. */
  LIQUIDATION: 'LIQUIDATION',
  /** Comisión de acreedores — creditors in an insolvency. */
  CREDITORS: 'CREDITORS',
  /** A seat on an organ held expressly as a NON-consejero (secretario no
   *  consejero de la comisión…). Records the organ, denies the directorship. */
  NON_DIRECTOR_OF_ORGAN: 'NON_DIRECTOR_OF_ORGAN',
  /** An organ role we cannot place. Never treated as a directorship. */
  OTHER_ORGAN: 'OTHER_ORGAN',
});

// "No consejero" / "no miembro" markers: SECR.NO CONS, S.NO.C.CO.EJ,
// SECNOCONCOMD, VS.N/C.C.N.R. The separator requirement on the M/C/COM
// alternatives is load-bearing — without it "NOM" (nombramientos) would match
// and every N&R committee would be read as a denial of board membership.
// "NO EJEC" (no ejecutivo) deliberately does NOT match: a non-executive
// director is still a director.
const NOT_A_DIRECTOR = /NO[\s./]*CON|NO[\s./]+(MI|M\.|C\.|COM)|\bN[./]C[./]/;

// Winding-up and insolvency organs, tested first: a liquidation committee can
// carry an "auditoría" or "control" token without becoming either.
const LIQUIDATION = /LIQ/;
const CREDITORS = /ACREED/;

// Audit is tested BEFORE control, because Spanish listed companies name the
// board's audit committee "Comisión de Auditoría y Control" (COM.AUD.CTRL,
// P.COM.CTRL.R) and "de Auditoría y Cumplimiento" (PRESCOMAUCNT, MIEMCOMAUCUM).
// Those are board committees; a bare comisión de control is not.
const AUDIT = /AUD|AUCNT|AUCUM/;

// The committees the LSC and the good-governance code name, plus the registry's
// abbreviations for them. Deliberately closed: see DEFAULT-DENY above.
const BOARD_COMMITTEE = [
  AUDIT,
  /NOM|NYR|RETRIB|C\.RET|COM\.RET|CMS\.RET|ANR|AYR|NRGC/,  // nombramientos y retribuciones
  /EJEC|EJCR|COM\.EJ|COMS\.EJ|C\.EJ|COMEJ/,                 // ejecutiva
  /RIESG|RIES|COM\.RI|COMS\.RI|C\.RIESGO/,                  // riesgos
  /ESTRATEG|COMS\.EST|COM\.EST/,                            // estrategia
  // Comisión delegada (del consejo). CO.DE.IN is the same committee's other
  // registry spelling — "Comisión Delegada de Inversiones" — and its sibling
  // COMS.DEL.INV is caught by the first alternative, so both must land here or
  // one committee would classify two ways.
  /COM[S]?\.DEL|COMDEL|C\.DEL|CTE\.DEL|CO\.DE\.IN/,
  /GOB|GYR|SOSTE|SOSGC/,                                    // gobierno corporativo / sostenibilidad
];

// The CONSEJO de gobierno is the governing body itself, not the board's
// "comisión de gobierno corporativo". It has to be recognised before the
// committee tokens, or its GOB would be read as the committee. Kept as its own
// pattern rather than a lookbehind on GOB so the Python port can compile it —
// re supports only fixed-width lookbehind.
const CONSEJO_DE_GOBIERNO = /CON[S]?[.\s]?GO/;

// Comisión de control — pension funds, cooperativas de crédito. Reached only
// after AUDIT has had its chance at the "auditoría y control" forms.
const CONTROL = /CONTROL|CTRL|CTR\b|COM\.CTR|COMS\.CTR|CTE\.CON|COM\.CON(?!S)/;

// The governing body itself: consejo rector (cooperativas), junta directiva
// (asociaciones), junta/consejo de administración, consejo de gobierno,
// asamblea. Holding a seat on one of these IS the directorship.
const GOVERNING_BODY = /REC[TG]?\b|\.REC|CON[S]?\.?\s?RE|JTA|JUNTA|JUN\.|J\.DIR|J\.D\b|J\.\s?ADM|JDIR|JT\.DI|ASAMBL|CONADM|CJO|CONS\.GO|CON\.GOB|CONSOCGER|CONSASE/;

// A vocal with no organ named at all: VOCAL, VOCAL 3, VOC.1, VOCAL.PRIMER,
// VOCAL SUPLEN. A vocal IS a consejero — the plainest kind, holding no special
// office. Distinguished from VOC1.CON.REC / VOC.COMS.EJ., which name an organ
// and are classified by it.
const BARE_VOCAL = /^VOC(AL)?[\s.]*(\d+|PRIMER|SEGUND|TERCER|CUARTO|QUINTO|SUPLEN)?[.\s]*$/;

/**
 * The kind of organ a position is held within, or null when the position is
 * not an organ role at all.
 *
 * Strictly a refinement of the "Vocal / Comisión" bucket: anything outside it
 * returns null, so this function can never move a seat between categories.
 *
 * @param {string} pos - raw registry position ("MBRO.COM.AUD", "VOCAL 3").
 * @returns {string|null} a value of ORGAN_KINDS, or null.
 */
export const organKindFor = pos => {
  const p = (pos || '').trim().toUpperCase();
  if (!p) return null;
  if (positionCategoryFor(p) !== 'Vocal / Comisión') return null;

  // A secretary who is expressly NOT a consejero keeps his organ, but the seat
  // says outright that he is not on the board, so it can never imply a
  // directorship. Checked before everything else for exactly that reason.
  if (NOT_A_DIRECTOR.test(p)) return ORGAN_KINDS.NON_DIRECTOR_OF_ORGAN;

  if (LIQUIDATION.test(p)) return ORGAN_KINDS.LIQUIDATION;
  if (CREDITORS.test(p)) return ORGAN_KINDS.CREDITORS;
  if (CONSEJO_DE_GOBIERNO.test(p)) return ORGAN_KINDS.GOVERNING_BODY;
  if (BOARD_COMMITTEE.some(re => re.test(p))) return ORGAN_KINDS.BOARD_COMMITTEE;
  if (CONTROL.test(p)) return ORGAN_KINDS.CONTROL;
  if (GOVERNING_BODY.test(p)) return ORGAN_KINDS.GOVERNING_BODY;
  if (BARE_VOCAL.test(p)) return ORGAN_KINDS.PLAIN_VOCAL;
  return ORGAN_KINDS.OTHER_ORGAN;
};

/**
 * True when holding this role necessarily makes the holder a director: a seat
 * on the governing body itself, a bare vocal, or membership of a committee OF
 * the board (which under the LSC only a sitting consejero may hold).
 */
export const impliesDirectorship = pos => {
  const kind = organKindFor(pos);
  return (
    kind === ORGAN_KINDS.BOARD_COMMITTEE ||
    kind === ORGAN_KINDS.GOVERNING_BODY ||
    kind === ORGAN_KINDS.PLAIN_VOCAL
  );
};
