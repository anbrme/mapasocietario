/**
 * Curated NON-listed companies: clean SEO slug → the exact v3 doc to render.
 * Unlike SEED (IBEX 35), these render the standard profile (no CNMV/GLEIF).
 * Every entry MUST pass `node scripts/check-curated.mjs` (resolves to the
 * intended company). Grow this set from real search demand (GSC) + submitted
 * statements. The `_` prefix means Cloudflare Pages does not route this file.
 */
export const CURATED = {
  'aldesa-energias-renovables-sl':   { name: 'Aldesa Energías Renovables', v3Name: 'ALDESA ENERGIAS RENOVABLES SL' },
  'aldesa-agrupacion-empresarial-sa':{ name: 'Aldesa Agrupación Empresarial', v3Name: 'ALDESA AGRUPACION EMPRESARIAL SA' },
  'nurnberg-consulting-sl':          { name: 'Nürnberg Consulting', v3Name: 'NURNBERG CONSULTING SL' },
};
