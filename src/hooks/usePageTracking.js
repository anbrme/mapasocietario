import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsPagePath } from '../utils/analyticsPath';

export default function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: analyticsPagePath(location.pathname, location.search),
        page_title: document.title,
      });
    }
  }, [location.pathname, location.search]);
}
