import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import request from 'supertest';
const require = createRequire(import.meta.url);
const { createDatabase } = require('../database');
const { createLibsqlDatabase } = require('../libsql');
const { verifyRemoteDatabase, connectConfiguredDatabase } = require('../database-runtime');
const { readConfig } = require('../config');
const { createApp } = require('../index');
const { start } = require('../server');
const { hashPin } = require('../security');
const remoteEnv = { DATABASE_DRIVER: 'libsql', TURSO_DATABASE_URL: 'libsql://synthetic.turso.io', TURSO_AUTH_TOKEN: 'synthetic-token', TURSO_DATABASE_HOST: 'synthetic.turso.io' };
const cloud = { IMAGE_STORAGE: 'cloudinary', CLOUDINARY_CLOUD_NAME: 'synthetic', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'synthetic-secret' };
// Local asynchronous SDK double. No remote credentials or external requests.
async function fixture() {
  const raw = createDatabase(':memory:'); await raw.ready;
  const execute = async ({ sql, args = [] }) => {
    await new Promise(resolve => setImmediate(resolve));
    const prepared = raw.connection.prepare(sql);
    if (prepared.columns().length) return { rows: prepared.all(...args), rowsAffected: 0, lastInsertRowid: null };
    const result = prepared.run(...args); return { rows: [], rowsAffected: result.changes, lastInsertRowid: result.lastInsertRowid };
  };
  const batch = async statements => { const results = []; for (const s of statements) results.push(await execute(s)); return results; };
  const client = { execute, batch, close: vi.fn(() => raw.close()), async transaction() {
    raw.connection.exec('BEGIN IMMEDIATE');
    return { execute, batch, commit: async () => raw.connection.exec('COMMIT'), rollback: async () => raw.connection.exec('ROLLBACK'), close() {} };
  } };
  const owner = await hashPin('739152');
  raw.connection.prepare("INSERT INTO usuarios (nombre, rol, local, pin, must_change_pin) VALUES ('Synthetic owner', 'owner', 'Todos', ?, 0)").run(owner);
  return { raw, client, db: createLibsqlDatabase(client) };
}

describe('Explicit service database configuration', () => {
  it('retains SQLite by default and selects remote only with complete explicit settings', () => {
    expect(readConfig({}).databaseDriver).toBe('sqlite');
    expect(readConfig(remoteEnv)).toMatchObject({ databaseDriver: 'libsql', filename: undefined, turso: { url: 'https://synthetic.turso.io' } });
    expect(readConfig({ ...remoteEnv, ...cloud, NODE_ENV: 'production', CORS_ORIGINS: 'https://synthetic.example' }).host).toBe('0.0.0.0');
  });
  it.each([
    { DATABASE_DRIVER: 'typo' }, { ...remoteEnv, DATABASE_DRIVER: 'sqlite' }, { ...remoteEnv, SQLITE_DATABASE_PATH: 'other.sqlite' },
    { ...remoteEnv, TURSO_DATABASE_HOST: 'other.turso.io' }, { ...remoteEnv, TURSO_AUTH_TOKEN: '' },
    { ...remoteEnv, TURSO_DATABASE_URL: 'http://synthetic.turso.io' }, { ...remoteEnv, TURSO_DATABASE_URL: 'https://synthetic.turso.io/path' },
    { ...remoteEnv, NODE_ENV: 'production', CORS_ORIGINS: 'https://synthetic.example' },
    { ...remoteEnv, ...cloud, NODE_ENV: 'production' }, { ...remoteEnv, ...cloud, NODE_ENV: 'production', CORS_ORIGINS: 'http://synthetic.example' },
  ])('rejects mixed or unsafe configuration without leaking secrets', env => {
    let error; try { readConfig(env); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error); expect(String(error)).not.toMatch(/synthetic-token|synthetic-secret/);
  });
});

describe('Remote readiness uses reads only and never installs or repairs schema', () => {
  it('accepts the exact migrated schema and supports actual login and catalogue routes through the asynchronous SDK double', async () => {
    const { db } = await fixture();
    try {
      await verifyRemoteDatabase(db);
      const app = createApp({ db });
      const login = await request(app).post('/api/login').send({ usuario_id: 1, pin: '739152' }).expect(200);
      await request(app).get('/api/inventario').set('Authorization', `Bearer ${login.body.token}`).expect(200, []);
    } finally { await db.close(); }
  });
  it.each([
    'DROP INDEX one_active_shift', 'ALTER TABLE inventario ADD COLUMN unexpected TEXT',
    "CREATE TRIGGER unexpected AFTER INSERT ON inventario BEGIN SELECT 1; END", 'DELETE FROM schema_migrations WHERE version = 2',
    "INSERT INTO schema_migrations VALUES (3, 'future')", 'PRAGMA foreign_keys = OFF',
    'UPDATE usuarios SET active = 0', 'UPDATE usuarios SET pin = NULL', "UPDATE usuarios SET pin = '739152'", 'UPDATE usuarios SET must_change_pin = 1',
  ])('refuses incompatible state without changing it: %s', change => {
    return fixture().then(async ({ db, raw }) => {
      try {
        raw.connection.exec(change); const before = raw.connection.prepare('SELECT total_changes() AS n').get().n;
        await expect(verifyRemoteDatabase(db)).rejects.toThrow();
        expect(raw.connection.prepare('SELECT total_changes() AS n').get().n).toBe(before);
      } finally { await db.close(); }
    });
  });
  it('closes a failed remote connection without SQLite fallback or provider diagnostics', async () => {
    const remote = { all: vi.fn().mockRejectedValue(new Error('private SQL synthetic-token')), close: vi.fn() }, local = vi.fn();
    const failure = connectConfiguredDatabase(readConfig(remoteEnv), { remote: () => remote, local });
    await expect(failure).rejects.toThrow(/startup rejected/);
    expect(local).not.toHaveBeenCalled(); expect(remote.close).toHaveBeenCalledOnce();
  });
  it('keeps the local initializer and waits for readiness', async () => {
    const db = await connectConfiguredDatabase({ databaseDriver: 'sqlite', filename: ':memory:' });
    try { expect(db.connection.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version)).toEqual([1, 2]); }
    finally { db.close(); }
  });
  it('starts listening only after readiness and closes the selected adapter', async () => {
    const { db, client } = await fixture();
    const config = { ...readConfig(remoteEnv), port: 0, host: '127.0.0.1', uploadsDir: undefined };
    const server = await start(config, c => connectConfiguredDatabase(c, { remote: () => db }));
    await request(server).get('/api/health').expect(200, { status: 'ready' });
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => setImmediate(resolve));
    expect(client.close).toHaveBeenCalledOnce();
  });
});
