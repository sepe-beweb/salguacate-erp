import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import request from 'supertest';
const require = createRequire(import.meta.url);
const { bootstrapRemoteOwner } = require('../bootstrap-remote');
const { main, readSecrets } = require('../scripts/bootstrap-remote-owner');
const { createLibsqlDatabase } = require('../libsql');
const { verifyRemoteDatabase } = require('../database-runtime');
const { createApp } = require('../index');
const input = { url: 'libsql://synthetic.turso.io', host: 'synthetic.turso.io', token: 'synthetic-token', name: 'Synthetic owner', pin: '739152' };
function clientFixture() {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys = ON');
  const execute = async ({ sql: query, args = [] }) => {
    await new Promise(resolve => setImmediate(resolve));
    const statement = sql.prepare(query);
    if (statement.columns().length) return { rows: statement.all(...args), rowsAffected: 0, lastInsertRowid: null };
    const row = statement.run(...args); return { rows: [], rowsAffected: row.changes, lastInsertRowid: row.lastInsertRowid };
  };
  const batch = async statements => { const rows = []; for (const s of statements) rows.push(await execute(typeof s === 'string' ? { sql: s } : s)); return rows; };
  const client = { execute, batch, close: vi.fn(), transaction: vi.fn(async () => {
    sql.exec('BEGIN IMMEDIATE');
    return { execute, batch, commit: async () => sql.exec('COMMIT'), rollback: async () => sql.exec('ROLLBACK'), close() {} };
  }) };
  return { sql, client, db: createLibsqlDatabase(client) };
}
describe('Atomic fresh remote bootstrap using a local SDK double', () => {
  it('creates only an owner, migrations and audit, passes readiness and authenticates through the API', async () => {
    const { sql, client, db } = clientFixture();
    try {
      expect(await bootstrapRemoteOwner(input, () => db)).toEqual({ status: 'ready', ownerId: 1, sampleDataInserted: false });
      expect(client.transaction).toHaveBeenCalledOnce(); expect(client.close).toHaveBeenCalledOnce();
      expect(sql.prepare('SELECT pin FROM usuarios').get().pin).toMatch(/^scrypt\$/);
      expect(sql.prepare('SELECT count(*) n FROM inventario').get().n).toBe(0);
      expect(sql.prepare('SELECT action FROM audit_events').all()).toEqual([{ action: 'owner.bootstrap' }]);
      const reopened = createLibsqlDatabase(client);
      await verifyRemoteDatabase(reopened);
      const login = await request(createApp({ db: reopened })).post('/api/login').send({ usuario_id: 1, pin: input.pin }).expect(200);
      expect(login.body.token).toMatch(/^[a-f0-9]{64}$/); await reopened.close();
    } finally { sql.close(); }
  });
  it('rejects any existing user schema before changing it', async () => {
    const { sql, db } = clientFixture(); sql.exec("CREATE TABLE existing (value TEXT); INSERT INTO existing VALUES ('preserve')");
    try {
      await expect(bootstrapRemoteOwner(input, () => db)).rejects.toMatchObject({ code: 'DATABASE_NOT_EMPTY' });
      expect(sql.prepare('SELECT * FROM existing').all()).toEqual([{ value: 'preserve' }]);
      expect(sql.prepare("SELECT name FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'").all()).toEqual([{ name: 'existing' }]);
    } finally { sql.close(); }
  });
  it('requires foreign keys before installing the schema', async () => {
    const { sql, db } = clientFixture(); sql.exec('PRAGMA foreign_keys = OFF');
    try { await expect(bootstrapRemoteOwner(input, () => db)).rejects.toMatchObject({ code: 'FOREIGN_KEYS_DISABLED' }); expect(sql.prepare('SELECT * FROM sqlite_schema').all()).toEqual([]); }
    finally { sql.close(); }
  });
  it('rolls back schema and owner when the audit insert fails', async () => {
    const { sql, client } = clientFixture(); const transaction = client.transaction;
    client.transaction = vi.fn(async () => { const tx = await transaction(); const execute = tx.execute; tx.execute = statement => { if (statement.sql.startsWith('INSERT INTO audit_events')) throw new Error(input.token); return execute(statement); }; return tx; });
    try {
      await expect(bootstrapRemoteOwner(input, () => createLibsqlDatabase(client))).rejects.toMatchObject({ code: 'BOOTSTRAP_FAILED' });
      expect(sql.prepare('SELECT * FROM sqlite_schema').all()).toEqual([]);
    } finally { sql.close(); }
  });
  it('does not replay an unconfirmed COMMIT or claim the owner was reverted', async () => {
    const { sql, client } = clientFixture(); const transaction = client.transaction;
    client.transaction = vi.fn(async () => { const tx = await transaction(); tx.commit = async () => { sql.exec('COMMIT'); throw new Error(input.token); }; return tx; });
    try {
      await expect(bootstrapRemoteOwner(input, () => createLibsqlDatabase(client))).rejects.toMatchObject({ code: 'COMMIT_UNCONFIRMED' });
      expect(client.transaction).toHaveBeenCalledOnce(); expect(sql.prepare('SELECT count(*) n FROM usuarios').get().n).toBe(1);
    } finally { sql.close(); }
  });
  it.each([{ name: '' }, { name: 'bad\nname' }, { pin: '111111' }, { pin: 'short' }, { host: 'other.turso.io' }])('rejects invalid input before connecting', async changes => {
    const connect = vi.fn(); await expect(bootstrapRemoteOwner({ ...input, ...changes }, connect)).rejects.toThrow(); expect(connect).not.toHaveBeenCalled();
  });
  it('distinguishes failed verification after COMMIT from a reverted installation', async () => {
    const { sql, client } = clientFixture(); client.execute = vi.fn().mockRejectedValue(new Error(input.token));
    try {
      await expect(bootstrapRemoteOwner(input, () => createLibsqlDatabase(client))).rejects.toMatchObject({ code: 'BOOTSTRAP_VERIFICATION_UNCONFIRMED' });
      expect(sql.prepare('SELECT count(*) n FROM usuarios').get().n).toBe(1); expect(client.transaction).toHaveBeenCalledOnce();
    } finally { sql.close(); }
  });
});

