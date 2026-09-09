import { handleNifRedirect } from '../../../empresa/_nif_redirect.js';

// Stable integration permalink: /en/company/nif/:nif
export const onRequestGet = (ctx) => handleNifRedirect(ctx, 'en');
