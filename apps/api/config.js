const path = require('node:path');
const { readCloudinaryConfig } = require('./image-store');
const { readTursoConfig } = require('./libsql');

function readConfig(env = process.env) {
  const databaseDriver = env.DATABASE_DRIVER || 'sqlite';
  if (!['sqlite', 'libsql'].includes(databaseDriver)) throw new Error('DATABASE_DRIVER must be sqlite or libsql.');
  if (databaseDriver === 'sqlite' && ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'TURSO_DATABASE_HOST'].some(key => env[key])) throw new Error('Turso configuration requires DATABASE_DRIVER=libsql.');
  if (databaseDriver === 'libsql' && env.SQLITE_DATABASE_PATH) throw new Error('Turso cannot be combined with SQLITE_DATABASE_PATH.');
  const turso = databaseDriver === 'libsql' ? readTursoConfig(env) : undefined;
  if (databaseDriver === 'libsql' && env.DOCUMENTS_DIR) throw new Error('Remote documents require a persistent private storage adapter; local fallback is not supported.');
  const production = env.NODE_ENV === 'production';
  const imageDriver = env.IMAGE_STORAGE || 'local';
  if (!['local', 'cloudinary'].includes(imageDriver)) throw new Error('IMAGE_STORAGE must be local or cloudinary.');
  if (imageDriver === 'local' && ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].some(key => env[key])) throw new Error('Cloudinary credentials require IMAGE_STORAGE=cloudinary.');
  if (imageDriver === 'cloudinary' && env.UPLOADS_DIR) throw new Error('Cloudinary cannot be combined with a local UPLOADS_DIR.');
  const cloudinary = imageDriver === 'cloudinary' ? readCloudinaryConfig(env) : undefined;
  if (production && (!env.CORS_ORIGINS || (databaseDriver === 'sqlite' && !env.SQLITE_DATABASE_PATH))) throw new Error('Production requires CORS_ORIGINS and an explicit database destination.');
  if (production && databaseDriver === 'libsql' && imageDriver !== 'cloudinary') throw new Error('Remote production requires Cloudinary; ephemeral local uploads are not supported.');
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
    databaseDriver, turso,
    documentsDir: databaseDriver === 'sqlite' ? path.resolve(env.DOCUMENTS_DIR || path.join(path.dirname(path.resolve(env.SQLITE_DATABASE_PATH || path.join(__dirname, 'database.sqlite'))), 'documents')) : undefined,
    filename: databaseDriver === 'sqlite' ? path.resolve(env.SQLITE_DATABASE_PATH || path.join(__dirname, 'database.sqlite')) : undefined,
    origins, port, host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'),
    uploadsDir: imageDriver === 'local' ? path.resolve(env.UPLOADS_DIR || path.join(__dirname, 'uploads')) : undefined,
    cloudinary,
    aiEnabled: env.AI_ENABLED === 'true',
  };
}

module.exports = { readConfig };
