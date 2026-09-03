import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNativeApp } from '../services/listedCompaniesNav';

export const NATIVE_BACK_EVENT = 'mapa-societario:native-back';

/**
 * Android hardware/gesture back handling for the native app.
 *
 * Without this, pressing back (or the back gesture) on any SPA route other than
 * the homepage closes the app, because nothing maps the Android back button to
 * the in-app history. Here we navigate within the SPA instead, and only exit
 * the app when already at the homepage.
 *
 * No-op on the web (the browser's own back button handles history there).
 */
export default function useAndroidBackButton() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    let removeHandle = null;
    let cancelled = false;

    import('@capacitor/app')
      .then(({ App }) => {
        if (cancelled) return;
        // App.addListener resolves to a handle with .remove().
        App.addListener('backButton', () => {
          // Stateful overlays (such as the compact landing graph) can consume
          // Back before the route-level fallback navigates or exits the app.
          const event = new Event(NATIVE_BACK_EVENT, { cancelable: true });
          if (!window.dispatchEvent(event)) return;
          if (window.location.pathname === '/') {
            App.exitApp();
          } else {
            navigate(-1);
          }
        }).then((handle) => {
          if (cancelled) handle.remove();
          else removeHandle = () => handle.remove();
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (removeHandle) removeHandle();
    };
  }, [navigate]);
}
