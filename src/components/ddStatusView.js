// Pure view-model for a DD-only order's generation status (no rendering deps,
// so it runs under the node-env unit test config). The MUI chip lives in
// AdminDdStatus.jsx and consumes this.

// A DD-only order is "taking long" once it has been generating past this age —
// generation normally finishes in ~3 min. Past it, we offer a retry.
export const DD_TAKING_LONG_MS = 10 * 60 * 1000;

/**
 * @param {{ status?: string, ddState?: string, ddReason?: string|null,
 *           ddAttempts?: number, ddStartedAt?: string|null, createdAt?: string }} order
 * @param {number} nowMs - current time in ms (injected for deterministic tests)
 * @returns {{ label: string, color: string, showRetry: boolean }}
 */
export function ddStatusView(order, nowMs) {
  // The stored PDF is authoritative for "ready".
  if (order.status === 'completed' || order.ddState === 'ready') {
    return { label: 'Ready', color: 'success', showRetry: false };
  }

  const startMs = new Date(order.ddStartedAt || order.createdAt || nowMs).getTime();
  const ageMin = Math.max(0, Math.round((nowMs - startMs) / 60000));
  const attempts = order.ddAttempts || 0;
  const attemptsSuffix = attempts ? ` · ${attempts} attempt${attempts === 1 ? '' : 's'}` : '';

  switch (order.ddState) {
    case 'generating':
      if (nowMs - startMs >= DD_TAKING_LONG_MS) {
        return { label: `Generating — taking long (${ageMin}m)`, color: 'warning', showRetry: true };
      }
      return { label: `Generating… (${ageMin}m)`, color: 'info', showRetry: false };
    case 'failed':
      return { label: `Failed: ${order.ddReason || 'unknown'}${attemptsSuffix}`, color: 'error', showRetry: true };
    case 'never_started':
    default:
      return { label: 'Never started', color: 'error', showRetry: true };
  }
}
