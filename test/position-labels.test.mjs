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
  assert.equal(positionLabelFor('PRE.COM.FVS'), 'Presidente de una comisión (PRE.COM.FVS)');
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
  // CONS.EXT.DOM used to be returned untouched for want of an expansion. It is
  // composed now — EXT and DOM are the CNMV's own consejero classes, read off
  // the abbreviation rather than guessed.
  assert.equal(positionLabelFor('CONS.EXT.DOM'), 'Consejero externo dominical');
  // The principle still holds where the abbreviation is not readable: nothing
  // is claimed and the registry's own text is kept.
  assert.equal(positionLabelFor('ENT.REG.CONT'), 'ENT.REG.CONT');
  assert.equal(positionLabelFor(''), '');
  assert.equal(positionLabelFor(null), '');
});

test('English labels read as English', () => {
  assert.equal(positionLabelFor('MBRO.COM.AUD', 'en'), 'Member, Audit Committee');
  assert.equal(positionLabelFor('PRE.CONS.REC', 'en'), 'Chair, Governing Council');
  assert.equal(positionLabelFor('PRE.COM.FVS', 'en'), 'Chair of a committee (PRE.COM.FVS)');
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

test('the SCI committee is named from its BORME expansion', () => {
  // Comisión de Seguimiento y Control de las Inversiones, read from the BORME
  // (BORME-A-2026-81-28). Our own vocabulary corroborates that it is a
  // committee OF the board rather than an outside organ: the registry also
  // publishes CONS.COM.SCI — a consejero who sits on it — so its president is
  // a sitting director and belongs in the board's committee section, not in
  // the default-deny residue.
  assert.equal(positionLabelFor('PRE.COM.SCI'),
    'Presidente de la Comisión de Seguimiento y Control de las Inversiones');
  assert.equal(positionLabelFor('PRE.COM.SCI.'),
    'Presidente de la Comisión de Seguimiento y Control de las Inversiones');
  assert.equal(positionLabelFor('PRE.COM.SCI', 'en'),
    'Chair, Investment Monitoring and Control Committee');
});

// ---------------------------------------------------------------------------
// Non-organ cargos: the office plus whatever the abbreviation qualifies it with.
//
// The board table printed these verbatim — "ADM. SOLID.", "CONS.INDEPEN" — next
// to composed labels like "Consejero ejecutivo", so half the column shouted in
// capitals and half read as prose. 41.2% of the corpus's 9.9M seat rows had no
// prose name, led by ADM. SOLID. at 1.14M on its own.
//
// Composed, not tabulated, for the reason the organ labels are: the registry
// spells one office many ways (ADM. UNICO / ADM.UNICO, ADM. MANCOM. /
// ADM.CONJUNTO) and the exact-match OVERRIDES table caught only the spelling
// someone had happened to write down. The CATEGORY is already a truthful label,
// so the worst case is the bare office — never a raw code, never an invention.
// ---------------------------------------------------------------------------

test('administrador variants read as prose whatever the spelling', () => {
  for (const code of ['ADM. UNICO', 'ADM.UNICO', 'ADM. UNIC.']) {
    assert.equal(positionLabelFor(code, 'es'), 'Administrador único', code);
  }
  for (const code of ['ADM. SOLID.', 'ADM.SOLIDAR.', 'ADM. SOLIDARIO']) {
    assert.equal(positionLabelFor(code, 'es'), 'Administrador solidario', code);
  }
  for (const code of ['ADM. MANCOM.', 'ADM.CONJUNTO']) {
    assert.equal(positionLabelFor(code, 'es'), 'Administrador mancomunado', code);
  }
  assert.equal(positionLabelFor('ADM.CONCURS.', 'es'), 'Administrador concursal');
  assert.equal(positionLabelFor('ADMINISTR.', 'es'), 'Administrador');
});

test('apoderado variants read as prose', () => {
  for (const code of ['APO.SOL.', 'APODERAD.SOL']) {
    assert.equal(positionLabelFor(code, 'es'), 'Apoderado solidario', code);
  }
  for (const code of ['APO.MANC.', 'APOD.MANCOMU']) {
    assert.equal(positionLabelFor(code, 'es'), 'Apoderado mancomunado', code);
  }
  assert.equal(positionLabelFor('APODERADO', 'es'), 'Apoderado');
});

test('the consejero classes the board table shows', () => {
  assert.equal(positionLabelFor('CONS.INDEPEN', 'es'), 'Consejero independiente');
  assert.equal(positionLabelFor('CONS.DOMINIC', 'es'), 'Consejero dominical');
  assert.equal(positionLabelFor('CONS.EJECUTI', 'es'), 'Consejero ejecutivo');
  assert.equal(positionLabelFor('CONS.DEL.SOL', 'es'), 'Consejero delegado solidario');
  assert.equal(positionLabelFor('CONS.DEL.MAN', 'es'), 'Consejero delegado mancomunado');
  assert.equal(positionLabelFor('CONS. DELEG.', 'es'), 'Consejero delegado');
  assert.equal(positionLabelFor('CONS.', 'es'), 'Consejero');
});

test('a qualifier stack reads in Spanish order', () => {
  assert.equal(positionLabelFor('CONS.EXT.IND', 'es'), 'Consejero externo independiente');
  assert.equal(positionLabelFor('CONS.EXT.DOM', 'es'), 'Consejero externo dominical');
  assert.equal(positionLabelFor('CONS.NO EJEC', 'es'), 'Consejero no ejecutivo');
});

test('auditor, liquidador, secretario and the 143 RRM representative', () => {
  assert.equal(positionLabelFor('AUD.SUPL.', 'es'), 'Auditor suplente');
  assert.equal(positionLabelFor('LIQUID.MANC.', 'es'), 'Liquidador mancomunado');
  assert.equal(positionLabelFor('VICEPRESID.', 'es'), 'Vicepresidente');
  assert.match(positionLabelFor('REPR.143 RRM', 'es'), /^Representante/);
});

test('an office we cannot place keeps its code rather than inventing one', () => {
  // Category 'Otros' with an abbreviation we cannot read: nothing is claimed.
  for (const code of ['ENT.REG.CONT', 'REP.ADM.CONC']) {
    assert.equal(positionLabelFor(code, 'es'), code, code);
  }
});

test('an abbreviation is never sentence-cased into a word that does not exist', () => {
  // 'LIQUISOLI' -> 'Liquisoli' and 'REPRESENTAN' -> 'Representan' read worse
  // than the code. These carry 62,026 and 110,532 seat rows.
  assert.equal(positionLabelFor('LIQUISOLI', 'es'), 'Liquidador solidario');
  assert.equal(positionLabelFor('REPRESENTAN', 'es'), 'Representante');
  assert.equal(positionLabelFor('SOC.PROF.', 'es'), 'Socio profesional');
});

test('nothing in the board vocabulary still renders as a shouted code', () => {
  const shouty = ['ADM. SOLID.', 'ADM.UNICO', 'APO.SOL.', 'CONS.INDEPEN',
                  'CONS.DOMINIC', 'CONS.DEL.SOL', 'VICESECRET.'];
  for (const code of shouty) {
    const label = positionLabelFor(code, 'es');
    assert.notEqual(label, code, code);
    assert.ok(/^[A-ZÁÉÍÓÚÑ][a-zá-úñ]/.test(label), `${code} -> ${label}`);
  }
});

test('English labels compose too', () => {
  assert.equal(positionLabelFor('ADM. SOLID.', 'en'), 'Director (joint and several)');
  assert.equal(positionLabelFor('CONS.INDEPEN', 'en'), 'Director (independent)');
});

test('the Spanish preposition "del" is not a delegation', () => {
  // "SECRETARIO DEL CONSEJO DE ADMINISTRACION" read as "Secretario delegado",
  // asserting a delegation the registry never recorded. Ten codes did this.
  assert.equal(positionLabelFor('SECRETARIO DEL CONSEJO', 'es'), 'Secretario');
  assert.equal(positionLabelFor('PRESIDENTE DEL CONSEJO DE ADMINISTRACION', 'es'), 'Presidente');
  assert.equal(positionLabelFor('VICEPRESIDENTE DEL CONSEJO DE ADMINISTRACION', 'es'), 'Vicepresidente');
  // …while the real delegations are untouched.
  assert.equal(positionLabelFor('CON.DELEGADO', 'es'), 'Consejero delegado');
  assert.equal(positionLabelFor('CONS.DEL.SOL', 'es'), 'Consejero delegado solidario');
  assert.equal(positionLabelFor('CONS. DELEG.', 'es'), 'Consejero delegado');
});

test('a vice- office keeps its vice', () => {
  // These classify as category 'Secretario', so composing from the category
  // alone demoted them: 15,680 rows of VICESECRET. read as "Secretario".
  assert.equal(positionLabelFor('VICESECRET.', 'es'), 'Vicesecretario');
  assert.equal(positionLabelFor('VICESECRETARIO', 'es'), 'Vicesecretario');
  assert.equal(positionLabelFor('VSECRNOCONSJ', 'es'), 'Vicesecretario no consejero');
  assert.equal(positionLabelFor('VICESECRET.', 'en'), 'Deputy secretary');
  // A plain secretary is still a plain secretary.
  assert.equal(positionLabelFor('SECRETARIO', 'es'), 'Secretario');
});
