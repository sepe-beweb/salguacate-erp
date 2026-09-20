import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
const require = createRequire(import.meta.url);
const { readConfig } = require('../config');
const { assertVolumeMounted } = require('../railway-volume');
const { registerWeb } = require('../web-serving');
const { start } = require('../server');
const { createApp } = require('../index');
const { createDatabase } = require('../database');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
const cleanup = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
function webFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'salguacate-web-test-'));
  cleanup.push(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>Synthetic ERP</title>');
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'assets', 'app.js'), '/* synthetic bundle */');
  fs.writeFileSync(path.join(root, '.env'), 'SYNTHETIC_PRIVATE_VALUE');
  return root;
}
const remote = { DATABASE_DRIVER: 'libsql', TURSO_DATABASE_URL: 'libsql://synthetic.turso.io', TURSO_DATABASE_HOST: 'synthetic.turso.io', TURSO_AUTH_TOKEN: 'synthetic-token' };

describe('Railway private volume configuration (no hosted validation)', () => {
  it('requires explicit storage and derives a fixed private directory', () => {
    expect(readConfig({ ...remote, DOCUMENT_STORAGE: 'railway-volume', RAILWAY_VOLUME_MOUNT_PATH: '/data' })).toMatchObject({ volumeMount: '/data', documentsDir: '/data/documents' });
    expect(readConfig(remote).documentsDir).toBeUndefined();
    expect(readConfig({ ...remote, RAILWAY_VOLUME_MOUNT_PATH: '/data' }).documentsDir).toBeUndefined();
  });
  it.each([
    { DOCUMENT_STORAGE: 'typo' }, { DOCUMENT_STORAGE: 'railway-volume' },
    { DOCUMENTS_DIR: '/tmp/documents' },
    ...['/', 'data', '/data/', '/data/../tmp', '/data\\private'].map(RAILWAY_VOLUME_MOUNT_PATH => ({ DOCUMENT_STORAGE: 'railway-volume', RAILWAY_VOLUME_MOUNT_PATH })),
    { DOCUMENT_STORAGE: 'railway-volume', RAILWAY_VOLUME_MOUNT_PATH: '/data', DOCUMENTS_DIR: '/tmp' },
  ])('rejects unsafe remote storage %j', extra => { expect(() => readConfig({ ...remote, ...extra })).toThrow(); });
  it('rejects storage mixing with SQLite and invalid serving flags', () => {
    expect(() => readConfig({ DOCUMENT_STORAGE: 'railway-volume', RAILWAY_VOLUME_MOUNT_PATH: '/data' })).toThrow();
    expect(() => readConfig({ SERVE_WEB: 'yes' })).toThrow();
    expect(readConfig({ SERVE_WEB: 'true' }).webDir).toBe(path.resolve('dist/erp'));
  });
  it('requires an exact actual Linux mount, canonical directory and no root fallback', () => {
    const filesystem = { readFileSync: () => '21 1 0:1 / / rw - overlay overlay rw\n22 21 0:2 / /data rw - ext4 volume rw', realpathSync: x => x, lstatSync: () => ({ isDirectory: () => true }) };
    expect(() => assertVolumeMounted('/data', { platform: 'linux', filesystem })).not.toThrow();
    expect(() => assertVolumeMounted('/data/documents', { platform: 'linux', filesystem })).toThrow();
    expect(() => assertVolumeMounted('/data', { platform: 'win32', filesystem })).toThrow();
    expect(() => assertVolumeMounted('/data', { platform: 'linux', filesystem: { ...filesystem, realpathSync: () => '/other' } })).toThrow();
    expect(() => assertVolumeMounted('/data', { platform: 'linux', filesystem: { ...filesystem, lstatSync: () => ({ isDirectory: () => false }) } })).toThrow();
  });
  it('does not connect or create documents when the volume is absent', async () => {
    const connect = vi.fn();
    await expect(start({ volumeMount: '/missing-salguacate-test-volume' }, connect)).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('Single-origin compiled web and API', () => {
  async function fixture() {
    const root = webFixture(); const db = createDatabase(':memory:'); cleanup.push(() => db.close());
    await db.ready; await seedTestUsers(db);
    return { root, app: createApp({ db, webDir: root }) };
  }
  it('serves the bundle and nested reloads, while preserving health, login and authorization', async () => {
    const { app } = await fixture();
    const response = await request(app).get('/documentos?pagina=2').set('Accept', 'text/html').expect(200);
    expect(response.text).toContain('Synthetic ERP'); expect(response.headers['cache-control']).toBe('no-store');
    await request(app).head('/turno').set('Accept', 'text/html').expect(200);
    await request(app).get('/assets/app.js').expect(200).expect('Content-Type', /javascript/);
    await request(app).get('/api/health').expect(200, { status: 'ready' });
    await request(app).get('/api/inventario').expect(401);
    const login = await request(app).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN }).expect(200);
    await request(app).get('/api/inventario').set('Authorization', `Bearer ${login.body.token}`).expect(200);
  });
  it.each(['/api/unknown', '/uploads/private', '/assets/missing.js', '/.env', '/%2eenv', '/documents/.hidden', '/foo%5c.env'])('does not turn %s into HTML or expose dotfiles', async url => {
    const { app } = await fixture(); const response = await request(app).get(url).set('Accept', 'text/html').expect(404);
    expect(response.text).not.toMatch(/Synthetic ERP|SYNTHETIC_PRIVATE_VALUE/);
  });
  it('rejects non-HTML navigation and unsupported methods', async () => {
    const { app } = await fixture();
    await request(app).get('/unknown').set('Accept', 'application/json').expect(404);
    await request(app).post('/turno').send({}).expect(404);
  });
  it('rejects missing builds, overlapping storage and links before serving', () => {
    const root = webFixture(); const app = require('express')();
    expect(() => registerWeb(app, path.join(root, 'missing'))).toThrow();
    expect(() => registerWeb(app, root, [path.join(root, 'documents')])).toThrow();
    expect(() => registerWeb(app, root, [path.dirname(root)])).toThrow();
    fs.symlinkSync(path.join(root, 'assets'), path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => registerWeb(app, root)).toThrow();
  });
});
