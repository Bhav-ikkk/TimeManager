import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    // Run in a DST-observing timezone so date math that silently assumes a
    // fixed UTC offset fails loudly in CI (most contributors are in IST,
    // which has no DST).
    env: { TZ: 'America/New_York' },
    include: ['src/**/*.test.js'],
  },
});
