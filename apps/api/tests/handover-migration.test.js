import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import request from 'supertest';
const require = createRequire(import.meta.url);
const { createDatabase } = require('../database');
const { createApp } = require('../index');
const { createAsyncStore } = require('../async-store');
const { createBackup, restoreBackup } = require('../recovery');
const { verifyRemoteDatabase } = require('../database-runtime');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
const { schemaV2 } = require('../../../tests/fixtures/schema-v2.cjs');
const login = async app => (await request(app).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN }).expect(200)).body.token;

it('upgrades a v3 copy without rewriting notice resolution or acknowledgements', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salguacate-schema4-')); let db, migrated;
  try {
    const source = path.join(dir, 'source.sqlite'); const copy = path.join(dir, 'copy.sqlite');
    db = createDatabase(source); await db.ready; await seedTestUsers(db);
    db.connection.exec(`INSERT INTO relevos (id,local,fecha,contenido,autor_id,resuelto_por,resuelto_en) VALUES (7,'Principal','2026-09-19','Conservar',2,1,'2026-09-19 20:00:00');
      INSERT INTO relevo_lecturas (relevo_id,usuario_id) VALUES (7,3);
      DROP TABLE documento_cambios; DROP TABLE documentos; DELETE FROM schema_migrations WHERE version>=5;
      DROP TABLE relevo_cambios; DROP TABLE relevo_gestion; DELETE FROM schema_migrations WHERE version=4;`);
    const notices = db.connection.prepare('SELECT * FROM relevos').all(); const readings = db.connection.prepare('SELECT * FROM relevo_lecturas').all();
    db.close(); db = null; fs.copyFileSync(source, copy); const before = fs.readFileSync(source);
    migrated = createDatabase(copy); await migrated.ready;
    expect(migrated.connection.prepare('SELECT * FROM relevos').all()).toEqual(notices);
    expect(migrated.connection.prepare('SELECT * FROM relevo_lecturas').all()).toEqual(readings);
    expect(migrated.connection.prepare('SELECT * FROM relevo_gestion').all()).toEqual([]);
    expect(migrated.connection.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(fs.readFileSync(source)).toEqual(before);
  } finally { db?.close(); migrated?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

it('migrates a backed-up v2 copy preserving identities, tasks and existing creation receipts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salguacate-schema3-'));
  let db, restored;
  try {
    const file = path.join(dir, 'source.sqlite'); const uploads = path.join(dir, 'uploads'); fs.mkdirSync(uploads);
    db = createDatabase(file); await db.ready; await seedTestUsers(db);
    const app = createApp({ db }); const token = await login(app); const key = 'adc731a0-310c-4359-8a22-c3881e482e6a';
    const body = { contenido: 'Conservar recibo y nota', color: 'blue' };
    const first = await request(app).post('/api/notas').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(body).expect(200);
    db.connection.exec("INSERT INTO tareas (id,titulo,fecha,local,completada) VALUES (77,'Histórica','2026-09-19','Segundo Local',1)");
    schemaV2(db.connection);
    const receipt = db.connection.prepare('SELECT * FROM idempotency_requests').all();
    const users = db.connection.prepare('SELECT * FROM usuarios').all();
    const before = db.connection.prepare('SELECT total_changes() n').get().n;
    await expect(verifyRemoteDatabase(createAsyncStore(db))).rejects.toThrow();
    expect(db.connection.prepare('SELECT total_changes() n').get().n).toBe(before);
    db.close(); db = null;
    const original = fs.readFileSync(file);
    await createBackup({ database: file, uploads, output: path.join(dir, 'backup'), offline: true });
    await restoreBackup({ source: path.join(dir, 'backup'), output: path.join(dir, 'restored'), offline: true });
    expect(fs.readFileSync(file)).toEqual(original);
    restored = createDatabase(path.join(dir, 'restored/database.sqlite')); await restored.ready;
    expect(restored.connection.prepare('SELECT * FROM usuarios').all()).toEqual(users);
    expect(restored.connection.prepare('SELECT * FROM idempotency_requests').all()).toEqual(receipt);
    expect(restored.connection.prepare('SELECT id,completada,completado_por FROM tareas').get()).toEqual({ id: 77, completada: 1, completado_por: null });
    const target = createApp({ db: restored }); const newToken = await login(target);
    const replay = await request(target).post('/api/notas').set('Authorization', `Bearer ${newToken}`).set('Idempotency-Key', key).send(body).expect(200);
    expect(replay.body).toEqual(first.body);
    expect(restored.connection.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(restored.connection.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)).toEqual([1, 2, 3, 4, 5, 6]);
  } finally { db?.close(); restored?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

it('rolls back schema3 including the receipt-table replacement if its final step fails', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salguacate-schema3-rollback-')); const file = path.join(dir, 'test.sqlite');
  let db, raw;
  try {
    db = createDatabase(file); await db.ready; await seedTestUsers(db); schemaV2(db.connection);
    db.connection.exec("INSERT INTO idempotency_requests VALUES(1,'note.create','key','hash',200,'{\"id\":42}','2026-09-20 10:00:00'); CREATE TRIGGER fail_version BEFORE INSERT ON schema_migrations WHEN NEW.version = 3 BEGIN SELECT RAISE(ABORT, 'test'); END;");
    const receipt = db.connection.prepare('SELECT * FROM idempotency_requests').all(); db.close(); db = null;
    await expect(createDatabase(file).ready).rejects.toThrow();
    raw = new DatabaseSync(file, { readOnly: true });
    expect(raw.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)).toEqual([1, 2]);
    expect(raw.prepare('SELECT * FROM idempotency_requests').all()).toEqual(receipt);
    expect(raw.prepare("SELECT name FROM sqlite_schema WHERE name IN ('rutinas','relevos','idempotency_requests_v3')").all()).toEqual([]);
    expect(raw.prepare('PRAGMA table_info(tareas)').all().some(c => c.name === 'rutina_ejecucion_id')).toBe(false);
  } finally { db?.close(); raw?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

it('includes routines, executions, notices and acknowledgements in recovery verification', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salguacate-handover-backup-')); let db;
  try {
    const file = path.join(dir, 'source.sqlite'); const uploads = path.join(dir, 'uploads'); fs.mkdirSync(uploads);
    db = createDatabase(file); await db.ready; await seedTestUsers(db);
    db.connection.exec(`INSERT INTO rutinas (id,local,titulo,fase,frecuencia,pasos_json,autor_id) VALUES (1,'Principal','Apertura','apertura','diaria','["Paso"]',2);
      INSERT INTO rutina_ejecuciones (id,rutina_id,fecha,preparado_por) VALUES (1,1,'2026-09-20',2);
      INSERT INTO tareas (titulo,fecha,local,rutina_ejecucion_id) VALUES ('Paso','2026-09-20','Principal',1);
      INSERT INTO relevos (id,local,fecha,contenido,autor_id) VALUES (1,'Principal','2026-09-20','Aviso',2);
      INSERT INTO relevo_lecturas (relevo_id,usuario_id) VALUES (1,3);
      INSERT INTO relevo_gestion (relevo_id,responsable_id) VALUES (1,3);
      INSERT INTO relevo_cambios (relevo_id,actor_id,detalle) VALUES (1,2,'Asignado');`);
    db.close(); db = null;
    await createBackup({ database: file, uploads, output: path.join(dir, 'backup'), offline: true });
    const report = await restoreBackup({ source: path.join(dir, 'backup'), output: path.join(dir, 'restored'), offline: true });
    for (const table of ['rutinas', 'rutina_ejecuciones', 'tareas', 'relevos', 'relevo_lecturas', 'relevo_gestion', 'relevo_cambios']) expect(report.tables[table].count).toBe(1);
  } finally { db?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
