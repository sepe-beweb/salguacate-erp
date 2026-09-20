import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import request from 'supertest';
const require = createRequire(import.meta.url);
const { createCloudinaryImageStore, readImage } = require('../image-store');
const { readConfig } = require('../config');
const { createDatabase } = require('../database');
const { createAsyncStore } = require('../async-store');
const { createApp } = require('../index');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
const config = { cloudName: 'synthetic-cloud', apiKey: '123456789', apiSecret: 'synthetic-secret' };
const png = 'data:image/png;base64,iVBORw0KGgo=';
function uploaded(options, changes = {}) {
  const publicId = options.body.get('public_id');
  return { public_id: publicId, resource_type: 'image', type: 'upload', version: 123, bytes: 8, format: 'png',
    secure_url: `https://res.cloudinary.com/synthetic-cloud/image/upload/v123/${publicId}.png`, ...changes };
}
describe('Explicit Cloudinary storage (transport mocked)', () => {
  it('uses a fixed HTTPS backend endpoint without retries, redirecting credentials or overwrite', async () => {
    const calls = [];
    const transport = vi.fn(async (url, options) => { calls.push({ url, options }); return Response.json(url.endsWith('/upload') ? uploaded(options) : { result: 'ok' }); });
    const store = createCloudinaryImageStore(config, transport);
    const image = await store.save(readImage(png));
    expect(image.url).toMatch(/^https:\/\/res.cloudinary.com\/synthetic-cloud\/image\/upload\/v123\/salguacate\/inventory\/.*\.png$/);
    const { url, options } = calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/synthetic-cloud/image/upload');
    expect(url).not.toContain(config.apiSecret); expect(options.redirect).toBe('error');
    expect(options.headers.Authorization).toBe(`Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`);
    expect(options.body.get('file')).toBe(png); expect(options.body.get('overwrite')).toBe('false');
    expect(options.body.get('asset_folder')).toBe('salguacate/inventory');
    expect(options.body.get('api_secret')).toBeNull(); expect(options.signal).toBeInstanceOf(AbortSignal);
    await image.remove();
    expect(calls[1].url).toBe('https://api.cloudinary.com/v1_1/synthetic-cloud/image/destroy');
    expect(calls[1].options.body.get('public_id')).toBe(options.body.get('public_id'));
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it.each([
    { secure_url: 'https://evil.test/photo.png' }, { public_id: 'someone-else' }, { type: 'private' }, { resource_type: 'raw' },
    { existing: true }, { version: '123' }, { bytes: 4000000 }, { format: 'svg' }, { asset_folder: 'another-folder' },
  ])('rejects unexpected provider metadata %j without deleting unrelated assets', async changes => {
    const transport = vi.fn(async (_url, options) => Response.json(uploaded(options, changes)));
    await expect(createCloudinaryImageStore(config, transport).save(readImage(png))).rejects.toMatchObject({ status: 502 });
    expect(transport).toHaveBeenCalledOnce();
  });
  it.each(['timeout', 'rejected', 'malformed'])('does not leak provider diagnostics or replay an uncertain %s upload', async mode => {
    const transport = vi.fn(async () => {
      if (mode === 'timeout') throw new Error(`private ${config.apiSecret} ${png}`);
      return new Response(`private ${config.apiSecret} ${png}`, { status: mode === 'rejected' ? 401 : 200 });
    });
    let error;
    try { await createCloudinaryImageStore(config, transport).save(readImage(png)); } catch (caught) { error = caught; }
    expect(error.status).toBe(502); expect(String(error)).not.toMatch(/synthetic-secret|base64/); expect(transport).toHaveBeenCalledOnce();
  });
  it('requires explicit complete remote configuration and rejects accidental local fallback', () => {
    const env = { IMAGE_STORAGE: 'cloudinary', CLOUDINARY_CLOUD_NAME: config.cloudName, CLOUDINARY_API_KEY: config.apiKey, CLOUDINARY_API_SECRET: config.apiSecret };
    expect(readConfig(env)).toMatchObject({ cloudinary: config, uploadsDir: undefined });
    expect(() => readConfig({ ...env, CLOUDINARY_API_SECRET: '' })).toThrow();
    expect(() => readConfig({ ...env, IMAGE_STORAGE: 'local' })).toThrow();
    expect(() => readConfig({ ...env, UPLOADS_DIR: '/tmp/uploads' })).toThrow();
    expect(() => readConfig({ IMAGE_STORAGE: 'typo' })).toThrow();
  });
  it.each(['data:image/svg+xml;base64,PHN2Zz4=', 'https://evil.test/image.png', 'data:image/png;base64,YQ==', 'data:image/png;base64,iVBORw0KGgo'])('rejects unsupported image payload %s', value => {
    expect(() => readImage(value)).toThrow();
  });
});

describe('Image storage application lifecycle', () => {
  let raw, db, token, app, store, remove;
  beforeEach(async () => {
    raw = createDatabase(':memory:'); await raw.ready; await seedTestUsers(raw); db = createAsyncStore(raw);
    remove = vi.fn(); store = { save: vi.fn(async () => ({ url: 'https://res.cloudinary.com/synthetic-cloud/image/upload/v123/salguacate/inventory/12345678-1234-4123-8123-123456789abc.png', remove })) };
    app = createApp({ db, imageStore: store });
    token = (await request(app).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN }).expect(200)).body.token;
  });
  afterEach(async () => { await db.close(); });
  const product = { producto: 'Synthetic', local: 'Principal', imagen_base64: png };
  const send = () => request(app).post('/api/inventario').set('Authorization', `Bearer ${token}`).send(product);
  it('persists a confirmed remote reference without creating local files', async () => {
    const result = await send().expect(200);
    expect((await db.get('SELECT imagen_url FROM inventario WHERE id = ?', [result.body.id])).imagen_url).toMatch(/^https:\/\/res.cloudinary.com/);
    expect(store.save).toHaveBeenCalledOnce(); expect(remove).not.toHaveBeenCalled();
  });
  it('does not hold a database transaction while uploading and rejects a revoked session afterwards', async () => {
    store.save.mockImplementationOnce(async () => {
      // This root query would reject/deadlock if upload ran inside a transaction.
      await db.run('DELETE FROM sessions WHERE usuario_id = 1');
      return { url: '/uploads/synthetic.png', remove };
    });
    await send().expect(401); expect(remove).toHaveBeenCalledOnce();
    expect((await db.get('SELECT count(*) n FROM inventario')).n).toBe(0);
  });
  it('compensates a confirmed SQL failure but keeps the asset if COMMIT is unknown', async () => {
    raw.connection.exec("CREATE TRIGGER reject_image BEFORE INSERT ON inventario BEGIN SELECT RAISE(ABORT, 'synthetic'); END");
    await send().expect(500); expect(remove).toHaveBeenCalledOnce();
    raw.connection.exec('DROP TRIGGER reject_image'); remove.mockClear();
    db.transaction = async () => { const error = new Error('Unconfirmed'); error.code = 'COMMIT_UNCONFIRMED'; throw error; };
    await send().expect(500); expect(remove).not.toHaveBeenCalled();
  });
  it('does not start a business write after an uncertain upload', async () => {
    store.save.mockRejectedValueOnce(new Error('private provider diagnostic'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await send().expect(500);
      expect(JSON.stringify(result.body)).not.toContain('private');
      expect(JSON.stringify(spy.mock.calls)).not.toContain('private');
      expect((await db.get('SELECT count(*) n FROM inventario')).n).toBe(0); expect(remove).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});
