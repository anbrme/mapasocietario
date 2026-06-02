/**
 * EN route: /en/company/:slug — English company SEO page.
 * Shares all logic with the Spanish /empresa/:slug route via _lib.js.
 */
import { handleCompany } from '../../empresa/_lib.js';

export const onRequestGet = (ctx) => handleCompany(ctx, 'en');
