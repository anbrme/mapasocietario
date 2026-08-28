import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/sitemap-demand.xml.js';
import { companyUrlsetXml, MAX_COMPANIES_PER_SITEMAP } from '../functions/sitemaps/_urlset.js';

// /sitemap.xml is a <sitemapindex>. The sitemaps protocol does not allow an
// index to reference another index, so /sitemap-demand.xml must be a <urlset>.
// While it was an index, Google reported 151 submitted URLs — pages (26) +
// empresas (78) + directorio (47) — and none of the 2,022 promoted companies.

const db = (rows) => ({
  prepare: () => ({ bind: () => ({ all: async () => ({ results: rows }) }) }),
});
const rows = [
  { slug: 'acme-sl', promoted_at: '2026-08-17 10:00:00' },
  { slug: 'beta-sa', promoted_at: '2026-08-18 10:00:00' },
];

test('the demand sitemap is a urlset, never a nested index', async () => {
  const res = await onRequestGet({ env: { SEO_DB: db(rows) } });
  const xml = await res.text();
  assert.equal(res.status, 200);
  assert.match(xml, /<urlset\b/);
  assert.doesNotMatch(xml, /<sitemapindex\b/,
    'a sitemap index inside a sitemap index is silently ignored by Google');
  assert.doesNotMatch(xml, /sitemaps\/companies/,
    'the company pages must be listed directly, not pointed at');
});

test('it lists both language variants of every promoted company', async () => {
  const xml = await (await onRequestGet({ env: { SEO_DB: db(rows) } })).text();
  for (const slug of ['acme-sl', 'beta-sa']) {
    assert.match(xml, new RegExp(`<loc>https://mapasocietario\\.es/empresa/${slug}</loc>`));
    assert.match(xml, new RegExp(`<loc>https://mapasocietario\\.es/en/company/${slug}</loc>`));
  }
  assert.equal((xml.match(/<loc>/g) || []).length, 4);
});

test('an empty index would be a Search Console error, so it 404s instead', async () => {
  assert.equal((await onRequestGet({ env: { SEO_DB: db([]) } })).status, 404);
  assert.equal((await onRequestGet({ env: {} })).status, 404);
});

test('one urlset stays inside the 50,000-URL protocol limit', () => {
  const many = Array.from({ length: MAX_COMPANIES_PER_SITEMAP }, (_, i) => ({ slug: `c-${i}` }));
  const count = (companyUrlsetXml(many).match(/<loc>/g) || []).length;
  assert.equal(count, 50_000);
});
