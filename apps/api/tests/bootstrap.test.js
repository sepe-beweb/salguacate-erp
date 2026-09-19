import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import request from 'supertest';
const require = createRequire(import.meta.url);
const { bootstrapOwner } = require('../bootstrap');
const { readPin } = require('../scripts/bootstrap-owner');
const { createDatabase } = require('../database');
const { createApp } = require('../index');
const { verifyPin } = require('../security');
const { TEST_PIN } = require('../../../tests/fixtures/users.cjs');
let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(tmpdir(), 'salguacate-bootstrap-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
const options = () => ({ filename: path.join(dir, 'new.sqlite'), name: ' First Owner ', pin: TEST_PIN, newDatabase: true });
const cli = (args, input = TEST_PIN + '\n') => spawnSync(process.execPath, [path.resolve('apps/api/scripts/bootstrap-owner.js'), ...args], {
  input, encoding: 'utf8', env: { ...process.env, TURSO_DATABASE_URL: 'invalid://ignored-in-explicit-mode', BOOTSTRAP_OWNER_NAME: 'Not the owner', BOOTSTRAP_OWNER_PIN: '111111' }
});

describe('Fresh installation bootstrap with disposable databases', () => {
  it('creates one usable owner with a hash and no sample business rows, then refuses a second bootstrap', async () => {
    const config = options(); const created = await bootstrapOwner(config); expect(created).toEqual({ id: 1 });
    if (process.platform !== 'win32') expect(fs.statSync(config.filename).mode & 0o777).toBe(0o600);
    const db = createDatabase(config.filename); await db.ready;
    try {
      const owners = db.connection.prepare('SELECT * FROM usuarios').all(); expect(owners).toHaveLength(1);
      expect(owners[0]).toMatchObject({ nombre: 'First Owner', rol: 'owner', local: 'Todos', must_change_pin: 0, active: 1 });
      expect(owners[0].pin).toMatch(/^scrypt\$/); expect(await verifyPin(TEST_PIN, owners[0].pin)).toBe(true);
      for (const table of ['fichajes','proveedores','inventario','turnos','mensajes','eventos','notas','cierres','gastos','tareas','pedidos','peticiones','idempotency_requests']) expect(db.connection.prepare(`SELECT count(*) AS n FROM ${table}`).get().n).toBe(0);
      const app = createApp({ db }); const login = await request(app).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN }).expect(200);
      expect(login.body.user).toMatchObject({ rol: 'owner', must_change_pin: false });
      await request(app).get('/api/inventario').set('Authorization', `Bearer ${login.body.token}`).expect(200, []);
    } finally { db.close(); }
    const snapshot = fs.readFileSync(config.filename);
    await expect(bootstrapOwner(config)).rejects.toThrow(); expect(fs.readFileSync(config.filename)).toEqual(snapshot);
    await expect(bootstrapOwner({ ...config, newDatabase: false })).rejects.toThrow('empty user table'); expect(fs.readFileSync(config.filename)).toEqual(snapshot);
  });
  it.each(['', '123', '111111', '123456789', '246810\n', 'secret'])('rejects invalid PIN input without creating a database (%j)', async pin => {
    const config = { ...options(), pin }; await expect(bootstrapOwner(config)).rejects.toThrow(); expect(fs.existsSync(config.filename)).toBe(false);
  });
  it('rejects empty names, relative paths and an existing empty destination', async () => {
    await expect(bootstrapOwner({ ...options(), name: ' ' })).rejects.toThrow();
    await expect(bootstrapOwner({ ...options(), filename: 'relative.sqlite' })).rejects.toThrow('absolute');
    fs.writeFileSync(options().filename, ''); await expect(bootstrapOwner(options())).rejects.toThrow(); expect(fs.statSync(options().filename).size).toBe(0);
  });
  it('refuses populated legacy data before changing its schema or plaintext historical PIN', async () => {
    const config = { ...options(), newDatabase: false }; const legacy = new DatabaseSync(config.filename);
    legacy.exec("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT, pin TEXT); INSERT INTO usuarios VALUES (7,'Existing','0000')"); legacy.close();
    const before = fs.readFileSync(config.filename); await expect(bootstrapOwner(config)).rejects.toThrow('empty user table'); expect(fs.readFileSync(config.filename)).toEqual(before);
  });
  it('allows only one owner when two fresh bootstrap attempts race', async () => {
    const results = await Promise.allSettled([bootstrapOwner(options()), bootstrapOwner(options())]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const db = new DatabaseSync(options().filename, { readOnly: true }); try { expect(db.prepare('SELECT count(*) AS n FROM usuarios').get().n).toBe(1); } finally { db.close(); }
  });
  it('runs the real explicit CLI without reading environment configuration or disclosing the PIN', () => {
    const args = ['--database', options().filename, '--name', 'CLI owner', '--pin-stdin']; const result = cli(args);
    expect(result.status).toBe(0); expect(result.stdout).toContain('Owner created'); expect(result.stdout + result.stderr).not.toContain(TEST_PIN);
    const db = new DatabaseSync(options().filename, { readOnly: true }); try { expect(db.prepare('SELECT nombre FROM usuarios').get().nombre).toBe('CLI owner'); } finally { db.close(); }
    const snapshot = fs.readFileSync(options().filename); const repeated = cli(args);
    expect(repeated.status).toBe(1); expect(repeated.stderr).toContain('Nothing was replaced'); expect(fs.readFileSync(options().filename)).toEqual(snapshot);
    expect(cli(['--pin', TEST_PIN]).status).toBe(1);
  });
  it('fails incomplete explicit mode without falling back to environment or creating files', () => {
    expect(cli(['--database', options().filename]).status).toBe(1); expect(fs.existsSync(options().filename)).toBe(false);
    expect(cli(['--help']).status).toBe(0); expect(fs.readdirSync(dir)).toEqual([]);
  });
  it('does not echo accidental secret-like positional arguments in CLI errors', () => {
    const result = cli([TEST_PIN]); expect(result.status).toBe(1); expect(result.stdout + result.stderr).not.toContain(TEST_PIN);
    expect(fs.readdirSync(dir)).toEqual([]);
  });
  it('accepts a single newline from piped input, rejects excess and refuses visible terminal input', async () => {
    expect(await readPin(Readable.from([TEST_PIN + '\r\n']))).toBe(TEST_PIN);
    await expect(readPin(Readable.from(['x'.repeat(11)]))).rejects.toThrow('Invalid PIN');
    const terminal = Readable.from([]); terminal.isTTY = true; await expect(readPin(terminal)).rejects.toThrow('private prompt');
  });
});
