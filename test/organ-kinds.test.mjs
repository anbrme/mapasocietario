import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { positionCategoryFor } from '../src/utils/positionCategories.js';
import { organKindFor, impliesDirectorship, ORGAN_KINDS } from '../src/utils/organKinds.js';

const terms = JSON.parse(
  readFileSync(new URL('../src/data/terms.json', import.meta.url), 'utf8')
);
const ORGAN_CODES = terms.officersPositions.filter(
  p => positionCategoryFor(p) === 'Vocal / Comisión'
);

test('organKindFor is strictly a refinement of the organ bucket', () => {
  // The whole point of a separate module: it may subdivide "Vocal / Comisión"
  // but must never reach a position outside it, so no seat can change category
  // — and therefore no two seats can collapse — because of this function.
  const leaked = terms.officersPositions.filter(
    p => positionCategoryFor(p) !== 'Vocal / Comisión' && organKindFor(p) !== null
  );
  assert.deepEqual(leaked, []);
  assert.equal(organKindFor(''), null);
  assert.equal(organKindFor(null), null);
});

test('every organ code resolves to a known kind', () => {
  const known = new Set(Object.values(ORGAN_KINDS));
  assert.ok(ORGAN_CODES.length > 500, `expected the full organ vocabulary, got ${ORGAN_CODES.length}`);
  for (const pos of ORGAN_CODES) {
    assert.ok(known.has(organKindFor(pos)), pos);
  }
});

test('board committees under the LSC imply a directorship', () => {
  // Membership of a comisión de auditoría / nombramientos y retribuciones /
  // ejecutiva / delegada / riesgos is open only to sitting consejeros, so the
  // seat is itself evidence of board membership. DAGA GELABERT TOMAS's three
  // committee codes at GRIFOLS SA are the regression that started this.
  for (const pos of ['MBRO.COM.AUD', 'SEC.COM.AUD.', 'M.COM.NOM.RE', 'COM. AUDIT.',
                     'PTE.C.EJ', 'MMBR.COM.DEL', 'PRE.C.RIESGO', 'PRECOMAUDIT']) {
    assert.equal(organKindFor(pos), ORGAN_KINDS.BOARD_COMMITTEE, pos);
    assert.equal(impliesDirectorship(pos), true, pos);
  }
});

test('"auditoría y control" / "y cumplimiento" are audit committees, not control commissions', () => {
  // Spanish listed companies name the board's audit committee "Comisión de
  // Auditoría y Control". Testing control before audit would sweep these in
  // with the pension-fund supervisory organs and strip the directorship.
  for (const pos of ['COM.AUD.CTRL', 'PRESCOMAUCNT', 'PRESCOMAUCUM', 'MIEMCOMAUCNT']) {
    assert.equal(organKindFor(pos), ORGAN_KINDS.BOARD_COMMITTEE, pos);
  }
});

test('the comisión de control is NOT a board', () => {
  // Statutory supervisory organ of pension funds and cooperativas de crédito,
  // elected by the assembly. Its members are expressly not board members.
  for (const pos of ['COM.CONTROL', 'PRES.COM.CTR', 'MIEM.COM.CTR', 'MRO.COMS.CTR']) {
    assert.equal(organKindFor(pos), ORGAN_KINDS.CONTROL, pos);
    assert.equal(impliesDirectorship(pos), false, pos);
  }
});

test('winding-up and insolvency organs are not directorships', () => {
  for (const pos of ['COM.LIQ', 'MIEM.COM.LIQ', 'PR.CONS.LIQ']) {
    assert.equal(organKindFor(pos), ORGAN_KINDS.LIQUIDATION, pos);
    assert.equal(impliesDirectorship(pos), false, pos);
  }
  assert.equal(organKindFor('COMS.ACREED.'), ORGAN_KINDS.CREDITORS);
  assert.equal(impliesDirectorship('COMS.ACREED.'), false);
});

