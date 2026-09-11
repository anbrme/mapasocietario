import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// Regression: an active "administrador mancomunado" (stored position "ADM. MANCOM.")
// was being dropped from the current-board section because the committee-exclusion
// regex `COM\.` false-matched the "COM." inside "MANCOM.". The page then claimed
// "No constan administradores ni consejeros vigentes" even though the backend had
// the joint administrators in officers_active. (Live example: FTI Consulting Spain.)
//
// Assertions target the officer TABLE cell (`<td>NAME</td>`) — not the whole HTML —
// because the JSON-LD `employee` array lists every active officer regardless of
// board status, which would mask the bug.
test('active ADM. MANCOM. (joint administrator) renders in the current-board table', () => {
  const company = {
    company_name: 'FTI CONSULTING SPAIN SL',
    company_type: 'SL',
    officers_active: [
      { name: 'DUNKIN JARED IAN', position_normalized: 'ADM. MANCOM.', appointed_date: '2023-01-05' },
      { name: 'A POWER OF ATTORNEY', position_normalized: 'APODERADO', appointed_date: '2022-01-01' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'fti-consulting-spain-sl', null, 'es');
  assert.match(html, /<td>DUNKIN JARED IAN<\/td>/, 'the joint administrator must appear in an officer table row');
  assert.doesNotMatch(html, /No constan administradores/, 'must not claim there is no current board');
});

// Guard: genuine committee roles (e.g. "COM. AUDITORIA") must STILL be excluded from
// the primary board table after the fix. They remain discoverable in the collapsed
// "other recorded roles" table so the public profile does not silently omit data.
// SUPERSEDED BEHAVIOUR. This test used to assert that a committee-only member
// was NOT a board member. That is wrong for a committee OF the board: under the
// LSC a comisión de auditoría / nombramientos y retribuciones / ejecutiva /
// delegada / riesgos may only be held by a sitting consejero, so the seat is
// itself the evidence of the directorship. Holding those members out of the
// board table hid real directors — GRIFOLS SA showed eleven and omitted DAGA
// GELABERT TOMAS, whose only inscribed live seat is the nominations committee.
// The committee detail still appears under Comisiones; what changed is that the
// person is no longer absent from the board.
test('a board-committee member is a board member, and keeps his committee row', () => {
  const company = {
    company_name: 'X SA',
    company_type: 'SA',
    officers_active: [
      { name: 'COMMITTEE PERSON', position_normalized: 'COM. AUDITORIA', appointed_date: '2022-01-01' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'x-sa', null, 'es');
  const boardTable = html.split('<details class="officer-more">')[0];
  assert.match(boardTable, /<td>COMMITTEE PERSON<\/td>/,
    'an audit-committee member is a sitting consejero');
  assert.match(boardTable, /Consejero \(/,
    'the board row must say the directorship rests on the committee seat');
  assert.match(html, /<details class="officer-more">[\s\S]*<td>COMMITTEE PERSON<\/td>/,
    'and the committee seat itself is still listed');
});

// The Art. 143 RRM organic permanent representative is administrator-level and
// should appear on the board (the old local regex omitted it; the shared
// classifier includes it). Locks that BOARD_CATEGORIES decision.
test('Art. 143 RRM permanent representative renders as a current board member', () => {
  const company = {
    company_name: 'Y SL',
    company_type: 'SL',
    officers_active: [
      { name: 'PERM REP PERSON', position_normalized: 'REPR.143 RRM', appointed_date: '2024-01-01' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'y-sl', null, 'es');
  assert.match(html, /<td>PERM REP PERSON<\/td>/, 'the 143 RRM representative must appear in the board table');
  assert.doesNotMatch(html, /No constan administradores/);
});

// The board table lists one row per PERSON, not per seat. DAGA GELABERT TOMAS
// holds six live roles at GRIFOLS SA; rendering each as a board row would give
// the company four directors it does not have, because the row count is how a
// reader counts the board. His committee work belongs under Comisiones, where
// it describes how the board is organised rather than how large it is.
test('a director who also sits on committees is one board row, not five', () => {
  const company = {
    company_name: 'GRIFOLS SA',
    company_type: 'SA',
    officers_active: [
      { name: 'DAGA GELABERT TOMAS', position_normalized: 'CONS.OTR.EXT', appointed_date: '2024-02-23' },
      { name: 'DAGA GELABERT TOMAS', position_normalized: 'VICESECRET.', appointed_date: '2024-02-23' },
      { name: 'DAGA GELABERT TOMAS', position_normalized: 'MBRO.COM.AUD', appointed_date: '2023-05-30' },
      { name: 'DAGA GELABERT TOMAS', position_normalized: 'SEC.COM.AUD.', appointed_date: '2024-06-11' },
      { name: 'DAGA GELABERT TOMAS', position_normalized: 'M.COM.NOM.RE', appointed_date: '2025-08-01' },
      { name: 'DAGA GELABERT TOMAS', position_normalized: 'APODERADO', appointed_date: '2024-11-29' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'grifols-sa', null, 'es');
  const board = html.split('<details class="officer-more">')[0];
  const boardRows = board.match(/<td>DAGA GELABERT TOMAS<\/td>/g) || [];
  assert.equal(boardRows.length, 1, 'one person, one board row');
  // Rendered raw for now — CONS.OTR.EXT has no entry in the nine-item label map.
  assert.match(board, /CONS\.OTR\.EXT/, 'the board row carries his real board title');
  assert.doesNotMatch(board, /COM\.AUD/, 'committee seats are not board rows');

  // …and the committee seats stay discoverable, under their own heading.
  const more = html.split('<details class="officer-more">')[1];
  assert.match(more, /Comisiones/);
  // …spelled out, not as the raw BORME code.
  assert.match(more, /Miembro de la Comisión de Auditoría/);
  assert.match(more, /Miembro de la Comisión de Nombramientos y Retribuciones/);
  assert.doesNotMatch(more, /MBRO\.COM\.AUD/);
});

// The non-board tables were previously concatenated in raw document order, so
// apoderados, auditors and committee members were interleaved arbitrarily.
test('other recorded roles are grouped under headings, not dumped in file order', () => {
  const company = {
    company_name: 'Z SA',
    company_type: 'SA',
    officers_active: [
      { name: 'AN ATTORNEY', position_normalized: 'APODERADO', appointed_date: '2022-01-01' },
      { name: 'A COMMITTEE MEMBER', position_normalized: 'MBRO.COM.AUD', appointed_date: '2022-01-01' },
      { name: 'A DIRECTOR', position_normalized: 'CONSEJERO', appointed_date: '2022-01-01' },
      { name: 'AN AUDITOR', position_normalized: 'AUDITOR', appointed_date: '2022-01-01' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'z-sa', null, 'es');
  const more = html.split('<details class="officer-more">')[1];
  // Committees come before auditors and representatives, whatever order the
  // backend returned the rows in.
  assert.ok(more.indexOf('Comisiones') < more.indexOf('Auditoría y representantes'));
  assert.ok(more.indexOf('<td>A COMMITTEE MEMBER</td>') < more.indexOf('<td>AN ATTORNEY</td>'));
});

// A director whose only inscribed live seat is a board committee must still
// appear in the board table. BORME revoked DAGA GELABERT TOMAS's CONS.OTR.EXT
// at GRIFOLS SA on 2024-02-23, never inscribed a re-appointment, and put him
// back on the nominations committee on 2025-08-01. Under the LSC that committee
// is open only to sitting consejeros, so he is a director — but the page listed
// the other eleven and left him out, which is the bug that started this work.
test('a board-committee member with no inscribed board office is still a director', () => {
  const company = {
    company_name: 'GRIFOLS SA',
    company_type: 'SA',
    officers_active: [
      { name: 'DAGA GELABERT TOMAS', position_normalized: 'M.COM.NOM.RE', appointed_date: '2025-08-01' },
      { name: 'GRIFOLS DEU VICTOR', position_normalized: 'CONS.DOMINIC', appointed_date: '2025-08-01' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'grifols-sa', null, 'es');
  const board = html.split('<details class="officer-more">')[0];
  assert.match(board, /<td>DAGA GELABERT TOMAS<\/td>/,
    'a nominations-committee member is a consejero and belongs in the board table');
  assert.match(html, /Consejero \(Miembro de la Comisión de Nombramientos y Retribuciones\)/,
    'the row must say what the directorship rests on');
});

test('a comision de control member is NOT promoted into the board table', () => {
  const company = {
    company_name: 'UNA MUTUALIDAD SA',
    company_type: 'SA',
    officers_active: [
      { name: 'VOCAL DE CONTROL', position_normalized: 'M.COM.CONTROL', appointed_date: '2020-01-01' },
      { name: 'ADMINISTRADOR REAL', position_normalized: 'ADM. UNICO', appointed_date: '2020-01-01' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'una-mutualidad-sa', null, 'es');
  const board = html.split('<details class="officer-more">')[0];
  assert.doesNotMatch(board, /<td>VOCAL DE CONTROL<\/td>/,
    'a comisión de control is a supervisory organ, not the board');
});
