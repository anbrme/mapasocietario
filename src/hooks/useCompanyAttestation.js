/**
 * The live attestation for a company node, or null.
 *
 * The in-app panel used to read a build-time map. Attestations are database
 * rows now, so this asks the same gated endpoint the /empresa badge renders
 * from - the app can never show more than the public page does.
 *
 * A failure yields null: an attestation badge is an addition to the panel, and
 * its absence must never break the panel.
 */
import { useEffect, useState } from 'react';

export function useCompanyAttestation(groupKey) {
  const [attestation, setAttestation] = useState(null);

  useEffect(() => {
    if (!groupKey) { setAttestation(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/verify/badge?group_key=${encodeURIComponent(groupKey)}`);
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled && data && data.ok) setAttestation(data.attestation || null);
      } catch { /* no badge is the correct degradation */ }
    })();
    return () => { cancelled = true; };
  }, [groupKey]);

  return attestation;
}
