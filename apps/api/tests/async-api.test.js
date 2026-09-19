import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
const require = createRequire(import.meta.url);
const { createDatabase } = require('../database');
const { createLibsqlDatabase } = require('../libsql');
const { createAsyncStore } = require('../async-store');
const { createApp } = require('../index');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
let raw, db, app, owner, employee, counts;

// Real application routes through the remote adapter with a delayed local SQL
// double. This is not an integration test against the hosted Turso service.
beforeEach(async () => {
  raw = createDatabase(':memory:'); await raw.ready; await seedTestUsers(raw);
  counts = { execute: 0, batches: [] };
  const execute = async ({ sql, args = [] }) => {
    counts.execute++;
    await new Promise(resolve => setImmediate(resolve));
    const stmt = raw.connection.prepare(sql);
    if (stmt.columns().length) return { rows: stmt.all(...args), rowsAffected: 0, lastInsertRowid: null };
    const result = stmt.run(...args);
    return { rows: [], rowsAffected: result.changes, lastInsertRowid: result.lastInsertRowid };
  };
  const client = {
    execute, close: () => raw.close(),
    async transaction() {
      raw.connection.exec('BEGIN IMMEDIATE');
      return {
        execute,
        async batch(statements) { counts.batches.push(statements.length); const result = []; for (const statement of statements) result.push(await execute(statement)); return result; },
        async commit() { await new Promise(resolve => setImmediate(resolve)); raw.connection.exec('COMMIT'); },
        async rollback() { raw.connection.exec('ROLLBACK'); }, close() {},
      };
    },
  };
  db = createAsyncStore(createLibsqlDatabase(client)); app = createApp({ db });
  const login = async id => (await request(app).post('/api/login').send({ usuario_id: id, pin: TEST_PIN }).expect(200)).body.token;
  owner = await login(1); employee = await login(3);
});
afterEach(async () => { await db.close(); });
const auth = token => ({ Authorization: `Bearer ${token}` });
const expense = { fecha: '2026-09-19', local: 'Principal', proveedor_nombre: 'Synthetic', total: 12.50 };

describe('Application routes with asynchronous libSQL contract', () => {
  it('runs all authenticated list endpoints without Promise-shaped responses', async () => {
    for (const endpoint of ['usuarios', 'inventario', 'inventario/alertas', 'proveedores', 'pedidos', 'cierres', 'gastos', 'notas', 'eventos', 'tareas', 'turnos', 'peticiones', 'mensajes', 'fichajes/presencia']) {
      const result = await request(app).get(`/api/${endpoint}`).set(auth(owner)).expect(200);
      expect(Array.isArray(result.body), endpoint).toBe(true);
    }
    await request(app).get('/api/tareas').set(auth(employee)).expect(200);
  });
  it('serializes HTTP duplicate receipts and keeps stock reception a bounded batch', async () => {
    const key = randomUUID();
    const responses = await Promise.all(Array.from({ length: 8 }, () => request(app).post('/api/gastos').set(auth(owner)).set('Idempotency-Key', key).send(expense).expect(201)));
    expect(new Set(responses.map(r => r.body.id)).size).toBe(1);
    expect((await db.get('SELECT count(*) n FROM gastos')).n).toBe(1);
    const product = (await request(app).post('/api/inventario').set(auth(owner)).send({ producto: 'Synthetic', local: 'Principal', stock_actual: 10 }).expect(200)).body.id;
    const products = Array.from({ length: 500 }, () => ({ producto_id: product, nombre: 'Synthetic', cantidad: 1 }));
    const order = (await request(app).post('/api/pedidos').set(auth(owner)).send({ fecha: '2026-09-19', local: 'Principal', productos: products }).expect(200)).body.id;
    const before = counts.execute;
    const results = await Promise.all(Array.from({ length: 2 }, () => request(app).patch(`/api/pedidos/${order}/recibido`).set(auth(owner)).send({ sumar_stock: true })));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(counts.batches).toContain(500);
    // 500 statements inside one batch plus bounded auth/order/audit queries.
    expect(counts.execute - before).toBeLessThan(520);
    expect((await db.get('SELECT stock_actual FROM inventario WHERE id = ?', [product])).stock_actual).toBe(510);
  });
  it('keeps concurrent clock transitions atomic across awaited SQL', async () => {
    for (const tipo of ['entrada', 'descanso', 'volver', 'salida']) {
      const responses = await Promise.all(Array.from({ length: 2 }, () => request(app).post('/api/fichar').set(auth(employee)).send({ tipo })));
      expect(responses.map(r => r.status).sort(), tipo).toEqual([200, 400]);
    }
    const rows = await db.all('SELECT estado, salida FROM fichajes');
    expect(rows).toHaveLength(1); expect(rows[0].estado).toBe('fuera'); expect(rows[0].salida).toBeTruthy();
  });
  it.each([
    ['session', "DELETE FROM sessions WHERE usuario_id = 1"],
    ['role', "UPDATE usuarios SET rol = 'employee' WHERE id = 1"],
    ['version', 'UPDATE usuarios SET auth_version = auth_version + 1 WHERE id = 1'],
    ['inactive', 'UPDATE usuarios SET active = 0 WHERE id = 1'],
  ])('rechecks %s revocation between middleware and the write transaction', async (_name, revoke) => {
    const transaction = db.transaction.bind(db);
    let first = true;
    db.transaction = work => {
      if (first) { first = false; raw.connection.exec(revoke); }
      return transaction(work);
    };
    await request(app).post('/api/gastos').set(auth(owner)).send(expense).expect(401);
    expect((await db.get('SELECT count(*) n FROM gastos')).n).toBe(0);
  });
  it('checks target activity and task assignment inside the write transaction', async () => {
    const transaction = db.transaction.bind(db);
    let first = true;
    db.transaction = work => {
      if (first) { first = false; raw.connection.exec('UPDATE usuarios SET active = 0 WHERE id = 4'); }
      return transaction(work);
    };
    await request(app).post('/api/mensajes').set(auth(owner)).send({ destinatario_id: 4, asunto: 'Synthetic', cuerpo: 'Synthetic' }).expect(404);
    expect((await db.get('SELECT count(*) n FROM mensajes')).n).toBe(0);
    const task = await db.run("INSERT INTO tareas (titulo, fecha, asignado_a, local) VALUES ('test', '2026-09-19', 3, 'Principal')");
    first = true;
    db.transaction = work => {
      if (first) { first = false; raw.connection.prepare('UPDATE tareas SET asignado_a = 2 WHERE id = ?').run(task.lastInsertRowid); }
      return transaction(work);
    };
    await request(app).put(`/api/tareas/${task.lastInsertRowid}/completada`).set(auth(employee)).send({ completada: true }).expect(403);
    expect((await db.get('SELECT completada FROM tareas WHERE id = ?', [task.lastInsertRowid])).completada).toBe(0);
  });
  it('routes asynchronous authentication failures to a sanitized HTTP response', async () => {
    raw.connection.exec('DROP TABLE sessions');
    const result = await request(app).get('/api/notas').set(auth(owner)).expect(500);
    expect(JSON.stringify(result.body)).not.toMatch(/sessions|SQL|token/);
  });
});
