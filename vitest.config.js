import { defineConfig } from 'vitest/config';

// Minimal config for pure-logic unit tests only — no jsdom, no component
// tests (see docs/superpowers/plans/2026-07-03-graph-entity-join-impl.md,
// Task G1). Canvas/UX behavior is verified by running the app, not here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'functions/**/*.test.js'],
  },
});
