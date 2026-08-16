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
