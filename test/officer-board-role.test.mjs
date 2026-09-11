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

// The Art. 143 RRM permanent representative is the natural person exercising
// a CORPORATE administrator's office. BORME publishes them as a row of their
// own and never says whom they represent. The page used to seat that row on
// the board next to the corporate administrator, so a company with a SOLE
// administrator showed two directors. Now the representative folds into the
// administrator's row when the pairing is unambiguous, is listed as a
// representative when it is not, and only stands on the board alone when there
// is no corporate officer to attach to. Locks pairRepresentatives143.
test('one corporate administrator + one representative render as ONE row, in prose', () => {
  // LIDL SUPERMERCADOS SA, former officers (dates are placeholders).
  const company = {
    company_name: 'LIDL SUPERMERCADOS SA',
    company_type: 'SA',
    officers_active: [],
    officers_resigned: [
      { name: 'GESTION DE AUTOSERVICIOS ADLID SL', position_normalized: 'ADM.UNICO', resigned_date: '2010-01-01' },
      { name: 'ARANDA PANKOW MIGUEL WERNER', position_normalized: 'REPR.143 RRM', resigned_date: '2010-01-01' },
    ],
  };
  const es = renderCompanyPage(company, [], 'lidl-supermercados-sa', null, 'es');
  assert.match(es, /<td>GESTION DE AUTOSERVICIOS ADLID SL, representada por ARANDA PANKOW MIGUEL WERNER<\/td>/,
    'the representative is named on the administrator\'s row');
  assert.doesNotMatch(es, /<td>ARANDA PANKOW MIGUEL WERNER<\/td>/,
    'and has no row of their own');
  assert.match(es, /El BORME no publica a quién representa/,
    'the page says the pairing is inferred');

  const en = renderCompanyPage(company, [], 'lidl-supermercados-sa', null, 'en');
  assert.match(en, /<td>GESTION DE AUTOSERVICIOS ADLID SL, represented by ARANDA PANKOW MIGUEL WERNER<\/td>/);
  assert.match(en, /BORME does not record which company/);
});

test('a representative with no corporate officer to attach to still stands on the board', () => {
  const company = {
    company_name: 'Y SL',
    company_type: 'SL',
    officers_active: [
      { name: 'PERM REP PERSON', position_normalized: 'REPR.143 RRM', appointed_date: '2024-01-01' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'y-sl', null, 'es');
  const board = html.split('<details class="officer-more">')[0];
  assert.match(board, /<td>PERM REP PERSON<\/td>/, 'the only trace of the administration is shown as such');
  assert.doesNotMatch(html, /No constan administradores/);
  assert.doesNotMatch(html, /El BORME no publica a quién representa/, 'no pairing was made, so no note');
});

test('several corporate directors and several representatives: nobody is paired', () => {
  // SPANAIR SA (dissolved), former officers: two corporate consejeros, three
  // representatives. Which represents which is not published, so the page
  // must not guess.
  const company = {
    company_name: 'SPANAIR SA',
    company_type: 'SA',
    is_dissolved: true,
    officers_active: [],
    officers_resigned: [
      { name: 'INVERSIONS TURISTIQUES I COMERCIALS 2009 SA', position_normalized: 'CONSEJERO', resigned_date: '2012-01-01' },
      { name: 'FIRA INTERNACIONAL DE BARCELONA', position_normalized: 'CONSEJERO', resigned_date: '2012-01-01' },
      { name: 'CORDON BARRENECHEA ARANDO AGUSTI', position_normalized: 'REPR.143 RRM', resigned_date: '2012-01-01' },
      { name: 'SUÑOL TREPAT RAFAEL', position_normalized: 'REPR.143 RRM', resigned_date: '2012-01-01' },
      { name: 'ALBANELL MIRA MANUEL', position_normalized: 'REPR.143 RRM', resigned_date: '2012-01-01' },
    ],
  };
  const html = renderCompanyPage(company, [], 'spanair-sa', null, 'es');
  assert.doesNotMatch(html, /representada por/, 'no pairing is claimed');
  const [primary, more] = html.split('<details class="officer-more">');
  assert.match(primary, /<td>INVERSIONS TURISTIQUES I COMERCIALS 2009 SA<\/td>/, 'corporate directors are the board');
  assert.doesNotMatch(primary, /<td>SUÑOL TREPAT RAFAEL<\/td>/, 'a representative is not a board row');
  assert.match(more, /Auditoría y representantes[\s\S]*<td>SUÑOL TREPAT RAFAEL<\/td>/,
    'representatives are listed as representatives');
});

test('on a dissolved company the representative follows a corporate liquidator', () => {
  const company = {
    company_name: 'UNA SOCIEDAD DISUELTA SL',
    company_type: 'SL',
    is_dissolved: true,
    officers_active: [
      { name: 'UNA LIQUIDADORA SL', position_normalized: 'LIQUIDADOR', appointed_date: '2021-01-01' },
      { name: 'PERSONA FISICA', position_normalized: 'REPR.143 RRM', appointed_date: '2021-01-01' },
    ],
    officers_resigned: [],
  };
  const html = renderCompanyPage(company, [], 'una-sociedad-disuelta-sl', null, 'es');
  const board = html.split('<details class="officer-more">')[0];
  assert.match(board, /<td>UNA LIQUIDADORA SL, representada por PERSONA FISICA<\/td>/,
    'the liquidator row carries the representative, in the table that lists the seats open at closure');
  assert.doesNotMatch(html, /<td>PERSONA FISICA<\/td>/);
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
  // Spelled out now: positionLabelFor composes the office from the category and
  // the qualifier the abbreviation carries, so the cargo column no longer mixes
  // shouted codes with prose.
  assert.match(board, /Consejero externo/, 'the board row carries his real board title');
  assert.doesNotMatch(board, /CONS\.OTR\.EXT/, 'and not as a raw BORME code');
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
