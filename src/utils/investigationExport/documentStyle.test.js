import { describe, expect, it } from 'vitest';
import { DOCUMENT_STYLE, FLAG_COLORS, flagVar } from './documentStyle';

describe('DOCUMENT_STYLE', () => {
  it('embeds both Plex faces as data URIs', () => {
    const faces = DOCUMENT_STYLE.match(/@font-face/g) || [];
    expect(faces).toHaveLength(2);
    expect(DOCUMENT_STYLE).toContain('url(data:font/woff2;base64,');
    expect(DOCUMENT_STYLE).toMatch(/font-weight:\s*400/);
    expect(DOCUMENT_STYLE).toMatch(/font-weight:\s*700/);
  });

  it('carries print rules: A4 page, breaks before chapters and annexes, player hidden', () => {
    expect(DOCUMENT_STYLE).toContain('@page');
    expect(DOCUMENT_STYLE).toContain('@media print');
    expect(DOCUMENT_STYLE).toContain('#walkthrough{page-break-before:always');
    expect(DOCUMENT_STYLE).toContain('#annexes{page-break-before:always');

    const printBlock = DOCUMENT_STYLE.slice(DOCUMENT_STYLE.indexOf('@media print{'));
    expect(printBlock).toContain('#wt-panel,.hide-print{display:none!important}');
    expect(printBlock).toContain(':root{');
    expect(printBlock).toContain('--muted:#58677D');
    expect(printBlock).toContain('--line:#CCD6E3');
    expect(printBlock).toContain('#walkthrough{page-break-before:always');
  });

  it('uses the guide teal as the single accent and no external url', () => {
    expect(DOCUMENT_STYLE).toContain('#0E8178');
    expect(DOCUMENT_STYLE).not.toMatch(/url\(https?:/);
  });

  it('flagVar maps known flags and falls back to none', () => {
    expect(flagVar('red')).toBe(`--f:${FLAG_COLORS.red}`);
    expect(flagVar('bogus')).toBe(`--f:${FLAG_COLORS.none}`);
  });

  it('the walkthrough card is no longer pinned over the map', () => {
    expect(DOCUMENT_STYLE).not.toMatch(/#wt-panel\{[^}]*position:sticky/);
    expect(DOCUMENT_STYLE).toContain('#wt-panel{margin-top:12px');
  });

  it('lays the story out as a sticky pane beside the chapters, animates, respects reduced motion, stacks annex tabs in print', () => {
    expect(DOCUMENT_STYLE).toContain('.story{display:grid');
    expect(DOCUMENT_STYLE).toContain('position:sticky');
    expect(DOCUMENT_STYLE).toContain('#viewport{transition:transform');
    expect(DOCUMENT_STYLE).toContain('prefers-reduced-motion');
    expect(DOCUMENT_STYLE).toContain('[data-state="hidden"]');
    expect(DOCUMENT_STYLE).toContain('[data-state="ceased"]');
    expect(DOCUMENT_STYLE).toContain('[data-state="ghost"]');
    expect(DOCUMENT_STYLE).toMatch(/@media print\{[\s\S]*\.annex-panel\[hidden\]\{display:block!important\}/);
    expect(DOCUMENT_STYLE).toMatch(/@media print\{[\s\S]*\.story\{display:block\}/);
    expect(DOCUMENT_STYLE).toMatch(/@media print\{[\s\S]*#viewport\{transform:none!important/);
    // One grid column would make the pane's own grid area its sticky
    // containing block, so below the two-column breakpoint .story is a block.
    expect(DOCUMENT_STYLE).toContain('@media (max-width:959px){.story{display:block}}');
  });

  it('makes the sticky pane a flex column so the step card scrolls, not the pane', () => {
    // The pane used to clip: map + caption + legend + slider + card overflowed
    // its own max-height and the card was cut mid-way. Now the card is the only
    // flexible child, so the map, slider and card always fit.
    expect(DOCUMENT_STYLE).toMatch(/\.story #graph\{[^}]*display:flex;flex-direction:column\}/);
    expect(DOCUMENT_STYLE).toContain('.story #graph figure,.story #graph #wt-time{flex:0 0 auto}');
    expect(DOCUMENT_STYLE).toMatch(/#wt-panel\{[^}]*flex:1 1 auto;min-height:0;overflow:auto\}/);
    expect(DOCUMENT_STYLE).not.toContain('max-height:34vh');
  });

  it('keeps the pane inside a phone viewport so the chapters still have room', () => {
    expect(DOCUMENT_STYLE).toContain('.story #graph{max-height:62vh}');
    expect(DOCUMENT_STYLE).toContain('.story #graph #map{height:30vh}');
    expect(DOCUMENT_STYLE).toContain('.story #graph .legend{display:none}');
    expect(DOCUMENT_STYLE).toMatch(
      /@media \(max-width:959px\)\{\s*\.story #graph\{max-height:62vh\}/
    );
  });

  it('drops the graph caption under 960px so the step card keeps the pane budget', () => {
    // 62vh of pane minus 30vh of map left the card ~58px on a 400x800 phone,
    // because the two-line caption (counts + legend) ate the rest. The counts
    // are in the contents and the summary already.
    const narrow = DOCUMENT_STYLE.slice(
      DOCUMENT_STYLE.indexOf('@media (max-width:959px){\n')
    );
    const block = narrow.slice(0, narrow.indexOf('\n}'));
    expect(block).toContain('.story #graph figcaption{display:none}');
    // Paper has the room, and that block applies to print too (A4 inside 18mm
    // margins is ~657 CSS px), so print puts the caption back — by source order,
    // with no !important on either side.
    const printBlock = DOCUMENT_STYLE.slice(DOCUMENT_STYLE.indexOf('@media print{'));
    expect(printBlock).toContain('.story #graph figcaption{display:flex}');
    expect(DOCUMENT_STYLE).not.toContain('figcaption{display:none!important}');
  });

  it('keeps the pane a static block in print, flex layout and state styling reset', () => {
    const printBlock = DOCUMENT_STYLE.slice(DOCUMENT_STYLE.indexOf('@media print{'));
    expect(printBlock).toContain('.story #graph{position:static;max-height:none;overflow:visible;display:block}');
    expect(printBlock).toContain('#map g.n[data-state="ghost"] circle,#map g.n[data-state="ghost"] text{opacity:1!important}');
    expect(printBlock).toContain('#map .l[data-state="ceased"]{stroke-dasharray:none!important;opacity:1!important}');
  });

  it('carries no rule for chrome the document no longer renders', () => {
    expect(DOCUMENT_STYLE).not.toContain('.wt-controls');
  });

  it('styles the note eyebrow span in both the walkthrough card and the chapter note', () => {
    expect(DOCUMENT_STYLE).toContain('#wt-note .who,.chapter .note .who{display:block');
  });

  it('styles the opening block, the evidence line and the chapter sub-heads', () => {
    expect(DOCUMENT_STYLE).toContain('#wt-opening{');
    expect(DOCUMENT_STYLE).toContain('#wt-ev{');
    expect(DOCUMENT_STYLE).toContain('.chapter h4{');
    expect(DOCUMENT_STYLE).toContain('.kv{');
    expect(DOCUMENT_STYLE).toContain('nav.contents a.sub{');
  });
});


describe('presenter mode and print treatment', () => {
  it('lays presenting out as map beside one chapter, hides the rest, and has a slide zero', () => {
    expect(DOCUMENT_STYLE).toContain('body.presenting .story{display:grid;grid-template-columns:3fr 2fr');
    expect(DOCUMENT_STYLE).toContain('body.presenting .chapter{display:none}');
    expect(DOCUMENT_STYLE).toContain('body.presenting .chapter.current{display:grid');
    expect(DOCUMENT_STYLE).toContain('body.presenting.at-opening .slide0{display:block');
    expect(DOCUMENT_STYLE).toContain('.slide0{display:none}');
  });
  it('prints the map on its own page, keeps rows and chapters whole, repeats table heads and spells out footer links', () => {
    const printBlock = DOCUMENT_STYLE.slice(DOCUMENT_STYLE.indexOf('@media print{'));
    expect(printBlock).toContain('#graph{page-break-before:always}');
    expect(printBlock).toContain('.chapter{page-break-inside:auto}');
    expect(printBlock).toContain('.chapter{display:block}');
    expect(printBlock).toContain('.chapter .num{float:left;width:44px}');
    expect(printBlock).toContain('.chapter h3,.chapter .head,.chapter h4,h2{page-break-after:avoid}');
    expect(printBlock).toContain('tr,.facts,.chrono li,#chronology,.note,.chapter ul{page-break-inside:avoid}');
    expect(printBlock).toContain('.wrap{max-width:none;padding:6mm 10mm}');
    expect(printBlock).toContain('.story #graph .legend{display:flex}');
    expect(printBlock).toContain('h3.explorer{display:none!important}');
    expect(printBlock).toContain('thead{display:table-header-group}');
    expect(printBlock).toContain('footer a[href^="http"]::after{content:" (" attr(href) ")"');
    expect(printBlock).toContain('.wt-nav,.wt-tools,.slide0{display:none!important}');
    expect(DOCUMENT_STYLE).toContain('.wt-tools{display:flex;flex-wrap:wrap');
    expect(DOCUMENT_STYLE).toContain('html.nojs #wt-panel,html.nojs #wt-time{display:none}');
    expect(DOCUMENT_STYLE).toContain('#wt-counter,#wt-exit{white-space:nowrap}');
    expect(printBlock).toContain('.chapter.current{background:none!important');
  });
});
