import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createServerlessHandler } = require('../serverless');
const { createDatabase } = require('../database');
const { createApp } = require('../index');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');

const env = {
  NODE_ENV: 'production', DATABASE_DRIVER: 'libsql', IMAGE_STORAGE: 'cloudinary',
  TURSO_DATABASE_URL: 'libsql://synthetic.turso.io', TURSO_DATABASE_HOST: 'synthetic.turso.io', TURSO_AUTH_TOKEN: 'synthetic-token',
  CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'synthetic-secret',
  CORS_ORIGINS: 'https://synthetic.netlify.app', AI_ENABLED: 'false',
};
const event = (path, method = 'GET', body, token) => ({
  path, httpMethod: method, headers: { host: 'synthetic.netlify.app', origin: env.CORS_ORIGINS,
    'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  queryStringParameters: {}, multiValueQueryStringParameters: {},
  body: body === undefined ? null : JSON.stringify(body), isBase64Encoded: false,
  requestContext: { identity: { sourceIp: '192.0.2.1' } },
});
const cleanup = [];
afterEach(() => { for (const db of cleanup.splice(0)) db.close(); });
async function fixture() {
  const db = createDatabase(':memory:'); cleanup.push(db); await db.ready; await seedTestUsers(db);
  const connect = vi.fn(async () => db);
  return { db, connect, handler: createServerlessHandler({ environment: () => env, connect }) };
}

describe('Netlify Lambda adapter with disposable local data (not a hosted validation)', () => {
  it.each(['/api/health', '/.netlify/functions/api/health'])('preserves routing for %s', async path => {
    const { handler } = await fixture(); const result = await handler(event(path));
    expect(result.statusCode).toBe(200); expect(JSON.parse(result.body)).toEqual({ status: 'ready' });
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('shares initialization across concurrent invocations without storing business state in the handler', async () => {
    const { handler, connect } = await fixture();
    const results = await Promise.all([handler(event('/api/health')), handler(event('/api/health'))]);
    expect(results.map(r => r.statusCode)).toEqual([200, 200]); expect(connect).toHaveBeenCalledOnce();
  });
  it('authenticates the PIN and preserves server-side authorization through Lambda events', async () => {
    const { handler } = await fixture();
    expect((await handler(event('/api/inventario'))).statusCode).toBe(401);
    const login = await handler(event('/api/login', 'POST', { usuario_id: 1, pin: TEST_PIN }));
    expect(login.statusCode).toBe(200); const { token } = JSON.parse(login.body);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect((await handler(event('/api/inventario', 'GET', undefined, token))).statusCode).toBe(200);
    expect((await handler(event('/api/login', 'POST', { usuario_id: 1, pin: '999998' }))).statusCode).toBe(401);
  });
  it('rejects unapproved origins and malformed JSON without exposing internals', async () => {
    const { handler } = await fixture(); const denied = event('/api/health'); denied.headers.origin = 'https://other.example';
    expect((await handler(denied)).statusCode).toBe(403);
    const invalid = event('/api/login', 'POST'); invalid.body = '{';
    expect((await handler(invalid)).statusCode).toBe(400);
  });
  it.each([{ NODE_ENV: 'development' }, { DATABASE_DRIVER: 'sqlite' }, { IMAGE_STORAGE: 'local' }, { TURSO_AUTH_TOKEN: '' }])('fails closed before connecting with %j', async override => {
    const connect = vi.fn(); const handler = createServerlessHandler({ environment: () => ({ ...env, ...override }), connect });
    const response = await handler(event('/api/health'));
    expect(response.statusCode).toBe(503); expect(connect).not.toHaveBeenCalled();
    expect(response.body).not.toMatch(/synthetic-token|synthetic-secret/);
  });
  it('can retry read-only initialization on a later request, never replaying the failed request', async () => {
    const { db } = await fixture(); const connect = vi.fn().mockRejectedValueOnce(new Error('synthetic-token')).mockResolvedValue(db);
    const handler = createServerlessHandler({ environment: () => env, connect });
    expect((await handler(event('/api/health'))).statusCode).toBe(503);
    expect(connect).toHaveBeenCalledTimes(1);
    expect((await handler(event('/api/health'))).statusCode).toBe(200);
    expect(connect).toHaveBeenCalledTimes(2);
  });
  it('closes a connection if app construction fails', async () => {
    const db = { close: vi.fn() }; const handler = createServerlessHandler({ environment: () => env, connect: async () => db, makeApp: () => { throw new Error('synthetic-secret'); } });
    expect((await handler(event('/api/health'))).statusCode).toBe(503); expect(db.close).toHaveBeenCalledOnce();
  });
  it('awaits an asynchronous route and does not repeat a mutation', async () => {
    const { db } = await fixture(); let writes = 0;
    const handler = createServerlessHandler({ environment: () => env, connect: async () => db, makeApp: config => {
      const app = require('express')();
      app.post('/api/test', async (req, res) => { await new Promise(resolve => setImmediate(resolve)); writes++; res.json({ writes }); });
      app.use(createApp(config)); return app;
    } });
    expect(JSON.parse((await handler(event('/api/test', 'POST', {}))).body)).toEqual({ writes: 1 });
    expect(writes).toBe(1);
  });
});
