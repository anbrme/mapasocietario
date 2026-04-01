import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_title: document.title,
      });
    }
  }, [location]);
}

/** Call this when a DD purchase completes successfully. */
export function trackDDPurchase(country, companyName, value) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'purchase', {
      currency: 'EUR',
      value,
      items: [{
        item_name: `DD Report — ${country?.toUpperCase()}`,
        item_category: 'Due Diligence',
        price: value,
        quantity: 1,
      }],
      company_name: companyName,
    });
  }
}
