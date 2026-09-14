/** /sitemap-demand-2.xml — wave 2: batch 2 (2026-09-07) onward. See sitemaps/_waves.js. */
import { demandWaveResponse } from './sitemaps/_demandWave.js';

export const onRequestGet = ({ env }) => demandWaveResponse(env, 2);
