import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  companyDestination,
  handleNifRedirect,
  normalizeCompanyNif,
} from '../functions/empresa/_nif_redirect.js';
import { onRequestGet as onRequestGetEs } from '../functions/empresa/nif/[nif].js';
import { onRequestGet as onRequestGetEn } from '../functions/en/company/nif/[nif].js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('normalizes a legal-entity NIF and rejects malformed identifiers', () => {
  assert.equal(normalizeCompanyNif(' a81638108 '), 'A81638108');
  assert.equal(normalizeCompanyNif('81638108'), null);
  assert.equal(normalizeCompanyNif('A81638108/path'), null);
});

test('builds Spanish and English destinations with the shared slug rules', () => {
  assert.equal(
    companyDestination('ACCIONA CONSTRUCCIÓN, S.A.', 'es'),
    'https://mapasocietario.es/empresa/acciona-construccion-s-a',
  );
  assert.equal(
    companyDestination('ACCIONA CONSTRUCCIÓN, S.A.', 'en'),
    'https://mapasocietario.es/en/company/acciona-construccion-s-a',
  );
});

test('redirects an exact API result without permanently pinning the slug', async () => {
  globalThis.fetch = async (url) => {
    assert.equal(
      url,
      'https://api.ncdata.eu/bormes/company-by-nif?nif=A81638108',
    );
    return Response.json({
      success: true,
      nif: 'A81638108',
      company_name: 'ACCIONA CONSTRUCCION SA',
    });
  };

  const response = await handleNifRedirect({ params: { nif: 'a81638108' } }, 'es');
  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get('location'),
    'https://mapasocietario.es/empresa/acciona-construccion-sa',
  );
  assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
});

test('Spanish and English route wrappers select the matching destination', async () => {
  globalThis.fetch = async () => Response.json({
    success: true,
    nif: 'A81638108',
    company_name: 'ACCIONA CONSTRUCCION SA',
  });

  const es = await onRequestGetEs({ params: { nif: 'A81638108' } });
  const en = await onRequestGetEn({ params: { nif: 'A81638108' } });
  assert.equal(
    es.headers.get('location'),
    'https://mapasocietario.es/empresa/acciona-construccion-sa',
  );
  assert.equal(
    en.headers.get('location'),
    'https://mapasocietario.es/en/company/acciona-construccion-sa',
  );
});

test('fails closed on ambiguous, missing, malformed or mismatched lookups', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 409 });
  assert.equal(
    (await handleNifRedirect({ params: { nif: 'A81638108' } }, 'es')).status,
    404,
  );

  globalThis.fetch = async () => Response.json({
    success: true,
    nif: 'B00000000',
    company_name: 'UNRELATED COMPANY SL',
  });
  assert.equal(
    (await handleNifRedirect({ params: { nif: 'A81638108' } }, 'es')).status,
    502,
  );
  assert.equal(
    (await handleNifRedirect({ params: { nif: '../etc/passwd' } }, 'es')).status,
    404,
  );
});
