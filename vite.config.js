import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Fail loudly if 5174 is taken instead of drifting to 5175+, which is not
    // in the api-proxy Worker / Flask-CORS allowlists and would break CORS.
    strictPort: true,
  },
});