describe('Private-input bootstrap command', () => {
  it.each(['not-json', 'null', '[]', '{"pin":739152,"token":"synthetic-token"}', '{"pin":"739152","token":"synthetic-token","extra":1}', 'x'.repeat(16385)])('rejects malformed private input without echoing it', async value => {
    await expect(readSecrets(Readable.from([value]))).rejects.toThrow('Invalid private input.');
  });
  it('requires private stdin rather than visible typed input', async () => {
    const stream = Readable.from([]); stream.isTTY = true;
    await expect(readSecrets(stream)).rejects.toThrow(/private input/);
  });
  it('passes exact explicit configuration without loading env and emits only the result', async () => {
    const output = { log: vi.fn(), error: vi.fn() }, bootstrap = vi.fn().mockResolvedValue({ status: 'ready', ownerId: 1 });
    const code = await main(['--database-url', input.url, '--confirm-host', input.host, '--name', input.name, '--secrets-stdin'], Readable.from([JSON.stringify({ token: input.token, pin: input.pin })]), output, bootstrap);
    expect(code).toBe(0); expect(bootstrap).toHaveBeenCalledWith(input); expect(JSON.stringify(output.log.mock.calls)).not.toMatch(/synthetic-token|739152/);
  });
  it('never echoes invalid arguments or remote error diagnostics', async () => {
    const output = { log: vi.fn(), error: vi.fn() };
    expect(await main(['--pin', input.pin], Readable.from([]), output)).toBe(1);
    const bootstrap = vi.fn().mockRejectedValue(new Error(input.token));
    expect(await main(['--database-url', input.url, '--confirm-host', input.host, '--name', input.name, '--secrets-stdin'], Readable.from([JSON.stringify({ token: input.token, pin: input.pin })]), output, bootstrap)).toBe(1);
    expect(JSON.stringify(output.error.mock.calls)).not.toMatch(/synthetic-token|739152/);
  });
  it('preserves the unconfirmed commit signal without provider messages', async () => {
    const output = { log: vi.fn(), error: vi.fn() }, error = Object.assign(new Error(input.token), { code: 'COMMIT_UNCONFIRMED' });
    const code = await main(['--database-url', input.url, '--confirm-host', input.host, '--name', input.name, '--secrets-stdin'], Readable.from([JSON.stringify({ token: input.token, pin: input.pin })]), output, vi.fn().mockRejectedValue(error));
    expect(code).toBe(1); expect(JSON.parse(output.error.mock.calls[0][0])).toEqual({ status: 'failed', code: 'COMMIT_UNCONFIRMED', automaticRetry: false });
  });
});
