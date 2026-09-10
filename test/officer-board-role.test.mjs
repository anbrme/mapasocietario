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
test('genuine committee roles stay out of the primary board table but remain discoverable', () => {
  const company = {
    company_name: 'X SA',
    company_type: 'SA',
    officers_active: [
      { name: 'COMMITTEE PERSON', position_normalized: 'COM. AUDITORIA', appointed_date: '2022-01-01' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'x-sa', null, 'es');
  const beforeOtherRoles = html.split('<details class="officer-more">')[0];
  assert.doesNotMatch(beforeOtherRoles, /<td>COMMITTEE PERSON<\/td>/, 'committee-only members are not board members');
  assert.match(html, /<details class="officer-more">[\s\S]*<td>COMMITTEE PERSON<\/td>/);
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
