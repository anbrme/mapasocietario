import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

// A company renamed in BORME often keeps its doc under the ORIGINAL hoja name;
// the new name appears only as name_changes[].new_name (no separate doc, so no
// has_new_name). The page must surface the CURRENT name as the heading and the
// former registral name below — matching the in-app preview. (Live example:
// WASABI STRATEGIES 2024 SL → WAYPORT ADVISORS SL.)
test('rename recorded only in name_changes.new_name shows the new name as heading + former name', () => {
  const company = {
    company_name: 'WASABI STRATEGIES 2024 SL',
    company_type: 'SL',
    name_changes: [
      { date: '2025-01-20', old_name: 'WASABI STRATEGIES 2024 SL', new_name: 'WAYPORT ADVISORS SL' },
    ],
  };
  const html = renderCompanyPage(company, [], 'wasabi-strategies-2024-sl', null, 'es');
  assert.match(html, /<h1>WAYPORT ADVISORS SL<\/h1>/, 'heading must be the current (new) name');
  assert.match(html, /Denominaciones anteriores: WASABI STRATEGIES 2024 SL/, 'former registral name must be shown');
});

// The latest rename wins when there are several.
test('multiple name changes: the most recent new_name is the heading', () => {
  const company = {
    company_name: 'ALPHA SL',
    company_type: 'SL',
    name_changes: [
      { date: '2020-01-01', old_name: 'ALPHA SL', new_name: 'BETA SL' },
      { date: '2024-06-01', old_name: 'BETA SL', new_name: 'GAMMA SL' },
    ],
  };
  const html = renderCompanyPage(company, [], 'alpha-sl', null, 'es');
  assert.match(html, /<h1>GAMMA SL<\/h1>/);
});

// No rename → stored name stays the heading, no "former names" notice.
test('company with no name change keeps its stored name as heading', () => {
  const company = { company_name: 'PLAIN CO SL', company_type: 'SL' };
  const html = renderCompanyPage(company, [], 'plain-co-sl', null, 'es');
  assert.match(html, /<h1>PLAIN CO SL<\/h1>/);
  assert.doesNotMatch(html, /Denominaciones anteriores/);
});
