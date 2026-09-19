// Read-only guard for the compiled login entry and its static dependencies.
const fs = require('node:fs');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const root = path.resolve(__dirname, '..', 'dist', 'erp');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.vite', 'manifest.json'), 'utf8'));
const entries = Object.entries(manifest).filter(([, item]) => item.isEntry);
if (entries.length !== 1) throw new Error('Expected one web entry.');
const visited = new Set();
let bytes = 0;
let gzipBytes = 0;
function visit(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const item = manifest[key];
  if (!item) throw new Error('Missing static dependency in web manifest.');
  const data = fs.readFileSync(path.join(root, item.file));
  bytes += data.length;
  gzipBytes += gzipSync(data).length;
  for (const dependency of item.imports || []) visit(dependency);
}
visit(entries[0][0]);
console.log(JSON.stringify({ initialJavaScriptBytes: bytes, initialJavaScriptGzipBytes: gzipBytes, staticFiles: visited.size }));
// Includes static shared chunks, not just the smallest file labelled "index".
if (bytes > 250_000 || gzipBytes > 85_000) {
  throw new Error('Initial JavaScript exceeds the 250 kB / 85 kB gzip budget. Check eager route imports.');
}
const routes = Object.values(manifest).filter(item => item.isDynamicEntry && item.src?.startsWith('src/pages/'));
if (routes.length !== 19) throw new Error('Expected 19 deferred feature screens. Review the route split before changing this guard.');
