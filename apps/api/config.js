const path = require('node:path');
const { readCloudinaryConfig } = require('./image-store');

function readConfig(env = process.env) {
  if (env.TURSO_DATABASE_URL || env.TURSO_AUTH_TOKEN) {
    throw new Error('Turso requires an explicit export/migration to SQLite before starting this version.');
  }
  const production = env.NODE_ENV === 'production';
  const imageDriver = env.IMAGE_STORAGE || 'local';
  if (!['local', 'cloudinary'].includes(imageDriver)) throw new Error('IMAGE_STORAGE must be local or cloudinary.');
  if (imageDriver === 'local' && ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].some(key => env[key])) throw new Error('Cloudinary credentials require IMAGE_STORAGE=cloudinary.');
  if (imageDriver === 'cloudinary' && env.UPLOADS_DIR) throw new Error('Cloudinary cannot be combined with a local UPLOADS_DIR.');
  const cloudinary = imageDriver === 'cloudinary' ? readCloudinaryConfig(env) : undefined;
  if (production && (!env.SQLITE_DATABASE_PATH || !env.CORS_ORIGINS)) {
    throw new Error('Production requires SQLITE_DATABASE_PATH and CORS_ORIGINS.');
  }
  const origins = (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error('CORS_ORIGINS cannot be empty.');
  if (env.AI_ENABLED === 'true' && !env.GEMINI_API_KEY) throw new Error('AI_ENABLED requires GEMINI_API_KEY.');
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || origin !== url.origin || (production && url.protocol !== 'https:')) {
      throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins; production requires HTTPS.');
    }
  }
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return {
    filename: path.resolve(env.SQLITE_DATABASE_PATH || path.join(__dirname, 'database.sqlite')),
    origins, port, host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'),
    uploadsDir: imageDriver === 'local' ? path.resolve(env.UPLOADS_DIR || path.join(__dirname, 'uploads')) : undefined,
    cloudinary,
    aiEnabled: env.AI_ENABLED === 'true',
  };
}

module.exports = { readConfig };
