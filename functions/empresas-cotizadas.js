/**
 * ES hub: /empresas-cotizadas — IBEX 35 listed-companies index.
 */
import { handleHub } from './empresa/_lib.js';

export const onRequestGet = (ctx) => handleHub(ctx, 'es');
