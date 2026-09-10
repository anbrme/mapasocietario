import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { positionLabelFor } from '../src/utils/positionLabels.js';
import { organKindFor, ORGAN_KINDS } from '../src/utils/organKinds.js';

const terms = JSON.parse(
  readFileSync(new URL('../src/data/terms.json', import.meta.url), 'utf8')
);
const ORGAN_CODES = terms.officersPositions.filter(p => organKindFor(p));

test('committee seats compose into a readable label', () => {
  // DAGA GELABERT TOMAS's three committee codes at GRIFOLS SA.
  assert.equal(positionLabelFor('MBRO.COM.AUD'), 'Miembro de la Comisión de Auditoría');
  assert.equal(positionLabelFor('SEC.COM.AUD.'), 'Secretario de la Comisión de Auditoría');
  assert.equal(positionLabelFor('M.COM.NOM.RE'),
    'Miembro de la Comisión de Nombramientos y Retribuciones');
  // Composition, not a lookup table: a dozen spellings of one committee all work.
  for (const pos of ['PRECOMAUDIT', 'PTE. C. AUD.', 'PRE.COMS.AUD', 'PRE.COM.AUD.']) {
    assert.equal(positionLabelFor(pos), 'Presidente de la Comisión de Auditoría', pos);
  }
});

test('adjectival committee names take no "de"', () => {
  assert.equal(positionLabelFor('PTE.C.EJ'), 'Presidente de la Comisión Ejecutiva');
  assert.equal(positionLabelFor('MMBR.COM.DEL'), 'Miembro de la Comisión Delegada');
  assert.equal(positionLabelFor('PRE.C.RIESGO'), 'Presidente de la Comisión de Riesgos');
});

test('the article agrees with the organ’s gender', () => {
  assert.equal(positionLabelFor('PRE.CONS.REC'), 'Presidente del Consejo Rector');
  assert.equal(positionLabelFor('MBRO.JTA.DIR'), 'Miembro de la Junta Directiva');
  assert.equal(positionLabelFor('PRESASAMBL'), 'Presidente de la Asamblea');
  // Junta Rectora and Consejo Rector both exist and differ in gender.
  assert.equal(positionLabelFor('PRE.JTA.RECT'), 'Presidente de la Junta Rectora');
});

test('an unnameable committee keeps its code and claims nothing', () => {
  // ~200 organ codes name ad-hoc committees we have no source for. Inventing an
  // expansion would put words in the registry's mouth; the role is still
  // readable, and the code lets a reader check the BORME entry.
  assert.equal(positionLabelFor('PRE.COM.SCI'), 'Presidente de una comisión (PRE.COM.SCI)');
  assert.equal(positionLabelFor('COM.GERENCIA'), 'Comisión (COM.GERENCIA)');
  assert.equal(positionLabelFor('MIEM.COM.FIN'), 'Miembro de una comisión (MIEM.COM.FIN)');
});

test('organs that are not board committees are named as what they are', () => {
  assert.equal(positionLabelFor('COM.CONTROL'), 'Comisión de Control');
  assert.equal(positionLabelFor('MIEM.COM.LIQ'), 'Miembro de la Comisión Liquidadora');
  assert.equal(positionLabelFor('COMS.ACREED.'), 'Comisión de Acreedores');
});

test('a bare vocal carries its ordinal, not an organ', () => {
  assert.equal(positionLabelFor('VOCAL'), 'Vocal');
  assert.equal(positionLabelFor('VOCAL 8'), 'Vocal 8');
  assert.equal(positionLabelFor('VOCAL SUPLEN'), 'Vocal suplente');
});

test('non-organ positions keep the overrides and are never invented', () => {
  assert.equal(positionLabelFor('CONS.EXTERNO'), 'Consejero externo');
  assert.equal(positionLabelFor('CONS.EXTERNO', 'en'), 'Non-executive director');
  assert.equal(positionLabelFor('CO.DE.MA.SO'), 'Consejero delegado mancomunado y solidario');
  // A single all-caps word is the word, only shouting — sentence case is
  // formatting, not interpretation.
  assert.equal(positionLabelFor('APODERADO'), 'Apoderado');
  assert.equal(positionLabelFor('AUDITOR'), 'Auditor');
  // An abbreviation we have no expansion for is returned untouched.
  assert.equal(positionLabelFor('CONS.EXT.DOM'), 'CONS.EXT.DOM');
  assert.equal(positionLabelFor(''), '');
  assert.equal(positionLabelFor(null), '');
});

test('English labels read as English', () => {
  assert.equal(positionLabelFor('MBRO.COM.AUD', 'en'), 'Member, Audit Committee');
  assert.equal(positionLabelFor('PRE.CONS.REC', 'en'), 'Chair, Governing Council');
  assert.equal(positionLabelFor('PRE.COM.SCI', 'en'), 'Chair of a committee (PRE.COM.SCI)');
});

test('no composed label leaks a raw abbreviation, and every role is read', () => {
  // A label that silently drops the role (VICPRE.J.REC once rendered as bare
  // "Consejo Rector") is worse than the code it replaced.
  const leaky = ORGAN_CODES.filter(p => {
    const label = positionLabelFor(p);
    return !label.includes('(') && /[A-Z]{2,}\./.test(label);
  });
  assert.deepEqual(leaky, [], 'composed labels must not contain an abbreviation');

  for (const pos of ['VICPRE.J.REC', 'VCP.CONS.REC', 'V-PR.S.JTA.D', 'V-TESR.JTA.T']) {
    assert.match(positionLabelFor(pos), /^(Vicepresidente|Vicetesorero)/, pos);
  }
});

test('every organ code yields a non-empty label', () => {
  assert.ok(ORGAN_CODES.length > 500);
  for (const pos of ORGAN_CODES) {
    const label = positionLabelFor(pos);
    assert.ok(label && label.length > 0, pos);
    // Where we cannot name the organ we must show the code verbatim.
    if (label.includes('(')) assert.ok(label.includes(pos), pos);
  }
});
