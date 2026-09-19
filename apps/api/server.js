const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { readConfig } = require('./config');
const { createDatabase } = require('./database');
const { createApp } = require('./index');
const { createCloudinaryImageStore } = require('./image-store');

async function start() {
  const config = readConfig();
  const db = createDatabase(config.filename);
  await db.ready;
  const imageStore = config.cloudinary ? createCloudinaryImageStore(config.cloudinary) : undefined;
  const app = createApp({ db, ...config, imageStore });
  const server = app.listen(config.port, config.host, () => console.log(`API ready on port ${config.port}`));
  server.on('error', () => { db.close(); process.exitCode = 1; });
  const close = () => server.close(() => db.close());
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
  return server;
}

if (require.main === module) start().catch(error => { console.error(`API startup failed: ${error.message}`); process.exitCode = 1; });
module.exports = { start };
