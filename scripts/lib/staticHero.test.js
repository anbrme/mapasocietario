import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { escapeHtml, staticHeroHtml } from './staticHero.mjs';
import { LANDING_HERO_COPY, LANDING_TOP_LINKS } from '../../src/copy/landingHero.js';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('staticHeroHtml', () => {
  it.each(['en', 'es'])('renders the %s headline, eyebrow and subtitle as visible HTML', (lang) => {
    const html = staticHeroHtml(lang);
    const copy = LANDING_HERO_COPY[lang];
    expect(html).toContain(`<h1 class="ms-hero__h1">${copy.h1}</h1>`);
    expect(html).toContain(copy.eyebrow);
    expect(html).toContain(copy.subtitle);
    expect(html).toContain(`lang="${lang}"`);
  });

  it('ships a search form that works before JavaScript arrives', () => {
    const html = staticHeroHtml('en');
    expect(html).toMatch(/<form[^>]*action="\/app\/"[^>]*method="get"/);
    expect(html).toMatch(/<input[^>]*name="search"/);
    expect(html).toContain('name="source" value="home_search"');
    expect(html).not.toContain('name="lang"');
  });

  it('keeps the Spanish search inside the Spanish workspace', () => {
    expect(staticHeroHtml('es')).toContain('<input type="hidden" name="lang" value="es" />');
  });

  it.each(['en', 'es'])('renders every %s header link, language switcher last', (lang) => {
    const html = staticHeroHtml(lang);
    for (const link of LANDING_TOP_LINKS[lang]) {
      expect(html).toContain(`href="${link.href}"`);
    }
    const languageLink = LANDING_TOP_LINKS[lang].find((link) => link.alignRight);
    expect(html).toContain(`class="ms-hero__link ms-hero__lang" href="${languageLink.href}"`);
  });

  it('escapes HTML-significant characters in copy', () => {
    // The copy module is prose, but the renderer must not trust it: a stray
    // angle bracket in a future edit would otherwise become markup.
    expect(escapeHtml('<b>&"x"')).toBe('&lt;b&gt;&amp;&quot;x&quot;');
    // Typographic punctuation in the real copy must pass through untouched.
    expect(staticHeroHtml('en')).toContain('Spain’s Commercial Registries —');
  });

  it('is styled by src/index.css, which must not hide it', () => {
    // #root > main is the crawler-only block and stays hidden; the hero is a
    // div and paints. Pin both halves so a "tidy up" cannot re-blank the page.
    expect(css).toContain('#root > main {');
    expect(css).toContain('.ms-hero {');
    expect(css).not.toMatch(/\.ms-hero\s*{[^}]*display:\s*none/);
  });

  it('rejects an unknown language instead of rendering an empty hero', () => {
    expect(() => staticHeroHtml('fr')).toThrow(/no hero copy/);
  });
});
