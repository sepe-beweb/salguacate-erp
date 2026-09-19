// Each spec owns a fresh in-memory API. Do not weaken production login limits
// or depend on data left behind by a previous spec as the suite grows.
const { readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { withTestUploads } = require('./test-upload-sandbox.cjs');
const root = resolve(__dirname, '..');
const cli = resolve(root, 'node_modules/@playwright/test/cli.js');
const extra = process.argv.slice(2);
const specs = extra.length ? [null] : readdirSync(resolve(root, 'tests/e2e')).filter(name => name.endsWith('.spec.ts')).sort();
if (!specs.length) throw new Error('No E2E specs found.');
for (const spec of specs) {
  const args = spec ? [spec, '--output', `test-results/e2e/${spec.replace(/\.spec\.ts$/, '')}`] : extra;
  const result = withTestUploads(uploads => spawnSync(process.execPath, [cli, 'test', ...args], {
    cwd: root, env: { ...process.env, SALGUACATE_E2E_UPLOADS: uploads }, stdio: 'inherit'
  }));
  if (result.error) throw result.error;
  if (result.status !== 0) { process.exitCode = result.status || 1; break; }
}
