/**
 * ES route: /empresa/:slug — Spanish company SEO page.
 * All logic lives in ./_lib.js (shared with the English /en/company/:slug route).
 */
import { handleCompany } from './_lib.js';

export const onRequestGet = (ctx) => handleCompany(ctx, 'es');
