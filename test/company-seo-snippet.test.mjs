import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCompanyPage } from '../functions/empresa/_lib.js';

test('English listed-company snippets use the familiar brand and a concise title', () => {
  const company = {
    company_name: 'INDUSTRIA DE DISEÑO TEXTIL, S.A.',
    company_type: 'SA',
    province: 'A Coruña',
    current_capital: 939825000,
  };
  const seed = { name: 'Inditex', ticker: 'BME:ITX' };
  const html = renderCompanyPage(company, [], 'inditex', seed, 'en');

  assert.match(html, /<title>Inditex: Directors &amp; Company Records \| Mapa Societario<\/title>/);
  assert.match(html, /<meta name="description" content="Search Inditex in Spain:/);
  assert.doesNotMatch(html, /Spanish Company Registry Records: Directors, Shareholders &amp; Filings/);
  assert.match(html, /<h1>INDUSTRIA DE DISEÑO TEXTIL, S\.A\.<\/h1>/);
});
