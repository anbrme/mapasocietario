import { Capacitor } from '@capacitor/core';

// The listed-companies hub (/empresas-cotizadas) and the per-company pages
// (/empresa/:slug) are server-rendered Cloudflare Pages Functions — they are
// NOT part of the SPA bundle and have no React route. On the web a normal link
// hits the SSR page. Inside the bundled Capacitor app there is no server, so we
// open the live page in an in-app Custom Tab instead (full feature: CNMV
// shareholders, BOE mentions, the relationship graph, bilingual).

const SITE = 'https://mapasocietario.es';

export const LISTED_COMPANIES_PATH = '/empresas-cotizadas';
export const LISTED_COMPANIES_URL = `${SITE}${LISTED_COMPANIES_PATH}`;

export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * Open the listed-companies hub.
 * - Web: navigate to the SSR route (relative path).
 * - Native app: open the live page in a Custom Tab; fall back to the system
 *   browser if the Browser plugin isn't available (e.g. cap sync not run).
 */
export async function openListedCompanies() {
  if (!isNativeApp()) {
    window.location.assign(LISTED_COMPANIES_PATH);
    return;
  }
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: LISTED_COMPANIES_URL, presentationStyle: 'popover' });
  } catch {
    window.open(LISTED_COMPANIES_URL, '_blank');
  }
}
