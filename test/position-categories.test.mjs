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

test('consejero abbreviations map to Consejero (Acerinox regression)', () => {
  // Real positions returned by the backend for ACERINOX SA that the old
  // whitelist sent to "Otros" and Simplificar then hid.
  for (const pos of ['Con.Ind.', 'CON.IND.', 'CON.INDEPEND', 'CON.INTERIN.', 'CON.DEL.MANC', 'CON.DELEGADO', 'CONS.EXT.DOM', 'CONS.EXT.IND', 'CONS. IDPTE.', 'CONSEJERO']) {
    assert.equal(positionCategoryFor(pos), 'Consejero', pos);
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
  for (const pos of ['AUDITOR', 'COMISARIO', 'COMISINOBLI', 'CON.IND.', 'VOCAL', '']) {
    assert.equal(
      SIMPLIFIED_EXCLUDED_CATEGORIES.has(positionCategoryFor(pos)),
      false,
      pos
    );
  }
});

test('no CON-prefixed registry position falls through to Otros', () => {
  const leaks = terms.officersPositions
    .filter(p => /^CONS?\./i.test(p) || /^CONSEJERO/i.test(p) || /^CONS /i.test(p))
    .filter(p => positionCategoryFor(p) !== 'Consejero');
  assert.deepEqual(leaks, []);
});

test('every registry position maps to a known category', () => {
  const known = new Set(POSITION_CATEGORY_ORDER);
  for (const p of terms.officersPositions) {
    assert.ok(known.has(positionCategoryFor(p)), p);
  }
});
