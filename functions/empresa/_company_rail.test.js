import { describe, it, expect } from 'vitest';
import { renderCompanyPage } from './_lib.js';

const COMPANY = {
  company_name: 'ACME TEST SL',
  nif: 'B12345678',
  last_seen: '2026-08-01',
  total_publications: 80,
};
const SEED = { name: 'ACME TEST SL' };
const render = (lang = 'es') => renderCompanyPage(COMPANY, [], 'acme-test-sl', SEED, lang);

/**
 * The desktop rail.
 *
 * The page this replaces spent its entire first screen selling: two hero
 * buttons, then an "at a glance" card carrying a THIRD identical link to
 * /app/?search=. A reader who searched a company by name was shown a sales
 * panel twice before the registry table, and the second hero button existed
 * only to jump over it. Meanwhile the paid report sat below the whole filing
 * history, where 83% of visitors never scroll — it recorded ZERO view_item
 * events in the week of 24-30 Aug 2026, from 192 landers.
 */
describe('the desktop rail on a company page', () => {
  it('renders exactly one rail, holding the report offer and the monitoring form', () => {
    const html = render();

    expect(html.match(/class="rail"/g)).toHaveLength(1);

    const railStart = html.indexOf('class="rail"');
    const rail = html.slice(railStart, html.indexOf('</aside>', railStart));

    expect(rail).toContain('profile_due_diligence');
    expect(rail).toContain('id="mon-form"');
    expect(rail).toContain('data-track="profile_graph_open"');
  });

  it('gives the graph trigger the counts that justify pressing it', () => {
    const html = render();
    const railStart = html.indexOf('class="rail"');
    const rail = html.slice(railStart, html.indexOf('</aside>', railStart));

    // The four counts move out of the promo card and next to the trigger, so
    // the button makes a claim about THIS company rather than naming a feature.
    expect(rail).toContain('rail-stat');
    expect(rail).toContain('80');
  });
});

/**
 * Mobile was deliberately left alone this round: it is 53% of the cohort and
 * bounces at 51%, but changing it and the desktop layout in the same step
 * would leave neither measurable. One DOM serves both, so these tests pin the
 * mobile arrangement in place while the desktop one moves around it.
 */
describe('the mobile arrangement, which this change must not disturb', () => {
  it('keeps the hero actions and the at-a-glance card in the document', () => {
    const html = render();

    expect(html).toContain('class="hero-actions"');
    expect(html).toContain('class="overview"');
  });

  it('keeps the report offer and monitoring form last, in that order', () => {
    const html = render();

    expect(html.indexOf('profile_due_diligence')).toBeLessThan(html.indexOf('id="mon-form"'));
    expect(html.indexOf('id="mon-form"')).toBeLessThan(html.indexOf('<footer>'));
  });

  it('hides the promo duplicates on desktop rather than deleting them', () => {
    const html = render();

    // Hidden, not removed: deleting them would change the phone layout, which
    // this round is explicitly not doing.
    expect(html).toContain('.hero-actions{display:none}');
    expect(html).toContain('.overview{display:none}');
  });
});

