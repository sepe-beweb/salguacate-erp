import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createDatabase } = require('../database');
const { createAsyncStore } = require('../async-store');
const { createLibsqlDatabase } = require('../libsql');

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

describe('Application async database boundary', () => {
  it('caches the shared queue without changing the raw migration/fixture API', async () => {
    const raw = createDatabase(':memory:'); await raw.ready;
    const db = createAsyncStore(raw);
    try {
      expect(createAsyncStore(raw)).toBe(db); expect(createAsyncStore(db)).toBe(db);
      expect(raw.connection.prepare('SELECT 1 n').get().n).toBe(1);
      await expect(db.connection.prepare('SELECT 2 n').get()).resolves.toEqual({ n: 2 });
    } finally { await db.close(); }
  });
  it('keeps unrelated reads and writes outside an awaited transaction, including rollback', async () => {
    const raw = createDatabase(':memory:'); await raw.ready; const db = createAsyncStore(raw);
    const entered = deferred(), release = deferred();
    try {
      const failed = db.transaction(async sql => {
        await sql.prepare("INSERT INTO proveedores (nombre) VALUES ('rolled back')").run();
        entered.resolve(); await release.promise; throw new Error('rollback');
      });
      const failure = expect(failed).rejects.toThrow('rollback');
      await entered.promise;
      let readDone = false;
      const read = db.all('SELECT nombre FROM proveedores').then(rows => { readDone = true; return rows; });
      const write = db.run("INSERT INTO proveedores (nombre) VALUES ('outside')");
      await new Promise(resolve => setImmediate(resolve)); expect(readDone).toBe(false);
      release.resolve(); await failure;
      expect(await read).toEqual([]); await write;
      expect(await db.all('SELECT nombre FROM proveedores')).toEqual([{ nombre: 'outside' }]);
    } finally { release.resolve(); await db.close(); }
  });
  it('rejects root queries, nested transactions and escaped handles without deadlock', async () => {
    const raw = createDatabase(':memory:'); await raw.ready; const db = createAsyncStore(raw);
    let captured;
    try {
      await db.transaction(async sql => {
        captured = sql.prepare('SELECT 1');
        await expect(db.all('SELECT 1')).rejects.toThrow(/explicit transaction/);
        await expect(db.transaction(() => {})).rejects.toThrow(/nested/);
        await expect(db.close()).rejects.toThrow(/inside a transaction/);
        expect(await sql.prepare('SELECT 3 n').get()).toEqual({ n: 3 });
      });
      await expect(captured.get()).rejects.toThrow(/no longer active/);
    } finally { await db.close(); }
  });
  it('awaits legacy callbacks outside the queue, including errors and follow-up queries', async () => {
    const raw = createDatabase(':memory:'); await raw.ready; const db = createAsyncStore(raw);
    try {
      await db.run('INSERT INTO proveedores (nombre) VALUES (?)', ['test'], async function(error) {
        expect(error).toBeNull(); expect(this.changes).toBe(1);
        expect((await db.get('SELECT nombre FROM proveedores WHERE id = ?', [this.lastID])).nombre).toBe('test');
      });
      await expect(db.get('SELECT 1', [], async () => { throw new Error('callback failure'); })).rejects.toThrow('callback failure');
      const callback = vi.fn(); await db.run('INVALID SQL', callback); expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    } finally { await db.close(); }
    await expect(db.get('SELECT 1')).rejects.toThrow(/closed/);
  });
  it('rolls back a failing batch as a unit', async () => {
    const raw = createDatabase(':memory:'); await raw.ready; const db = createAsyncStore(raw);
    try {
      await expect(db.connection.batch([
        { sql: 'INSERT INTO proveedores (nombre) VALUES (?)', args: ['first'] },
        { sql: 'INSERT INTO proveedores (nombre) VALUES (NULL)' },
      ])).rejects.toThrow();
      expect(await db.all('SELECT * FROM proveedores')).toEqual([]);
    } finally { await db.close(); }
  });
  it('does not confirm an application transaction before the remote COMMIT completes', async () => {
    const committing = deferred(), release = deferred();
    const client = { close: vi.fn(), transaction: async () => ({
      execute: async () => ({ rows: [], rowsAffected: 1, lastInsertRowid: 7n }),
      commit: async () => { committing.resolve(); await release.promise; }, rollback: vi.fn(), close: vi.fn(),
    }) };
    const db = createAsyncStore(createLibsqlDatabase(client));
    let done = false;
    const result = db.transaction(sql => sql.prepare('INSERT').run()).then(row => { done = true; return row; });
    await committing.promise; expect(done).toBe(false); release.resolve();
    expect((await result).lastInsertRowid).toBe(7); await db.close();
  });
});
