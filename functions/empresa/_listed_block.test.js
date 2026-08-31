import { describe, it, expect } from 'vitest';
import { renderCompanyPage } from './_lib.js';

const COMPANY = {
  company_name: 'ACERINOX SA',
  nif: 'A-28250777',
  last_seen: '2026-08-28',
  total_publications: 42,
};

// Mirrors the SEED shape in _ibex35.js — a genuinely listed company.
const LISTED = {
  name: 'Acerinox',
  v3Name: 'ACERINOX SA',
  nif: 'A-28250777',
  isin: 'ES0132105018',
  ticker: 'BME:ACX',
  sector: 'Acero',
  hoja: 'M 68935',
};

// Mirrors the CURATED shape — explicitly a NON-listed company.
const NOT_LISTED = { name: 'Nurnberg Consulting', v3Name: 'NURNBERG CONSULTING SL' };

const render = (seed, lang = 'es') => renderCompanyPage(COMPANY, [], 'acerinox', seed, lang);

/**
 * "Sociedad cotizada" is a claim about a company's legal status, printed under
 * its name. Getting it wrong on a private company is the kind of error a reader
 * would be right to hold against every other figure on the page.
 *
 * The block used to key on the seed merely EXISTING. That is correct in
 * production only because handleCompany passes a seed exclusively for IBEX
 * entries (`resolved.kind === 'seed'`) — one line away from labelling a private
 * company as listed. A ticker is what actually makes a company quoted, so that
 * is what the block keys on now.
 */
describe('the listed-company block', () => {
  it('is withheld from a company with no ticker', () => {
    const html = render(NOT_LISTED);

    expect(html).not.toContain('Sociedad cotizada');
    expect(html).not.toContain('class="cotizada"');
  });

  it('is withheld when there is no seed at all', () => {
    expect(render(null)).not.toContain('class="cotizada"');
  });

  it('names the ticker for a company that really is quoted', () => {
    const html = render(LISTED);

    expect(html).toContain('Sociedad cotizada');
    expect(html).toContain('BME:ACX');
  });

  it('links out to the quote in a new tab, without passing on ranking signal', () => {
    const start = render(LISTED).indexOf('class="cotizada"');
    const block = render(LISTED).slice(start, render(LISTED).indexOf('</section>', start));

    expect(block).toMatch(/href="https:\/\/[^"]*ACX[^"]*"/);
    expect(block).toContain('target="_blank"');
    // An external market site is not something this page vouches for.
    expect(block).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(block).toMatch(/rel="[^"]*nofollow[^"]*"/);
  });

  it('offers the quote link in both languages', () => {
    expect(render(LISTED, 'es')).toContain('Ver cotización');
    expect(render(LISTED, 'en')).toContain('View quote');
  });
});
