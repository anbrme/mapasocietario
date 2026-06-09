import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  positionCategoryFor,
  SIMPLIFIED_EXCLUDED_CATEGORIES,
  POSITION_CATEGORY_ORDER,
} from '../src/utils/positionCategories.js';

const terms = JSON.parse(
  readFileSync(new URL('../src/data/terms.json', import.meta.url), 'utf8')
);

test('consejero abbreviations map to Consejero (Acerinox + Telefónica regressions)', () => {
  // Real positions returned by the backend that earlier whitelists sent to
  // "Otros": CON.IND. (Acerinox independent directors), CONSJ.DOMINI
  // (Telefónica consejero dominical — also the cessation title that left
  // resigned directors looking active).
  for (const pos of ['Con.Ind.', 'CON.IND.', 'CON.INDEPEND', 'CON.INTERIN.', 'CON.DEL.MANC', 'CON.DELEGADO', 'CONS.EXT.DOM', 'CONS.EXT.IND', 'CONS. IDPTE.', 'CONSEJERO', 'CONSJ.DOMINI', 'CONSJ.SUPL.', 'CONSEJ.COORD', 'CONSEJSUPLEN']) {
    assert.equal(positionCategoryFor(pos), 'Consejero', pos);
  }
});

test('board-family abbreviations map to their categories (Telefónica regression)', () => {
  // VICEPRESID. is how BORME abbreviates Telefónica's vice-presidents; the
  // old rules missed it, so the vicepresidente sank to "Otros"/tier 7 and was
  // buried below comisión members in every category-driven surface.
  const cases = {
    'VICEPRESID.': 'Vicepresidente',
    'VICEPRESI.1º': 'Vicepresidente',
    'VICEPR.2': 'Vicepresidente',
    'VPDTE': 'Vicepresidente',
    'PRESIDENTE': 'Presidente',
    'PRES.EJECUT.': 'Presidente',
    'COPRESIDENTE': 'Presidente',
    'ADMIN.UNICO': 'Administrador',
    'ADMINISTRAD': 'Administrador',
    'ADM. SOLID.': 'Administrador',
    'SECRE.CONSEJ': 'Secretario',
    'VICESECRETAR': 'Secretario',
    'LIQUIDADOR': 'Liquidador',
    'AUDIT.CUENT.': 'Auditor',
    'COAUDITOR': 'Auditor',
  };
  for (const [pos, want] of Object.entries(cases)) {
    assert.equal(positionCategoryFor(pos), want, pos);
  }
});

test('comisión / junta organ roles map to Vocal / Comisión', () => {
  // Chairs, vice-chairs, secretaries, members and suplentes OF an organ
  // (comisión, junta directiva, consejo rector) are organ roles, not
  // company-level Presidente/Secretario.
  for (const pos of ['MMBR.COM.DEL', 'MIE.COM.PER.', 'PRE.COM.AUDI', 'PRECOMAUDIT', 'VPRE.COM.O.S', 'V-SEC.COMS.E', 'VOC1.JTA.DIR', 'VOC.1', 'VOCAL', 'SUPL.CJO.ADM', 'COM. AUDIT.', 'COMS.SEGUIM.', 'TES.J.DIR.']) {
    assert.equal(positionCategoryFor(pos), 'Vocal / Comisión', pos);
  }
});

test('apoderado variants map to Apoderado', () => {
  for (const pos of ['APODERADO', 'APO.SOL.', 'Apo.Man.Soli', 'APOD.MANCOMU', 'APD.SOL', 'DTOR.APO.SUC']) {
    assert.equal(positionCategoryFor(pos), 'Apoderado', pos);
  }
});

test('simplified mode excludes ONLY the Apoderado category', () => {
  assert.deepEqual([...SIMPLIFIED_EXCLUDED_CATEGORIES], ['Apoderado']);
  // Auditors, unknown roles, and everything else must survive simplification.
  for (const pos of ['AUDITOR', 'COMISARIO', 'COMISINOBLI', 'CON.IND.', 'VICEPRESID.', 'VOCAL', '']) {
    assert.equal(
      SIMPLIFIED_EXCLUDED_CATEGORIES.has(positionCategoryFor(pos)),
      false,
      pos
    );
  }
});

test('comisario (bondholder trustee) is NOT a comisión role', () => {
  for (const pos of ['COMISARIO', 'COMISAR.SI.B', 'COMSARIO.CTA', 'COMISINOBLI']) {
    assert.equal(positionCategoryFor(pos), 'Otros', pos);
  }
});

test('no CON-prefixed registry position falls through to Otros', () => {
  const leaks = terms.officersPositions
    .filter(p => /^CONS?J?[.\s]/i.test(p) || /^CONSEJ/i.test(p))
    .filter(p => positionCategoryFor(p) !== 'Consejero');
  assert.deepEqual(leaks, []);
});

test('every registry position maps to a known category', () => {
  const known = new Set(POSITION_CATEGORY_ORDER);
  for (const p of terms.officersPositions) {
    assert.ok(known.has(positionCategoryFor(p)), p);
  }
});

test('Otros stays a small residual bucket (coverage regression guard)', () => {
  const otros = terms.officersPositions.filter(p => positionCategoryFor(p) === 'Otros');
  // 699/1045 fell to Otros before the 2026-06-10 rework; the rework brought it
  // under 300 (socios, asesores, comisarios, directores, tesoreros…). If this
  // creeps up, prefix coverage regressed.
  assert.ok(otros.length < 300, `Otros has ${otros.length} entries`);
});
