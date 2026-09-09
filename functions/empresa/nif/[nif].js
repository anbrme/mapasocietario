import { handleNifRedirect } from '../_nif_redirect.js';

// Stable integration permalink: /empresa/nif/:nif
export const onRequestGet = (ctx) => handleNifRedirect(ctx, 'es');