test('the governing body itself is a directorship, its non-consejero secretary is not', () => {
  // A consejo rector / junta directiva IS the board of a cooperativa or
  // asociación, so a seat on it is the directorship.
  for (const pos of ['PRE.CONS.REC', 'VOC1.CON.REC', 'MBRO.JTA.DIR', 'PRESID.JUNTA',
                     'PRE.CON.GOB.', 'MBRO.CONS.GO']) {
    assert.equal(organKindFor(pos), ORGAN_KINDS.GOVERNING_BODY, pos);
    assert.equal(impliesDirectorship(pos), true, pos);
  }
  // …but a secretary who is expressly NOT a consejero says so in the code, and
  // that denial outranks the organ. Same distinction SECRENOCONSJ draws at
  // company level.
  for (const pos of ['S.NO CONS.GO', 'S.NO.C.CO.EJ', 'SECNOCONCOMD', 'VS.N/C.C.N.R',
                     'SCR.NO.COM.E', 'S.N.C.C.D.I.']) {
    assert.equal(organKindFor(pos), ORGAN_KINDS.NON_DIRECTOR_OF_ORGAN, pos);
    assert.equal(impliesDirectorship(pos), false, pos);
  }
});

test('the "no consejero" marker never fires on nombramientos', () => {
  // NOM contains NO. Requiring a separator before the M/C/COM alternatives is
  // what keeps every N&R committee from reading as a denial of board membership.
  const nr = ORGAN_CODES.filter(p => /NOM|NYR/.test(p.toUpperCase()));
  assert.ok(nr.length > 10, `expected the N&R family, got ${nr.length}`);
  for (const pos of nr) {
    assert.equal(organKindFor(pos), ORGAN_KINDS.BOARD_COMMITTEE, pos);
  }
  // "No ejecutivo" is not "no consejero" — a non-executive director is a director.
  assert.equal(positionCategoryFor('CONS.NO EJEC'), 'Consejero');
  assert.equal(positionCategoryFor('PRE.NO.EJEC.'), 'Presidente');
});

test('a bare vocal is a plain board member', () => {
  for (const pos of ['VOCAL', 'VOCAL 3', 'VOC.1', 'VOCAL.PRIMER', 'VOCAL SUPLEN']) {
    assert.equal(organKindFor(pos), ORGAN_KINDS.PLAIN_VOCAL, pos);
    assert.equal(impliesDirectorship(pos), true, pos);
  }
  // A vocal OF a named organ is classified by that organ, not as a bare vocal.
  assert.equal(organKindFor('VOC1.CON.REC'), ORGAN_KINDS.GOVERNING_BODY);
  assert.equal(organKindFor('VOC.COMS.EJ.'), ORGAN_KINDS.BOARD_COMMITTEE);
});

test('unrecognised committees are never promoted to directorships (default-deny)', () => {
  // ~40% of the organ vocabulary names ad-hoc committees whose relation to the
  // board cannot be read off the abbreviation. Asserting a directorship from
  // one would put a person on a board the registry never placed them on, so
  // the residual bucket must stay non-empty AND stay out of impliesDirectorship.
  const other = ORGAN_CODES.filter(p => organKindFor(p) === ORGAN_KINDS.OTHER_ORGAN);
  assert.ok(other.length > 100, `default-deny residue collapsed to ${other.length}`);
  for (const pos of other) assert.equal(impliesDirectorship(pos), false, pos);
  for (const pos of ['COM.GERENCIA', 'PRE.COM.SCI', 'MIEM.COM.FIN', 'COMS.VIGILAN']) {
    assert.equal(organKindFor(pos), ORGAN_KINDS.OTHER_ORGAN, pos);
  }
});

test('CO.DE.MA.SO never reaches this module', () => {
  // It is an office (Consejero Delegado Mancomunado y Solidario), so it left
  // the organ bucket entirely — the guard that this module only refines.
  assert.equal(organKindFor('CO.DE.MA.SO'), null);
  // Its lookalikes are genuine Comisión Delegada de Inversiones seats, and
  // must classify the same way as that committee's other spelling.
  assert.equal(organKindFor('P.CO.DE.IN'), ORGAN_KINDS.BOARD_COMMITTEE);
  assert.equal(organKindFor('COMS.DEL.INV'), ORGAN_KINDS.BOARD_COMMITTEE);
});
