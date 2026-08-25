import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsPagePath } from '../utils/analyticsPath';
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

  useEffect(() => {
    if (!shouldTrackPageView({
      pathname: location.pathname,
      isReturningGuideVisitor: IS_RETURNING_GUIDE_VISITOR,
    })) return;
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: analyticsPagePath(location.pathname, location.search),
        page_title: document.title,
      });
    }
  }, [location.pathname, location.search]);
}
