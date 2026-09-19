const serverless = require('serverless-http');
const { readConfig } = require('./config');
const { connectConfiguredDatabase } = require('./database-runtime');
const { createApp } = require('./index');
const { createCloudinaryImageStore } = require('./image-store');

// One initialization per warm function instance. Business state remains in Turso.
// Never bootstrap, read .env or fall back to ephemeral SQLite/uploads here.
function createServerlessHandler({ environment = () => process.env, connect = connectConfiguredDatabase, makeApp = createApp } = {}) {
  let initialization;
  async function initialize() {
    const env = environment();
    if (env.NODE_ENV !== 'production' || env.DATABASE_DRIVER !== 'libsql' || env.IMAGE_STORAGE !== 'cloudinary') {
      throw new Error('Serverless requires explicit remote production configuration.');
    }
    const config = readConfig(env);
    const db = await connect(config);
    try {
      const app = makeApp({ db, ...config, imageStore: createCloudinaryImageStore(config.cloudinary) });
      return serverless(app);
    } catch {
      try { await db.close(); } catch { /* Never expose provider diagnostics. */ }
      throw new Error('Serverless initialization failed.');
    }
  }
  return async (event, context = {}) => {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
      if (!initialization) initialization = initialize().catch(error => { initialization = undefined; throw error; });
      const handler = await initialization;
      // Netlify may deliver the original path or the function rewrite target.
      const prefix = '/.netlify/functions/api';
      const path = event.path === prefix || event.path?.startsWith(prefix + '/')
        ? '/api' + event.path.slice(prefix.length) : event.path;
      return await handler({ ...event, path }, context);
    } catch {
      return { statusCode: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ error: 'Servicio no disponible. No repitas una escritura sin comprobar su resultado.' }) };
    }
  };
}

module.exports = { createServerlessHandler };
