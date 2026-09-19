import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url);
const { createLibsqlDatabase, readProbeConfig, connectProbe, normalizeResult } = require('../libsql');
const { runTursoProbe, freshSchemaStatements } = require('../turso-probe');
const { main } = require('../scripts/turso-probe');

// Local SQL implementation of the SDK contract, deliberately asynchronous.
// This verifies adapter/probe logic, NOT Turso's remote engine or latency.
function localClient() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  const events = [];
  const execute = async statement => {
    await new Promise(resolve => setImmediate(resolve));
    const { sql: query, args = [] } = typeof statement === 'string' ? { sql: statement } : statement;
    const prepared = sql.prepare(query);
    if (prepared.columns().length) return { rows: prepared.all(...args), rowsAffected: 0, lastInsertRowid: null };
    const result = prepared.run(...args);
    return { rows: [], rowsAffected: result.changes, lastInsertRowid: result.lastInsertRowid };
  };
  const batch = async statements => {
    const results = [];
    for (const statement of statements) results.push(await execute(statement));
    return results;
  };
  return {
    sql, events, execute, batch,
    async transaction(mode) {
      expect(mode).toBe('write');
      sql.exec('BEGIN IMMEDIATE'); events.push('begin');
      return {
        execute, batch,
        async commit() { sql.exec('COMMIT'); events.push('commit'); },
        async rollback() { sql.exec('ROLLBACK'); events.push('rollback'); },
        close() { events.push('close'); },
      };
    },
    close() { sql.close(); },
  };
}

describe('Explicit Turso probe boundary', () => {
  const env = { SALGUACATE_TURSO_PROBE_URL: 'libsql://probe-example.turso.io', SALGUACATE_TURSO_PROBE_TOKEN: 'synthetic-token' };
  it('normalizes to HTTPS without loading production configuration', () => {
    expect(readProbeConfig(env, 'probe-example.turso.io')).toEqual({ url: 'https://probe-example.turso.io', authToken: 'synthetic-token', intMode: 'bigint' });
    expect(() => readProbeConfig({ TURSO_DATABASE_URL: env.SALGUACATE_TURSO_PROBE_URL, TURSO_AUTH_TOKEN: 'production' }, 'probe-example.turso.io')).toThrow();
  });
  it('accepts the regional AWS hostname returned by the Turso console only when confirmed exactly', () => {
    const host = 'probe-example.aws-eu-west-1.turso.io';
    const regional = { ...env, SALGUACATE_TURSO_PROBE_URL: `libsql://${host}` };
    expect(readProbeConfig(regional, host)).toEqual({ url: `https://${host}`, authToken: 'synthetic-token', intMode: 'bigint' });
    expect(() => readProbeConfig(regional, 'probe-example.turso.io')).toThrow();
  });
  it.each(['probe-example.aws-eu-west-1.turso.io.evil.test', 'probe-example.evil.turso.io', 'probe-example.aws-eu-west-1.evil.turso.io'])('rejects unrecognized regional host %s even when supplied as confirmation', host => {
    expect(() => readProbeConfig({ ...env, SALGUACATE_TURSO_PROBE_URL: `https://${host}` }, host)).toThrow();
  });
  it.each(['file:test.sqlite', ':memory:', 'http://probe-example.turso.io', 'libsql://other.turso.io', 'https://probe-example.turso.io.evil.test', 'https://secret@probe-example.turso.io', 'https://probe-example.turso.io?tls=0', 'https://probe-example.turso.io/path', 'https://probe-example.turso.io/#token', 'https://probe-example.turso.io:444'])('refuses unsafe or unconfirmed URL %s', url => {
    expect(() => readProbeConfig({ ...env, SALGUACATE_TURSO_PROBE_URL: url }, 'probe-example.turso.io')).toThrow();
  });
  it.each([undefined, '', ' ', ' token '])('rejects absent/ambiguous token', token => {
    expect(() => readProbeConfig({ ...env, SALGUACATE_TURSO_PROBE_TOKEN: token }, 'probe-example.turso.io')).toThrow();
  });
  it('requires explicit confirmation and keeps configuration failure output private', async () => {
    const output = { log: vi.fn(), error: vi.fn() };
    expect(await main([], env, output)).toBe(1);
    expect(JSON.stringify(output.error.mock.calls)).not.toContain('synthetic-token');
    expect(await main(['--help'], {}, output)).toBe(0);
    expect(output.log.mock.calls[0][0]).toContain('EMPTY');
  });
  it('sanitizes untrusted SDK diagnostics and closes the connection on CLI failure', async () => {
    const output = { log: vi.fn(), error: vi.fn() };
    const close = vi.fn();
    const connect = vi.fn(() => ({ close }));
    const probe = vi.fn().mockRejectedValue(new Error('private-sql synthetic-token https://private.example'));
    expect(await main(['--confirm-empty-disposable', 'probe-example.turso.io'], env, output, { connect, probe })).toBe(1);
    expect(close).toHaveBeenCalledOnce();
    expect(output.log).not.toHaveBeenCalled();
    const message = JSON.stringify(output.error.mock.calls);
    expect(message).not.toMatch(/private-sql|synthetic-token|private\.example/);
  });
  it('uses the real HTTP SDK without native SQLite bindings (transport mocked)', async () => {
    const calls = [];
    const fetch = async req => {
      calls.push({ url: req.url, authorization: req.headers.get('authorization') });
      if (req.method === 'GET') return new Response('', { status: 404 });
      const body = await req.json();
      return Response.json({ baton: null, base_url: null, results: body.requests.map(operation => ({
        type: 'ok', response: operation.type === 'close' ? { type: 'close' } : {
          type: 'execute', result: { cols: [{ name: 'answer', decltype: null }], rows: [[{ type: 'integer', value: '42' }]], affected_row_count: 0, last_insert_rowid: null },
        },
      })) });
    };
    const db = connectProbe({ ...readProbeConfig(env, 'probe-example.turso.io'), fetch });
    try {
      expect(await db.get('SELECT 42 AS answer')).toEqual({ answer: 42 });
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every(call => call.url.startsWith('https://probe-example.turso.io/'))).toBe(true);
      expect(calls.some(call => call.authorization === 'Bearer synthetic-token')).toBe(true);
    } finally { await db.close(); }
  });
});

