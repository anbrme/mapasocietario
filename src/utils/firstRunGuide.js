/**
 * The homepage is a one-shot first-run guide: LandingPage redirects a visitor
 * who has already seen it straight to /app.
 *
 * Two places have to answer the same question — the redirect itself, and the
 * page_view tracker that must NOT log a homepage view nobody was shown — so
 * the predicate lives here instead of being re-derived on each side.
 */
import { normalizeAnalyticsPathname } from './analyticsPath';

export const GUIDE_SEEN_KEY = 'ms_seen_guide';

// Canonical (trailing-slash) forms of the two homepage routes in main.jsx.
const LANDING_PATHS = new Set(['/', '/es/']);

export function isLandingPath(pathname) {
  return LANDING_PATHS.has(normalizeAnalyticsPathname(pathname));
}

// localStorage access throws outright in some private-browsing modes, so every
// read degrades to "first run" and every write is best-effort: showing the
// guide twice is harmless, hiding it from a first-timer is not.
export function hasSeenGuide(storage) {
  try {
    return storage?.getItem(GUIDE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markGuideSeen(storage) {
  try {
    storage?.setItem(GUIDE_SEEN_KEY, '1');
  } catch {
    /* storage unavailable (private mode, etc.) — just show the guide again */
  }
}

export function isReturningGuideVisit({ search, storage } = {}) {
  // ?guide=1 is the explicit "show me the guide again" escape hatch used by the
  // /app header's "How it works" icon.
  if (new URLSearchParams(search || '').get('guide') === '1') return false;
  return hasSeenGuide(storage);
}

/**
 * False only for the homepage view a returning visitor is redirected away from
 * before it renders. Counting those logged a sub-second "/" page_view for every
 * returning visit, which dragged the homepage's average engagement time down
 * with views nobody ever saw and made the first-run guide look like it was
 * being skimmed.
 */
export function shouldTrackPageView({ pathname, isReturningGuideVisitor } = {}) {
  return !(isReturningGuideVisitor && isLandingPath(pathname));
}
