import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build identity, injected into the entry bundle (see main.jsx). Include the
// deployment attempt as well as the git SHA so retrying the same commit still
// creates a fresh entry filename. This gives us a deterministic recovery path
// if an edge cache ever stores the SPA HTML fallback under a JavaScript URL.
function resolveBuildId() {
  try {
    const gitSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const deploymentAttempt = process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`
      : `local-${Date.now()}`;
    return `${gitSha}-${deploymentAttempt}`;
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