describe('Asynchronous libSQL adapter', () => {
  it('normalizes IDs and rejects unsafe integer coercion', () => {
    expect(normalizeResult({ rows: [{ id: 1n, value: 'text' }], rowsAffected: 1, lastInsertRowid: 2n })).toEqual({ rows: [{ id: 1, value: 'text' }], changes: 1, lastInsertRowid: 2 });
    expect(() => normalizeResult({ rows: [{ id: 9007199254740993n }], rowsAffected: 0 })).toThrow(/safe range/);
    expect(() => normalizeResult({ rows: [], rowsAffected: 0, lastInsertRowid: 9007199254740993n })).toThrow(/safe range/);
  });
  it('awaits callback and commit; serializes concurrent writes and releases handles', async () => {
    const client = localClient(); const db = createLibsqlDatabase(client);
    let captured;
    try {
      await db.run('CREATE TABLE test (value INTEGER)');
      await Promise.all(Array.from({ length: 8 }, (_, i) => db.transaction(async tx => {
        captured = tx;
        await tx.run('INSERT INTO test VALUES (?)', [i]);
        expect((await tx.get('SELECT count(*) n FROM test')).n).toBe(i + 1);
      })));
      expect(client.events).toEqual(Array.from({ length: 8 }, () => ['begin', 'commit', 'close']).flat());
      await expect(captured.get('SELECT 1')).rejects.toThrow(/no longer active/);
    } finally { await db.close(); }
    await expect(db.get('SELECT 1')).rejects.toThrow(/closed/);
  });
  it('rolls back failed async callbacks and continues with the next transaction', async () => {
    const client = localClient(); const db = createLibsqlDatabase(client);
    try {
      await db.run('CREATE TABLE test (value INTEGER)');
      await expect(db.transaction(async tx => { await tx.run('INSERT INTO test VALUES (1)'); throw new Error('deliberate'); })).rejects.toThrow('deliberate');
      expect(await db.all('SELECT * FROM test')).toEqual([]);
      await db.transaction(tx => tx.run('INSERT INTO test VALUES (2)'));
      expect(await db.all('SELECT * FROM test')).toEqual([{ value: 2 }]);
    } finally { await db.close(); }
  });
  it('never replays a write after a lost COMMIT acknowledgement', async () => {
    let writes = 0; const close = vi.fn(); const rollback = vi.fn().mockRejectedValue(new Error('already committed'));
    const client = {
      transaction: vi.fn().mockResolvedValue({
        execute: async () => { writes++; return { rows: [], rowsAffected: 1, lastInsertRowid: 1n }; },
        commit: vi.fn().mockRejectedValue(new Error('private remote body / secret-token')),
        rollback, close,
      }), close: vi.fn(),
    };
    const db = createLibsqlDatabase(client);
    try {
      await expect(db.transaction(tx => tx.run('INSERT'))).rejects.toMatchObject({ code: 'COMMIT_UNCONFIRMED' });
      expect(writes).toBe(1); expect(client.transaction).toHaveBeenCalledTimes(1);
      expect(rollback).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    } finally { await db.close(); }
  });
});

