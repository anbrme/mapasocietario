import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  officerGroupFor,
  groupOfficersForDisplay,
  collapseGroupByPerson,
  OFFICER_GROUP_ORDER,
  BOARD_CATEGORIES,
} from '../src/utils/officerGroups.js';

// Twin of ncdata-bormes/tests_officer_display_groups.py — the two legs were
// verified to agree on all 1,044 registry codes when this landed.

test('board committees get their own section', () => {
  for (const pos of ['MBRO.COM.AUD', 'SEC.COM.AUD.', 'M.COM.NOM.RE',
                     'MMBR.COM.DEL', 'PTE.C.EJ', 'PRE.C.RIESGO']) {
    assert.equal(officerGroupFor(pos), 'comisiones', pos);
  }
});

test('a bare vocal and the governing body itself are board seats', () => {
  // A vocal is a consejero holding no special office; a consejo rector or junta
  // directiva IS the board of a cooperativa or asociación. Routing either to
  // the committee section left plain board members off the board table.
  for (const pos of ['VOCAL', 'VOCAL 3', 'VOC.1', 'VOCAL.PRIMER',
                     'PRE.CONS.REC', 'VOC1.CON.REC', 'MBRO.JTA.DIR', 'PRESID.JUNTA']) {
    assert.equal(officerGroupFor(pos), 'consejo', pos);
  }
});

test('organs that are not boards never reach the board table', () => {
  // These fold into the BOARD seat like every organ role, so intercepting them
  // is the only thing keeping their holders from being reported as directors.
  for (const pos of ['COM.CONTROL', 'PRES.COM.CTR', 'MIEM.COM.LIQ', 'COM.LIQ',
                     'COMS.ACREED.', 'S.NO CONS.GO', 'SECNOCONCOMD']) {
    assert.equal(officerGroupFor(pos), 'otros', pos);
  }
});

test('unrecognised committees stay in the committee section (default-deny)', () => {
  for (const pos of ['COM.GERENCIA', 'PRE.COM.FVS', 'MIEM.COM.FIN']) {
    assert.equal(officerGroupFor(pos), 'comisiones', pos);
  }
});

test('non-organ roles group by category', () => {
  const cases = {
    'CONS.OTR.EXT': 'consejo',
    'CO.DE.MA.SO': 'consejo',
    'PRESIDENTE': 'consejo',
    'ADM. UNICO': 'consejo',
    'APODERADO': 'auditoria_representantes',
    'AUDITOR': 'auditoria_representantes',
    'REPR.143 RRM': 'auditoria_representantes',
    'SECRETARIO': 'otros',
    'DIRECTOR GENERAL': 'direccion',
  };
  for (const [pos, want] of Object.entries(cases)) {
    assert.equal(officerGroupFor(pos), want, pos);
  }
});

test('a liquidador delegado is winding the company up, not running it', () => {
  // The bare DELEGAD token also matches LIQ.DELEGADO. Gating the executive
  // token check on the 'Otros' category is what keeps it out of Dirección.
  assert.equal(officerGroupFor('LIQ.DELEGADO'), 'otros');
  assert.equal(officerGroupFor('DELEGADO'), 'direccion');
});

test('the board category set is overridable without touching organ routing', () => {
  // /empresa keeps the Art. 143 RRM representative on its board table.
  const pageBoard = new Set([...BOARD_CATEGORIES, 'Representante 143 RRM']);
  assert.equal(officerGroupFor('REPR.143 RRM'), 'auditoria_representantes');
  assert.equal(officerGroupFor('REPR.143 RRM', pageBoard), 'consejo');
  // …but an organ that is not a board is unaffected by the override.
  assert.equal(officerGroupFor('COM.CONTROL', pageBoard), 'otros');
  assert.equal(officerGroupFor('MBRO.COM.AUD', pageBoard), 'comisiones');
});

test('a person is one row per group, dated from their earliest appointment', () => {
  const rows = [
    { name: 'DAGA GELABERT TOMAS', position_normalized: 'MBRO.COM.AUD', appointed_date: '2023-05-30' },
    { name: 'DAGA GELABERT TOMAS', position_normalized: 'SEC.COM.AUD.', appointed_date: '2024-06-11' },
    { name: 'Daga Gelabert Tomás', position_normalized: 'M.COM.NOM.RE', appointed_date: '2025-08-01' },
  ];
  const collapsed = collapseGroupByPerson(rows, 'appointed_date');
  assert.equal(collapsed.length, 1, 'accent and case variants are one person');
  assert.deepEqual(collapsed[0].positions, ['MBRO.COM.AUD', 'SEC.COM.AUD.', 'M.COM.NOM.RE']);
  assert.equal(collapsed[0].appointed_date, '2023-05-30');
});

test('a director who sits on committees is one director, listed twice', () => {
  // DAGA GELABERT TOMAS's six live rows at GRIFOLS SA. Rendering each as its own
  // board row would give Grifols four extra directors — and the row count is how
  // a reader counts the board.
  const officers = [
    { name: 'DAGA GELABERT TOMAS', position_normalized: 'CONS.OTR.EXT', appointed_date: '2024-02-23' },
    { name: 'DAGA GELABERT TOMAS', position_normalized: 'VICESECRET.', appointed_date: '2024-02-23' },
    { name: 'DAGA GELABERT TOMAS', position_normalized: 'MBRO.COM.AUD', appointed_date: '2023-05-30' },
    { name: 'DAGA GELABERT TOMAS', position_normalized: 'SEC.COM.AUD.', appointed_date: '2024-06-11' },
    { name: 'DAGA GELABERT TOMAS', position_normalized: 'M.COM.NOM.RE', appointed_date: '2025-08-01' },
    { name: 'DAGA GELABERT TOMAS', position_normalized: 'APODERADO', appointed_date: '2024-11-29' },
  ];
  const groups = Object.fromEntries(groupOfficersForDisplay(officers, 'appointed_date'));
  assert.equal(groups.consejo.length, 1);
  assert.deepEqual(groups.consejo[0].positions, ['CONS.OTR.EXT']);
  assert.equal(groups.comisiones.length, 1);
  assert.deepEqual(groups.comisiones[0].positions, ['MBRO.COM.AUD', 'SEC.COM.AUD.', 'M.COM.NOM.RE']);
  assert.deepEqual(groups.auditoria_representantes[0].positions, ['APODERADO']);
  // The vicesecretaryship is a real seat but not evidence of a board seat —
  // SECRENOCONSJ exists precisely because a secretary often is not a director.
  assert.deepEqual(groups.otros[0].positions, ['VICESECRET.']);
});

test('groups render in a fixed order and empty ones are dropped', () => {
  const officers = [{ name: 'A', position_normalized: 'APODERADO', appointed_date: '2020-01-01' }];
  const groups = groupOfficersForDisplay(officers, 'appointed_date');
  assert.deepEqual(groups.map(([g]) => g), ['auditoria_representantes']);
  assert.deepEqual(groupOfficersForDisplay([], 'appointed_date'), []);
  assert.ok(OFFICER_GROUP_ORDER.every(g => typeof g === 'string'));
});
