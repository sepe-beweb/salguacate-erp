import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url);
const { createApp } = require('../index');
const { createDatabase } = require('../database');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
const { schemaV2 } = require('../../../tests/fixtures/schema-v2.cjs');
let db, app, token;
beforeEach(async () => {
  db = createDatabase(':memory:'); await db.ready; await seedTestUsers(db);
  app = createApp({ db });
  token = (await request(app).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN }).expect(200)).body.token;
});
afterEach(() => db.close());
const note = { contenido: 'Nota recuperable', color: 'blue' };
const expense = { fecha: '2026-09-19', local: 'Principal', proveedor_nombre: 'Proveedor prueba', total: '12.50', concepto: 'Compra' };
const count = table => db.connection.prepare('SELECT count(*) n FROM ' + table).get().n;
const send = (endpoint, key, body, authToken = token, target = app) => {
  const req = request(target).post(endpoint).set('Authorization', 'Bearer ' + authToken);
  if (key !== undefined) req.set('Idempotency-Key', key);
  return req.send(body);
};

describe('Atomic creation receipts', () => {
  it.each([
    ['/api/notas', 'notas', note, 200, 'note.created'],
    ['/api/gastos', 'gastos', expense, 201, 'expense.created']
  ])('replays %s with the original ID, status and one audit', async (endpoint, table, body, status, action) => {
    const key = randomUUID();
    const first = await send(endpoint, key, body).expect(status);
    const second = await send(endpoint, key, body).expect(status);
    expect(second.body).toEqual(first.body);
    expect(count(table)).toBe(1);
    expect(count('idempotency_requests')).toBe(1);
    expect(db.connection.prepare('SELECT count(*) n FROM audit_events WHERE action = ?').get(action).n).toBe(1);
    const receipt = db.connection.prepare('SELECT * FROM idempotency_requests').get();
    expect(receipt.request_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(receipt)).not.toContain(body.contenido || body.proveedor_nombre);
  });

  it.each([['/api/notas', note, { ...note, contenido: 'Otra' }], ['/api/gastos', expense, { ...expense, total: '22' }]])('rejects reuse with changed %s data', async (endpoint, body, changed) => {
    const key = randomUUID();
    await send(endpoint, key, body).expect(endpoint === '/api/notas' ? 200 : 201);
    const conflict = await send(endpoint, key, changed).expect(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(count('idempotency_requests')).toBe(1);
  });

  it('serializes concurrent duplicate requests into one expense', async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 12 }, () => send('/api/gastos', key, expense).expect(201)));
    expect(new Set(results.map(r => r.body.id)).size).toBe(1);
    expect(count('gastos')).toBe(1);
  });

  it('allows separate explicit attempts with identical business data', async () => {
    const a = await send('/api/notas', randomUUID(), note).expect(200);
    const b = await send('/api/notas', randomUUID(), note).expect(200);
    expect(a.body.id).not.toBe(b.body.id);
    expect(count('notas')).toBe(2);
  });

  it('scopes keys by actor and operation, never by shared content alone', async () => {
    const key = randomUUID();
    const manager = (await request(app).post('/api/login').send({ usuario_id: 2, pin: TEST_PIN })).body.token;
    await send('/api/notas', key, note).expect(200);
    await send('/api/notas', key, note, manager).expect(200);
    await send('/api/gastos', key, expense).expect(201);
    expect(count('notas')).toBe(2);
    expect(count('gastos')).toBe(1);
    expect(count('idempotency_requests')).toBe(3);
  });

  it('requires current authorization even for an existing receipt', async () => {
    const key = randomUUID();
    await send('/api/notas', key, note).expect(200);
    const employee = (await request(app).post('/api/login').send({ usuario_id: 3, pin: TEST_PIN })).body.token;
    await send('/api/notas', key, note, employee).expect(403);
    await request(app).post('/api/logout').set('Authorization', 'Bearer ' + token).expect(204);
    await send('/api/notas', key, note).expect(401);
    expect(count('notas')).toBe(1);
  });

  it.each(['', 'not-a-uuid', 'x'.repeat(200)])('rejects malformed keys without reserving or writing', async key => {
    expect((await send('/api/notas', key, note).expect(400)).body.code).toBe('IDEMPOTENCY_KEY_INVALID');
    expect(count('notas')).toBe(0);
    expect(count('idempotency_requests')).toBe(0);
  });

  it('does not reserve a validation failure and normalizes equivalent expense values', async () => {
    const key = randomUUID();
    await send('/api/gastos', key, { ...expense, total: '-1' }).expect(400);
    expect(count('idempotency_requests')).toBe(0);
    const first = await send('/api/gastos', key, expense).expect(201);
    const again = await send('/api/gastos', key.toUpperCase(), { ...expense, total: 12.5, proveedor_nombre: ' Proveedor prueba ' }).expect(201);
    expect(again.body).toEqual(first.body);
    expect(count('gastos')).toBe(1);
  });

  it.each([['/api/notas', 'notas', note, 200], ['/api/gastos', 'gastos', expense, 201]])('rolls back %s and its audit if receipt insertion fails', async (endpoint, table, body, status) => {
    db.connection.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON idempotency_requests BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;");
    const key = randomUUID();
    const audits = count('audit_events');
    await send(endpoint, key, body).expect(500);
    expect(count(table)).toBe(0);
    expect(count('audit_events')).toBe(audits);
    expect(count('idempotency_requests')).toBe(0);
    db.connection.exec('DROP TRIGGER fail_receipt');
    await send(endpoint, key, body).expect(status);
    expect(count(table)).toBe(1);
  });

  it('does not recreate an entity deleted after a successful attempt', async () => {
    const key = randomUUID();
    const first = await send('/api/notas', key, note).expect(200);
    await request(app).delete('/api/notas/' + first.body.id).set('Authorization', 'Bearer ' + token).expect(200);
    expect((await send('/api/notas', key, note).expect(200)).body).toEqual(first.body);
    expect(count('notas')).toBe(0);
  });

  it('retains legacy unkeyed requests without claiming deduplication', async () => {
    await send('/api/notas', undefined, note).expect(200);
    await send('/api/notas', undefined, note).expect(200);
    expect(count('notas')).toBe(2);
    expect(count('idempotency_requests')).toBe(0);
  });

  it('allows the idempotency header in the authenticated cross-origin workflow', async () => {
    const preflight = await request(app).options('/api/gastos')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key').expect(204);
    expect(preflight.headers['access-control-allow-headers'].toLowerCase()).toContain('idempotency-key');
  });

  it('survives database reopen, another connection and a new session', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salguacate-idempotency-'));
    let persistent;
    try {
      const file = path.join(dir, 'test.sqlite');
      persistent = createDatabase(file); await persistent.ready; await seedTestUsers(persistent);
      let target = createApp({ db: persistent });
      let auth = (await request(target).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN })).body.token;
      const key = randomUUID();
      const first = await send('/api/gastos', key, expense, auth, target).expect(201);
      persistent.close(); persistent = null;
      persistent = createDatabase(file); await persistent.ready; target = createApp({ db: persistent });
      auth = (await request(target).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN })).body.token;
      expect((await send('/api/gastos', key, expense, auth, target).expect(201)).body).toEqual(first.body);
      expect(persistent.connection.prepare('SELECT count(*) n FROM gastos').get().n).toBe(1);
    } finally { persistent?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('migrates version 1 without replacing historical records', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salguacate-v2-'));
    let persistent;
    try {
      const file = path.join(dir, 'test.sqlite');
      persistent = createDatabase(file); await persistent.ready; await seedTestUsers(persistent);
      schemaV2(persistent.connection);
      persistent.connection.exec("INSERT INTO notas (id,usuario_id,contenido,color) VALUES (40,1,'Histórica','pink'); DROP TABLE idempotency_requests; DELETE FROM schema_migrations WHERE version=2;");
      persistent.close(); persistent = null;
      persistent = createDatabase(file); await persistent.ready;
      expect(persistent.connection.prepare('SELECT id,contenido FROM notas').get()).toEqual({ id: 40, contenido: 'Histórica' });
      expect(persistent.connection.prepare('SELECT count(*) n FROM idempotency_requests').get().n).toBe(0);
      expect(persistent.connection.prepare('SELECT max(version) v FROM schema_migrations').get().v).toBe(6);
    } finally { persistent?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('rolls back a failed version 2 migration without marking it applied', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salguacate-v2-failed-'));
    const file = path.join(dir, 'test.sqlite');
    let persistent, raw;
    try {
      persistent = createDatabase(file); await persistent.ready; await seedTestUsers(persistent);
      schemaV2(persistent.connection);
      persistent.connection.exec("INSERT INTO notas (id,usuario_id,contenido,color) VALUES (40,1,'Conservar','pink'); DELETE FROM schema_migrations WHERE version=2;");
      persistent.close(); persistent = null;
      // Existing unexpected table makes CREATE TABLE fail. No repair by deletion.
      const failed = createDatabase(file);
      await expect(failed.ready).rejects.toThrow(/already exists/);
      raw = new DatabaseSync(file, { readOnly: true });
      expect(raw.prepare('SELECT max(version) v FROM schema_migrations').get().v).toBe(1);
      expect(raw.prepare('SELECT id,contenido FROM notas').get()).toEqual({ id: 40, contenido: 'Conservar' });
    } finally { persistent?.close(); raw?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
