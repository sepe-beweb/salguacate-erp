import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
const require = createRequire(import.meta.url);
const { createDatabase } = require('../database');
const { createApp } = require('../index');
const { createBackup, verifyBackup, restoreBackup } = require('../recovery');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
let dir, db;
const file = name => path.join(dir, name);
beforeEach(() => { dir = fs.mkdtempSync(path.join(tmpdir(), 'salguacate-recovery-')); fs.mkdirSync(file('uploads')); });
afterEach(() => { db?.close(); db = null; fs.rmSync(dir, { recursive: true, force: true }); });

async function current() {
  db = createDatabase(file('source.sqlite')); await db.ready; await seedTestUsers(db);
  db.connection.exec("INSERT INTO inventario (producto,stock_actual,stock_minimo,local) VALUES ('Prueba',7,2,'Principal'); INSERT INTO cierres (fecha,local,total) VALUES ('2026-09-19','Principal',12.35)");
  fs.writeFileSync(file('uploads/image.png'), Buffer.from([137,80,78,71,13,10,26,10]));
}
const backupOptions = () => ({ database: file('source.sqlite'), uploads: file('uploads'), output: file('backup'), offline: true });
async function legacy(duplicate = false) {
  const raw = new DatabaseSync(file('source.sqlite'));
  raw.exec("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, rol TEXT NOT NULL, local TEXT, pin TEXT); INSERT INTO usuarios VALUES (7,'Histórico','owner','Todos','0000'); CREATE TABLE fichajes (id INTEGER PRIMARY KEY, usuario_id INTEGER, entrada TEXT, salida TEXT, estado TEXT); INSERT INTO fichajes VALUES (9,7,'2026-09-19T08:00:00Z',NULL,'trabajando')");
  if (duplicate) raw.exec("INSERT INTO fichajes VALUES (10,7,'2026-09-19T09:00:00Z',NULL,'trabajando')");
  raw.close();
}

