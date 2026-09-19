const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const prefix = 'salguacate-e2e-uploads-';

function readTestUploadsDirectory(value) {
  if (value === undefined) return undefined;
  const base = fs.realpathSync(tmpdir());
  if (!path.isAbsolute(value) || path.dirname(value) !== base || !/^salguacate-e2e-uploads-[A-Za-z0-9]{6}$/.test(path.basename(value))) {
    throw new Error('E2E uploads must use a dedicated temporary sandbox.');
  }
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(value) !== value) throw new Error('Invalid E2E upload sandbox.');
  return value;
}

// The parent runner owns cleanup, including when a Playwright child fails.
// Never use application UPLOADS_DIR or delete a caller-supplied path.
function withTestUploads(work) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(tmpdir()), prefix));
  try { return work(dir); }
  finally {
    readTestUploadsDirectory(dir);
    fs.rmSync(dir, { recursive: true, maxRetries: 5, retryDelay: 100 });
  }
}

module.exports = { withTestUploads, readTestUploadsDirectory };
