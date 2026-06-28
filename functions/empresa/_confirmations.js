/**
 * Phase-1 currency confirmations: slug → a representative's dated, registry-
 * anchored confirmation that the company record is current. Rendered as a
 * decaying panel ABOVE the registry data; it NEVER overwrites BORME fields.
 * Every entry MUST pass `node scripts/check-confirmations.mjs` (the slug
 * resolves AND the representative is a current officer in BORME). The `_`
 * prefix means Cloudflare Pages does not route this file.
 */
export const CONFIRMATIONS = {
  'nurnberg-consulting-sl': {
    confirmedAt: '2026-06-28',
    representative: 'Alessandro Nürnberg',
    role: 'Administrador único',
    verification: 'registry-officer-match',
    affirms: [
      { label: 'Administrador único: Alessandro Nürnberg', status: 'current' },
      { label: 'Domicilio social: C/ Arzobispo Cos 10, Madrid', status: 'current' },
      { label: 'Situación concursal', status: 'none' },
      { label: 'Sociedad activa y operativa', status: 'current' },
    ],
  },
};
