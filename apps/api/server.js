const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { readConfig } = require('./config');
const { connectConfiguredDatabase } = require('./database-runtime');
const { createApp } = require('./index');
const { createCloudinaryImageStore } = require('./image-store');
const { assertVolumeMounted } = require('./railway-volume');

async function start(config = readConfig(), connect = connectConfiguredDatabase) {
  if (config.volumeMount) assertVolumeMounted(config.volumeMount);
  const db = await connect(config);
  let closing;
  const closeDatabase = () => closing ||= Promise.resolve().then(() => db.close());
  try {
    const imageStore = config.cloudinary ? createCloudinaryImageStore(config.cloudinary) : undefined;
    const app = createApp({ db, ...config, imageStore });
    const server = app.listen(config.port, config.host);
    const close = () => server.close();
    server.once('close', () => {
      process.removeListener('SIGTERM', close); process.removeListener('SIGINT', close);
      void closeDatabase().catch(() => { console.error('Database shutdown failed.'); process.exitCode = 1; });
    });
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    process.once('SIGTERM', close); process.once('SIGINT', close);
    console.log(`API ready on port ${server.address().port}`);
    return server;
  } catch {
    try { await closeDatabase(); } catch { /* No SDK diagnostics in startup output. */ }
    throw new Error('API could not start.');
  }
}

if (require.main === module) start().catch(() => { console.error('API startup failed. Check the explicit service configuration and database readiness.'); process.exitCode = 1; });
module.exports = { start };
