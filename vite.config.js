import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build identity, injected into the entry bundle (see main.jsx). Using the git
// short SHA guarantees the entry chunk's content — and therefore its content
// hash and filename — changes on every deploy, even when the diff only touches
// lazy-loaded chunks. Without this, a lazy-only change leaves index-*.js
// byte-identical → same hash → same immutable cache key, so a poisoned edge
// cache (a mid-deploy request that got the SPA HTML fallback cached as JS for a
// year) can't be dislodged by redeploying. That was the 2026-07-08 and
// 2026-07-11 blank-page incidents. Fall back to a timestamp when git is absent.
function resolveBuildId() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return `nogit-${Date.now()}`;
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(resolveBuildId()),
  },
  server: {
    port: 5174,
    // Fail loudly if 5174 is taken instead of drifting to 5175+, which is not
    // in the api-proxy Worker / Flask-CORS allowlists and would break CORS.
    strictPort: true,
  },
});