describe('Recovery with disposable files only', () => {
  it('backs up committed WAL data and uploads, restores history and revokes old sessions', async () => {
    await current();
    const app = createApp({ db });
    const oldToken = (await request(app).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN }).expect(200)).body.token;
    expect(fs.statSync(file('source.sqlite-wal')).size).toBeGreaterThan(0);
    await createBackup(backupOptions());
    const manifest = verifyBackup(file('backup'));
    expect(manifest.files.map(f => f.path)).toEqual(['database.sqlite', 'uploads/image.png']);
    expect(JSON.stringify(manifest)).not.toContain(oldToken);
    const report = await restoreBackup({ source: file('backup'), output: file('restored'), offline: true });
    expect(report.sessionsRevoked).toBe(1);
    expect(report.tables.inventario.count).toBe(1);
    expect(fs.readFileSync(file('restored/uploads/image.png'))).toEqual(fs.readFileSync(file('uploads/image.png')));
    expect(db.connection.prepare('SELECT count(*) n FROM sessions').get().n).toBe(1);
    const restored = createDatabase(file('restored/database.sqlite')); await restored.ready;
    try {
      expect(restored.connection.prepare('SELECT stock_actual FROM inventario').get().stock_actual).toBe(7);
      expect(restored.connection.prepare('SELECT total FROM cierres').get().total).toBe(12.35);
      const restoredApp = createApp({ db: restored });
      await request(restoredApp).get('/api/inventario').set('Authorization', `Bearer ${oldToken}`).expect(401);
      await request(restoredApp).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN }).expect(200);
      await request(restoredApp).get('/api/health').expect(200);
    } finally { restored.close(); }
    expect(verifyBackup(file('backup'))).toEqual(manifest);
  });

  it('migrates a legacy copy without modifying its source or historical fields', async () => {
    await legacy();
    const original = fs.readFileSync(file('source.sqlite'));
    await createBackup(backupOptions());
    await restoreBackup({ source: file('backup'), output: file('restored'), offline: true });
    expect(fs.readFileSync(file('source.sqlite'))).toEqual(original);
    const restored = createDatabase(file('restored/database.sqlite')); await restored.ready;
    try {
      expect(restored.connection.prepare('SELECT id, nombre, pin, must_change_pin FROM usuarios').get()).toEqual({ id: 7, nombre: 'Histórico', pin: '0000', must_change_pin: 1 });
      expect(restored.connection.prepare('SELECT id, usuario_id FROM fichajes').get()).toEqual({ id: 9, usuario_id: 7 });
      expect(restored.connection.prepare('SELECT count(*) n FROM schema_migrations').get().n).toBe(1);
    } finally { restored.close(); }
  });

  it('rolls back all schema changes on duplicate historical shifts and leaves no success marker', async () => {
    await legacy(true);
    await createBackup(backupOptions());
    await expect(restoreBackup({ source: file('backup'), output: file('failed'), offline: true })).rejects.toThrow(/UNIQUE/);
    expect(fs.existsSync(file('failed/recovery.json'))).toBe(false);
    const failed = new DatabaseSync(file('failed/database.sqlite'), { readOnly: true });
    try {
      expect(failed.prepare('SELECT count(*) n FROM fichajes').get().n).toBe(2);
      expect(failed.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT IN ('usuarios','fichajes')").all()).toEqual([]);
      expect(failed.prepare('PRAGMA table_info(usuarios)').all().map(c => c.name)).not.toContain('active');
    } finally { failed.close(); }
    verifyBackup(file('backup'));
  });

  it.each(['database.sqlite', 'uploads/image.png'])('rejects tampering with %s before creating a restore destination', async name => {
    await current(); await createBackup(backupOptions());
    fs.appendFileSync(file(`backup/${name}`), 'changed');
    expect(() => verifyBackup(file('backup'))).toThrow(/alterado/);
    await expect(restoreBackup({ source: file('backup'), output: file('restored'), offline: true })).rejects.toThrow();
    expect(fs.existsSync(file('restored'))).toBe(false);
  });

  it.each(['../outside', 'uploads/../../outside', 'C:\\outside', 'uploads/../outside', 'uploads/file:stream', 'uploads/file.'])('rejects unsafe manifest path %s', async unsafe => {
    await current(); await createBackup(backupOptions());
    const manifest = verifyBackup(file('backup')); manifest.files[0].path = unsafe;
    fs.writeFileSync(file('backup/manifest.json'), JSON.stringify(manifest));
    expect(() => verifyBackup(file('backup'))).toThrow(/Ruta/);
  });

  it('rejects undeclared files and duplicate manifest entries', async () => {
    await current(); await createBackup(backupOptions());
    fs.writeFileSync(file('backup/extra'), 'unexpected');
    expect(() => verifyBackup(file('backup'))).toThrow(/no declarados/);
    fs.unlinkSync(file('backup/extra'));
    const manifest = verifyBackup(file('backup')); manifest.files.push(manifest.files[0]);
    fs.writeFileSync(file('backup/manifest.json'), JSON.stringify(manifest));
    expect(() => verifyBackup(file('backup'))).toThrow(/duplicado/);
  });

  it('refuses missing sources, relative paths, absent offline confirmation, nesting and existing destinations', async () => {
    await expect(createBackup(backupOptions())).rejects.toThrow();
    expect(fs.existsSync(file('source.sqlite'))).toBe(false);
    await current();
    await expect(createBackup({ ...backupOptions(), offline: false })).rejects.toThrow(/offline/);
    await expect(createBackup({ ...backupOptions(), output: 'relative' })).rejects.toThrow(/absoluta/);
    await expect(createBackup({ ...backupOptions(), output: file('uploads/nested') })).rejects.toThrow(/separados/);
    await createBackup(backupOptions());
    const original = fs.readFileSync(file('backup/manifest.json'));
    await expect(createBackup(backupOptions())).rejects.toThrow(/EEXIST/);
    await expect(restoreBackup({ source: file('backup'), output: file('uploads'), offline: true })).rejects.toThrow(/EEXIST/);
    expect(fs.readFileSync(file('backup/manifest.json'))).toEqual(original);
  });

  it('rejects a junction or symlink inside uploads', async () => {
    await current(); fs.mkdirSync(file('private'));
    fs.symlinkSync(file('private'), file('uploads/link'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(createBackup(backupOptions())).rejects.toThrow(/enlaces/);
  });

  it('rejects a corrupt database without producing a backup directory', async () => {
    fs.writeFileSync(file('source.sqlite'), 'not sqlite');
    await expect(createBackup(backupOptions())).rejects.toThrow();
    expect(fs.existsSync(file('backup'))).toBe(false);
  });

  it('refuses a backup with missing referenced images', async () => {
    await current();
    db.connection.exec("UPDATE inventario SET imagen_url='/uploads/missing.png'");
    await expect(createBackup(backupOptions())).rejects.toThrow(/ENOENT/);
    expect(fs.existsSync(file('backup'))).toBe(false);
    db.connection.exec("UPDATE inventario SET imagen_url='/uploads/image.png'");
    await createBackup(backupOptions());
    expect(verifyBackup(file('backup')).files).toHaveLength(2);
  });

  it('rolls back migration on duplicated legacy daily closings without deleting either row', async () => {
    await legacy();
    const raw = new DatabaseSync(file('source.sqlite'));
    raw.exec("CREATE TABLE cierres (id INTEGER PRIMARY KEY, fecha TEXT NOT NULL, local TEXT NOT NULL, total REAL); INSERT INTO cierres VALUES(1,'2026-09-19','Principal',20.25),(2,'2026-09-19','Principal',30.5)");
    raw.close();
    await createBackup(backupOptions());
    await expect(restoreBackup({ source: file('backup'), output: file('failed'), offline: true })).rejects.toThrow(/UNIQUE/);
    const failed = new DatabaseSync(file('failed/database.sqlite'), { readOnly: true });
    try { expect(failed.prepare('SELECT total FROM cierres ORDER BY id').all()).toEqual([{ total: 20.25 }, { total: 30.5 }]); }
    finally { failed.close(); }
    expect(fs.existsSync(file('failed/recovery.json'))).toBe(false);
  });

  it('refuses future schemas and orphaned references before committing initialization', async () => {
    await current(); db.connection.exec('INSERT INTO schema_migrations VALUES (2,CURRENT_TIMESTAMP)'); db.close(); db = null;
    const future = createDatabase(file('source.sqlite'));
    await expect(future.ready).rejects.toThrow(/newer/);
    const raw = new DatabaseSync(file('source.sqlite'));
    raw.exec("DELETE FROM schema_migrations WHERE version=2; PRAGMA foreign_keys=OFF; INSERT INTO mensajes(remitente_id,destinatario_id,asunto,cuerpo) VALUES (999,1,'Test','Test')"); raw.close();
    const orphaned = createDatabase(file('source.sqlite'));
    await expect(orphaned.ready).rejects.toThrow(/orphaned/);
    await expect(createBackup(backupOptions())).rejects.toThrow(/huérfanas/);
  });

  it('runs the CLI through backup, verify, restore, and refuses unknown options', async () => {
    await current(); db.close(); db = null;
    const cli = (...args) => spawnSync(process.execPath, [path.resolve('scripts/recovery.cjs'), ...args], { encoding: 'utf8' });
    expect(cli('backup', '--database', file('source.sqlite'), '--uploads', file('uploads'), '--output', file('backup'), '--offline').status).toBe(0);
    expect(cli('verify', '--backup', file('backup')).status).toBe(0);
    expect(cli('restore', '--backup', file('backup'), '--output', file('restored'), '--offline').status).toBe(0);
    expect(cli('restore', '--backup', file('backup'), '--output', file('restored'), '--force').status).toBe(1);
    expect(cli('verify', '--backup', file('backup'), '--database', file('source.sqlite')).status).toBe(1);
  });
});
