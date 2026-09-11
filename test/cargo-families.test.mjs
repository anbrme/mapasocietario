import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARGO_FAMILIES, UNNAMED_COMMITTEE_EXAMPLES } from '../src/copy/cargoFamilies.js';
import { positionLabelFor } from '../src/utils/positionLabels.js';
import { organKindFor, impliesDirectorship } from '../src/utils/organKinds.js';
import { positionCategoryFor } from '../src/utils/positionCategories.js';

// The public "how we read registry positions" page publishes these families and
// renders each example through positionLabelFor at build time. That keeps the
// page from drifting from the product, but only if the FILING is also right:
// a code that stops belonging to its family, or stops conferring the
// directorship the page claims for it, would publish a false statement about
// how we classify. These assertions are the page's fact-check.

// /empresa's board table takes two administrator-level roles the DD report
// files elsewhere — see PAGE_BOARD_CATEGORIES in functions/empresa/_lib.js.
const BOARD_CATEGORIES = new Set([
  'Presidente', 'Vicepresidente', 'Consejero', 'Administrador', 'Representante 143 RRM',
]);

const confersDirectorship = code =>
  impliesDirectorship(code) || BOARD_CATEGORIES.has(positionCategoryFor(code));

test('every published example still confers what the page says it confers', () => {
  for (const family of CARGO_FAMILIES) {
    const expected = family.directorship === 'yes';
    for (const code of family.codes) {
      assert.equal(confersDirectorship(code), expected,
        `${code} in family "${family.id}" (directorship: ${family.directorship})`);
    }
  }
});

test('no published example renders as a raw code', () => {
  // The page's whole claim is that we can read these. One that renders as its
  // own abbreviation would sit in the table saying nothing.
  for (const family of CARGO_FAMILIES) {
    for (const code of family.codes) {
      for (const lang of ['es', 'en']) {
        const label = positionLabelFor(code, lang);
        assert.notEqual(label, code, `${code} (${lang}) has no prose label`);
        assert.ok(label && label.length > 1, `${code} (${lang}) rendered empty`);
      }
    }
  }
});

test('the committees that must never confer a directorship do not', () => {
  // Comisión de control is 26,511 seats and comisión liquidadora 4,395. These
  // are the families the classifier exists to keep off the board.
  const never = CARGO_FAMILIES.filter(f => f.directorship === 'never');
  assert.ok(never.length >= 3, 'the never-a-director families must stay published');
  for (const family of never) {
    for (const code of family.codes) {
      assert.equal(impliesDirectorship(code), false, code);
    }
  }
});

test('the unnamed committees are genuinely unnamed, and say so in the label', () => {
  // Published so the gap is visible rather than papered over. If one of these
  // ever becomes nameable the page must stop citing it as an example.
  for (const code of UNNAMED_COMMITTEE_EXAMPLES) {
    assert.equal(impliesDirectorship(code), false, `${code} should confer nothing`);
    assert.match(positionLabelFor(code, 'es'), new RegExp(`\\(${code.replace(/\./g, '\\.')}\\)`),
      `${code} should render with its code kept visible`);
  }
});

test('every family is complete in both languages', () => {
  const ids = new Set();
  for (const family of CARGO_FAMILIES) {
    assert.ok(family.id && !ids.has(family.id), `duplicate or missing id: ${family.id}`);
    ids.add(family.id);
    assert.ok(['yes', 'no', 'never'].includes(family.directorship), family.id);
    assert.ok(family.codes.length > 0, family.id);
    for (const lang of ['es', 'en']) {
      assert.ok(family[lang]?.name, `${family.id} missing ${lang} name`);
      assert.ok(family[lang]?.blurb?.length > 40, `${family.id} missing ${lang} blurb`);
    }
  }
});

test('the families cover the offices the board table actually shows', () => {
  // A reader who sees a cargo on a company page should find its family here.
  const published = new Set(CARGO_FAMILIES.flatMap(f => f.codes));
  for (const code of ['ADM. UNICO', 'CONSEJERO', 'CONS.INDEPEN', 'CONS.DOMINIC',
                      'CON.DELEGADO', 'PRESIDENTE', 'APODERADO', 'AUDITOR']) {
    assert.ok(published.has(code), `${code} is common on company pages and is not published`);
  }
});

test('an organ role is filed under an organ family, not an office family', () => {
  // Mixing them would tell the reader a committee seat is an office.
  const officeFamilies = ['administrador', 'consejero', 'presidencia', 'apoderado', 'auditor'];
  for (const family of CARGO_FAMILIES.filter(f => officeFamilies.includes(f.id))) {
    for (const code of family.codes) {
      assert.equal(organKindFor(code), null, `${code} names an organ but is filed under ${family.id}`);
    }
  }
});
