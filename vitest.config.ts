import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { test: { name: 'api', environment: 'node', include: ['apps/api/tests/**/*.test.js'], testTimeout: 15000, hookTimeout: 15000 } },
      { extends: true, test: { name: 'web', environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'], include: ['apps/erp-web/src/**/*.{test,spec}.{ts,tsx}', 'tests/components/**/*.{test,spec}.{ts,tsx}'] } },
    ],
  },
});
