import { defineConfig } from '@playwright/test';
import base from './playwright.config';

if (!Array.isArray(base.webServer)) throw new Error('Expected isolated frontend and API test servers.');
const [frontend, api] = base.webServer;

export default defineConfig({
  ...base,
  testDir: './tests/production',
  outputDir: './test-results/production',
  webServer: [
    {
      ...frontend,
      command: 'node node_modules/vite/bin/vite.js build && node scripts/check-web-bundle.cjs && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5174 --strictPort',
    },
    api,
  ],
});