describe('Probe SQL using local asynchronous contract double', () => {
  it('derives the same schema version, constraints and indexes from current migrations', async () => {
    const statements = await freshSchemaStatements();
    expect(statements.some(sql => typeof sql === 'string' && sql.includes('one_active_shift'))).toBe(true);
    expect(statements.filter(sql => typeof sql === 'object').map(sql => sql.args[0])).toEqual([1, 2]);
    expect(statements.some(sql => typeof sql === 'string' && /INSERT INTO usuarios/.test(sql))).toBe(false);
  });
  it('runs all checks with synthetic inactive users and retains evidence', async () => {
    const client = localClient(); const db = createLibsqlDatabase(client);
    try {
      const result = await runTursoProbe(db);
      expect(result.status).toBe('passed'); expect(result.timings).toHaveLength(7);
      expect(await db.get('SELECT active, pin FROM usuarios')).toEqual({ active: 0, pin: null });
      expect(await db.get('SELECT stock_actual FROM inventario')).toEqual({ stock_actual: 510 });
      expect((await db.get('SELECT count(*) n FROM gastos')).n).toBe(1);
      await expect(runTursoProbe(db)).rejects.toThrow(/empty disposable/);
      expect((await db.get('SELECT count(*) n FROM gastos')).n).toBe(1);
    } finally { await db.close(); }
  });
  it.each(['existing_data', 'sqliteXlegacy'])('refuses existing table %s before any schema or data changes', async table => {
    const client = localClient(); const db = createLibsqlDatabase(client);
    try {
      await db.run(`CREATE TABLE ${table} (value TEXT)`);
      await db.run(`INSERT INTO ${table} VALUES ('preserve')`);
      await expect(runTursoProbe(db)).rejects.toThrow(/empty disposable/);
      expect(await db.all(`SELECT * FROM ${table}`)).toEqual([{ value: 'preserve' }]);
      expect(await db.all("SELECT name FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'")).toEqual([{ name: table }]);
    } finally { await db.close(); }
  });
  it('requires foreign-key enforcement before installing the schema', async () => {
    const client = localClient(); client.sql.exec('PRAGMA foreign_keys = OFF');
    const db = createLibsqlDatabase(client);
    try {
      await expect(runTursoProbe(db)).rejects.toThrow(/Foreign-key enforcement/);
      expect(await db.all('SELECT name FROM sqlite_schema')).toEqual([]);
    } finally { await db.close(); }
  });
});
