const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('./http');

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
function readImage(value) {
  const match = typeof value === 'string' && /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new HttpError(400, 'Solo se admiten imágenes PNG o JPEG.');
  const bytes = Buffer.from(match[2], 'base64');
  const validHeader = match[1] === 'png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
  if (!validHeader || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) throw new HttpError(400, 'Imagen inválida o superior a 3 MB.');
  return { bytes, format: match[1] === 'png' ? 'png' : 'jpg' };
}

function createLocalImageStore(directory) {
  const root = path.resolve(directory);
  return {
    async save({ bytes, format }) {
      if (!Buffer.isBuffer(bytes) || bytes.length > MAX_IMAGE_BYTES || !['png', 'jpg'].includes(format)) throw new Error('Invalid image input.');
      const filename = `${randomUUID()}.${format}`;
      const target = path.join(root, filename);
      await fs.writeFile(target, bytes, { flag: 'wx' });
      return { url: `/uploads/${filename}`, remove: () => fs.unlink(target) };
    },
  };
}

function readCloudinaryConfig(env) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME, apiKey = env.CLOUDINARY_API_KEY, apiSecret = env.CLOUDINARY_API_SECRET;
  if (typeof cloudName !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(cloudName) ||
      typeof apiKey !== 'string' || !/^\d{1,64}$/.test(apiKey) ||
      typeof apiSecret !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(apiSecret)) {
    throw new Error('Cloudinary requires an explicit cloud name, API key and API secret.');
  }
  return { cloudName, apiKey, apiSecret };
}

function createCloudinaryImageStore(config, transport = fetch) {
  const { cloudName, apiKey, apiSecret } = readCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: config.cloudName, CLOUDINARY_API_KEY: config.apiKey, CLOUDINARY_API_SECRET: config.apiSecret });
  const authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  async function send(action, fields) {
    try {
      const response = await transport(`https://api.cloudinary.com/v1_1/${cloudName}/image/${action}`, {
        method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields), redirect: 'error', signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error('Provider rejected request.');
      return await response.json();
    } catch {
      // Never expose provider bodies, credentials, signatures or submitted files.
      throw new HttpError(502, 'No se pudo confirmar el almacenamiento de la imagen.');
    }
  }
  return {
    async save({ bytes, format }) {
      if (!Buffer.isBuffer(bytes) || bytes.length > MAX_IMAGE_BYTES || !['png', 'jpg'].includes(format)) throw new Error('Invalid image input.');
      const publicId = `salguacate/inventory/${randomUUID()}`;
      const data = await send('upload', {
        file: `data:image/${format === 'png' ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`,
        public_id: publicId, asset_folder: 'salguacate/inventory', overwrite: 'false', unique_filename: 'false', use_filename: 'false',
      });
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(502, 'El almacenamiento devolvió una referencia de imagen inválida.');
      const extension = data.format;
      const url = `https://res.cloudinary.com/${cloudName}/image/upload/v${data.version}/${publicId}.${extension}`;
      if (data.public_id !== publicId || (data.asset_folder !== undefined && data.asset_folder !== 'salguacate/inventory') || data.resource_type !== 'image' || data.type !== 'upload' || data.existing === true ||
          !Number.isSafeInteger(data.version) || data.version < 1 || !['png', 'jpg', 'jpeg'].includes(extension) ||
          !Number.isSafeInteger(data.bytes) || data.bytes < 1 || data.bytes > MAX_IMAGE_BYTES || data.secure_url !== url) {
        throw new HttpError(502, 'El almacenamiento devolvió una referencia de imagen inválida.');
      }
      return {
        url,
        async remove() {
          const result = await send('destroy', { public_id: publicId, invalidate: 'true' });
          if (!['ok', 'not found'].includes(result.result)) throw new Error('Image removal was not confirmed.');
        },
      };
    },
  };
}

module.exports = { readImage, createLocalImageStore, readCloudinaryConfig, createCloudinaryImageStore };
