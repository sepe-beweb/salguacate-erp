import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './tests/production',
  outputDir: './test-results/railway',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3101' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js build && node scripts/check-web-bundle.cjs && node scripts/start-test-server.cjs',
    url: 'http://127.0.0.1:3101/api/health',
    env: { VITE_API_URL: '/', VITE_CLOUDINARY_CLOUD_NAME: 'e2e-synthetic', SALGUACATE_E2E_SERVE_WEB: 'true' },
    reuseExistingServer: false, timeout: 60000,
  },
});