describe('the graph overlay', () => {
  it('opens on the page instead of navigating to the search app', () => {
    const html = render();

    // A button, not a link: the whole defect being fixed is that pressing it
    // took a reader out of the data sheet they came for and dropped them into
    // a search box they had already finished using.
    expect(html).toMatch(/<button[^>]*data-track="profile_graph_open"/);
    expect(html).toContain('id="graph-overlay"');
    expect(html).toContain('<dialog');
  });

  it('keeps an escape to the full app for people who do want the search tool', () => {
    const html = render();
    const overlay = html.slice(html.indexOf('id="graph-overlay"'));

    expect(overlay).toContain('/app/?search=');
    expect(overlay).toContain('profile_graph_to_app');
  });

  it('frames the real graph rather than reimplementing it', () => {
    const html = render();

    // A hand-rolled force graph here was a second implementation of the app's
    // graph and looked nothing like it: every officer plotted instead of the
    // ~10 Simplify leaves, one link colour instead of appointments vs
    // cessations, no role labels, no company/person shapes. Framing the app
    // means it cannot drift, and every future improvement to the graph lands
    // on these pages for free.
    expect(html).toMatch(/<iframe[^>]*id="graph-frame"/);
    expect(html).toContain('embed=1');
    expect(html).not.toContain('force-graph.min.js');
  });

  it('loads nothing until the trigger is pressed', () => {
    const html = render();

    // These pages ARE the SEO surface. Booting a React app on page load would
    // buy an interaction nobody asked for with the LCP of every company page.
    // The URL waits in data-src until the dialog opens.
    expect(html).toMatch(/<iframe[^>]*data-src="/);
    expect(html).not.toMatch(/<iframe[^>]*\ssrc="/);
    expect(html).toContain("frame.setAttribute('src',frame.getAttribute('data-src'))");
  });
});

describe('CTA tracking', () => {
  it('fires a distinct event name per action, not a parameter', () => {
    const html = render();

    // customEvent:action reads "(not set)" on this property — custom-dimension
    // registration is blocked and is not retroactive — so the action has to be
    // carried by the event NAME, which is always queryable.
    expect(html).toContain("gtag('event',link.getAttribute('data-track')");
    // The existing aggregate event keeps firing so its history stays continuous.
    expect(html).toContain("gtag('event','company_profile_cta_click'");
  });
});

describe('rail styling', () => {
  it('hides the duplicate graph link inside the report card with enough specificity to win', () => {
    const html = render();

    // `.cta a{display:inline-block}` is 0-1-1. A bare `.cta-secondary{display:none}`
    // is 0-1-0 and LOSES, which left the old "Abrir mapa interactivo" button
    // visible in the rail next to the overlay trigger it was meant to replace.
    expect(html).toContain('.rail .cta-secondary{display:none}');
  });

  it('gives the rail room to read as a separate column', () => {
    const html = render();

    // 32px read as the rail being pressed against the data sheet while floating
    // away from the page edge.
    expect(html).toMatch(/grid-template-columns:minmax\(0,1fr\) 320px;gap:48px/);
  });

  it('never strands the monitoring form below the fold', () => {
    const html = render();

    // A sticky rail taller than the viewport pins its top and puts its bottom
    // permanently out of reach — the email field could not be clicked at all.
    // Bounding it to the viewport and letting it scroll internally makes every
    // card reachable at any window height. NOT overscroll-behavior:contain:
    // that would swallow the wheel and trap the page scroll under the cursor.
    expect(html).toMatch(/\.rail\{[^}]*max-height:calc\(100vh - 48px\)/);
    expect(html).toMatch(/\.rail\{[^}]*overflow-y:auto/);
    expect(html).not.toContain('overscroll-behavior:contain');
  });

  it('does not let the email field inherit a 240px flex-basis as its height', () => {
    const html = render();

    // `.mon input{flex:1 1 240px}` was written for the form's original ROW
    // layout, where 240px is a WIDTH. The rail turns that form into a column,
    // which flips the main axis and made 240px the input's HEIGHT — a ~240px
    // tall box to type an email into. Anything that changes flex-direction
    // must reset the basis its children were written against.
    expect(html).toMatch(/\.rail \.mon input\{flex:0 0 auto/);
  });

  it('keeps the report card quiet on a light page', () => {
    const html = render();
    // Full-bleed saturated blue is fine as a full-width band at the bottom of a
    // phone screen; as a 320px block halfway up a near-white desktop page it
    // shouts. Light card, one blue button.
    expect(html).toMatch(/\.rail \.cta\{[^}]*background:#f8fafc/);
  });
});

/**
 * Mobile web (NOT the Capacitor app, which ships the vite SPA and has never
 * contained these pages). 53% of the company-page cohort, 51% bounce, 56s
 * against desktop's 162s — but scrolling to 90% at 19% vs desktop's 17%, so
 * they scroll just as much and simply leave sooner. The first screen was two
 * full-width buttons and a stat card before a single registry fact.
 */
describe('the phone layout', () => {
  it('puts the actions between the officers and the filing history', () => {
    const html = render();

    const a = html.indexOf('class="sheet-a"');
    const rail = html.indexOf('<aside class="rail">');
    const b = html.indexOf('class="sheet-b"');

    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(-1);
    // Single column on a phone follows DOM order, so this ordering IS the
    // placement: data, then what to do about it, then the long tail.
    expect(a).toBeLessThan(rail);
    expect(rail).toBeLessThan(b);
  });

  it('starts the registry data on the first screen', () => {
    const html = render();

    // The promo that used to occupy roughly two phone screens.
    expect(html).toContain('.hero-actions{display:none}');
    expect(html).toContain('.overview-action{display:none}');
    // The counts survive as a text line — information, not a call to action.
    expect(html).toMatch(/@media\(max-width:1023px\)[\s\S]*?\.overview-grid\{display:block/);
  });

  it('links a phone straight to the app instead of opening the overlay', () => {
    const html = render();

    // A force graph of 80-odd nodes under a thumb is worse than the app, which
    // at least has touch pan and zoom. Desktop keeps the overlay.
    expect(html).toMatch(/<a[^>]*class="rail-graph-link"[^>]*href="\/app\/\?search=/);
    expect(html).toContain('.rail-graph-link{display:none}');
    expect(html).toContain('.rail-graph-btn{display:none}');
  });

  it('moves the monitoring form into a dialog behind a floating button', () => {
    const html = render();

    expect(html).toContain('id="mon-fab"');
    expect(html).toContain('id="monitor-dialog"');
    // MOVED, never copied: the form binds by id and a second id="mon-form"
    // would be invalid HTML and would break the existing submit handler.
    expect(html.match(/id="mon-form"/g)).toHaveLength(1);
    expect(html).toContain('monitorDialog.appendChild');
    // Gated on the phone breakpoint. Moving it unconditionally would pull the
    // form out of the desktop rail while the button that opens it is
    // display:none there — the form would exist and be unreachable.
    expect(html).toContain("matchMedia('(max-width:1023px)').matches");
  });
});

describe('the framed graph', () => {
  it('offers one expand control that really opens a tab', () => {
    const html = render();
    const overlay = html.slice(html.indexOf('id="graph-overlay"'), html.indexOf('</dialog>'));

    // It had no target, so it navigated the company page away — the opposite
    // of expanding. And it was labelled "explore relationships on the map"
    // while the reader was already looking at the map.
    expect(overlay).toMatch(/<a[^>]*class="go-app"[^>]*target="_blank"/);
    expect(overlay).toMatch(/<a[^>]*class="go-app"[^>]*rel="[^"]*noopener/);
    expect(overlay).toContain('profile_graph_to_app');
    expect(overlay).not.toContain('Explorar relaciones en el mapa</a>');
  });

  it('states the framed view is the whole graph without repeating the action', () => {
    const html = render();
    const overlay = html.slice(html.indexOf('id="graph-overlay"'), html.indexOf('</dialog>'));

    expect(overlay).toContain('go-foot');
    // Two controls saying "open it" either side of the same graph is the
    // awkwardness this section is meant to remove.
    expect(overlay).not.toContain('ábrelo');
  });
});

/**
 * /empresa and /en/company share renderCompanyPage, so the layout is
 * language-agnostic by construction — but the COPY is not. Every string added
 * to the rail, the overlay or the launcher has to be added to both dictionaries,
 * and a miss renders Spanish on an English page rather than failing.
 */
describe('the English page', () => {
  // A seed WITH a ticker, so the listed-company block actually renders. The
  // bare SEED above has none, and a fixture that does not exercise a block
  // cannot catch a missing string inside it — the first version of this test
  // passed happily with `listedQuote` deleted from the English dictionary.
  const LISTED_SEED = { name: 'ACME TEST SL', ticker: 'BME:ACME', isin: 'ES0000000000', hoja: 'M 1' };
  const en = renderCompanyPage(COMPANY, [], 'acme-test-sl', LISTED_SEED, 'en');

  it('gets the same structure as the Spanish one', () => {
    for (const marker of [
      'class="sheet-a"', '<aside class="rail"', 'class="sheet-b"',
      'class="rail-graph-btn"', 'class="rail-graph-link"',
      'id="mon-fab"', 'id="monitor-dialog"', 'id="graph-overlay"',
    ]) {
      expect(en, marker).toContain(marker);
    }
  });

  it('carries every string this work added, in English', () => {
    // The failure mode is SILENT. `const t = T[lang] || T.es` picks one
    // dictionary outright, and esc() maps null/undefined to '' — so a key
    // added to `es` alone renders an EMPTY link or an unlabelled button, not
    // Spanish text and not the word "undefined". Two earlier versions of this
    // test checked for both of those and passed with the key deleted. Naming
    // the expected strings is the only assertion that actually fails.
    for (const text of [
      'Listed company', 'View quote', 'Get alerts for this company',
      'Close', 'Loading the graph', 'Explore relationships on the map',
      'Follow this company', 'the same tools as the app', 'Open in a new tab',
    ]) {
      expect(en, text).toContain(text);
    }
  });
});
