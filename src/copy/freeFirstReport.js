// Single source of truth for the "first report is free" offer.
//
// The offer was announced on /due-diligence, /pricing and inside the checkout
// dialog — each with its own hand-typed wording. This module exists so the
// landing page and the prerenderer (which crawlers and AI answer engines read)
// state the same thing, and so the wording changes in one place.
//
// Import it from React components and from scripts/prerender.mjs alike; keep it
// free of JSX and of any browser or Node API so both can consume it.

export const FREE_FIRST_REPORT_COPY = {
  en: {
    headline: 'Your first report is on us',
    // The exclusion is not fine print: Cuentas Anuales cost a real EUR 11 per
    // company at the Registro Mercantil, so the free tier cannot include them.
    body: 'First time here? Your first due diligence report is free — everything except financial statements. No account, no card: tick "Use my free first report" when you order.',
    cta: 'Get your free report',
    sample: 'See a sample report (PDF)',
    // Short enough to sit inside the graph toolbar button, where space is tight
    // and the user is already looking at the company they care about.
    badge: '1st free',
  },
  es: {
    headline: 'Tu primer informe corre de nuestra cuenta',
    body: '¿Es tu primera vez? Tu primer informe de due diligence es gratis — todo excepto las cuentas anuales. Sin cuenta ni tarjeta: marca «Usar mi primer informe gratis» al hacer el pedido.',
    cta: 'Consigue tu informe gratis',
    sample: 'Ver un informe de ejemplo (PDF)',
    badge: '1º gratis',
  },
};

export const SAMPLE_REPORT_URL = '/sample-dd-report.pdf';

// The program switch. Empty string turns the offer off everywhere at once.
// Lives here rather than in DDCheckoutDialog so surfaces that only *announce*
// the offer (landing page, prerenderer) do not pull the 1.3k-line checkout
// dialog into their bundle. DDCheckoutDialog re-exports it for existing
// importers.
export const FREE_FIRST_REPORT_CODE = 'FIRSTFREE';
