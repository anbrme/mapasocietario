import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsPageLocation } from '../utils/analyticsPath';
import { isReturningGuideVisit, shouldTrackPageView } from '../utils/firstRunGuide';

// Snapshot taken at module load, which is the only point that reliably beats
// LandingPage's mount effect: React flushes child effects before the root's, so
// reading the flag inside the page_view effect would see the value LandingPage
// had just written and suppress the genuine first run we want to count.
const IS_RETURNING_GUIDE_VISITOR = typeof window === 'undefined'
  ? false
  : isReturningGuideVisit({ search: window.location.search, storage: window.localStorage });

export default function usePageTracking() {
  const location = useLocation();

  // This has to be a layout effect. AppRoutes owns the tracker, while the
  // route components below it emit product events from ordinary effects.
  // React runs descendant passive effects before an ancestor passive effect,
  // which let graph_view (and, on a returning visit, the redirect signal)
  // become the first hit of the session. GA4 then had no page_view from which
  // to populate Landing page and often no usable session_start attribution,
  // producing the large `(not set)` bucket. Layout effects finish before any
  // passive effect, so every route page_view is queued first.
  useLayoutEffect(() => {
    if (!shouldTrackPageView({
      pathname: location.pathname,
      isReturningGuideVisitor: IS_RETURNING_GUIDE_VISITOR,
    })) return;
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_location: analyticsPageLocation(location.pathname, location.search),
        page_title: document.title,
      });
    }
  }, [location.pathname, location.search]);
}
