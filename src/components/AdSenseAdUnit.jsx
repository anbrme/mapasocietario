import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

const ADSENSE_CLIENT_ID = 'ca-pub-6049719242932136';
const ADSENSE_SLOT_ID = '1413277990';

export default function AdSenseAdUnit() {
  const adElementRef = useRef(null);
  const adRequestedRef = useRef(false);

  useEffect(() => {
    if (adRequestedRef.current || !adElementRef.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      adRequestedRef.current = true;
    } catch (error) {
      // Script may still be loading or blocked by extensions/privacy settings.
      console.error('AdSense ad request failed:', error);
    }
  }, []);

  return (
    <Box sx={{ width: '100%', maxWidth: 500, minHeight: 100 }}>
      <ins
        ref={adElementRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={ADSENSE_SLOT_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </Box>
  );
}
