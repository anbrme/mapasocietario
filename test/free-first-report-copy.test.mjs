import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREE_FIRST_REPORT_COPY, SAMPLE_REPORT_URL } from '../src/copy/freeFirstReport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

// The offer converts (2 of the 3 who took it went on to buy a paid report), but
// it was only announced on /due-diligence, /pricing and inside the checkout
// dialog. These tests pin it to the surfaces users and crawlers reach first.

test('offer copy exists in both languages with headline, body and CTA', () => {
  for (const lang of ['en', 'es']) {
    const c = FREE_FIRST_REPORT_COPY[lang];
    assert.ok(c, `missing ${lang} copy`);
    for (const field of ['headline', 'body', 'cta']) {
      assert.equal(typeof c[field], 'string', `${lang}.${field} must be a string`);
      assert.ok(c[field].trim().length > 0, `${lang}.${field} must not be empty`);
    }
  }
});

test('offer copy states the financial-statements exclusion in both languages', () => {
  // The free report excludes Cuentas Anuales — that document costs a real EUR 11
  // per company at the registry, so promising it free would sell at a loss.
  assert.match(FREE_FIRST_REPORT_COPY.en.body, /financial statements/i);
  assert.match(FREE_FIRST_REPORT_COPY.es.body, /cuentas anuales/i);
});

test('landing page surfaces the free first report', () => {
  const src = read('src/components/LandingPage.jsx');
  assert.match(src, /FREE_FIRST_REPORT_COPY/,
    'LandingPage must render the offer — it is where organic search traffic lands');
  assert.match(src, /FREE_FIRST_REPORT_CODE/,
    'the offer must be gated on the program switch so it disappears with the program');
});

test('prerendered HTML surfaces the free first report and the sample report', () => {
  const src = read('scripts/prerender.mjs');
  assert.match(src, /FREE_FIRST_REPORT_COPY/,
    'crawlers and AI answer engines must see the offer, not just hydrated React');
  // The path reaches the HTML through SAMPLE_REPORT_URL, so assert the link is
  // emitted and that the constant still points at the PDF that actually ships.
  assert.match(src, /SAMPLE_REPORT_URL/,
    'the sample report is the proof-of-quality artifact — crawlers must see it too');
  assert.equal(SAMPLE_REPORT_URL, '/sample-dd-report.pdf');
  assert.ok(existsSync(path.resolve(__dirname, '..', 'public', 'sample-dd-report.pdf')),
    'the sample PDF must exist in public/ or every link to it 404s');
});

test('no surface claims PEP screening', () => {
  // Retracted in 8c79f83 ("drop the PEP claim") but left behind in the
  // prerendered HTML, which is what crawlers and AI answer engines read.
  for (const file of ['scripts/prerender.mjs', 'src/components/landingCopy.jsx']) {
    assert.doesNotMatch(read(file), /PEP databases/i, `${file} still claims PEP screening`);
  }
});
