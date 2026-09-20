import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url);
const { createApp } = require('../index');
const { createDatabase } = require('../database');
const { readConfig } = require('../config');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
let db, app;
beforeEach(async () => {
  db = createDatabase(':memory:'); await db.ready;
  await seedTestUsers(db);
  app = createApp({ db });
});
afterEach(() => db.close());
const login = async (id = 1, pin = TEST_PIN) => (await request(app).post('/api/login').send({ usuario_id: id, pin }).expect(200)).body.token;
const auth = token => ({ Authorization: 'Bearer ' + token });
const userUpdate = { nombre: 'Empleado actualizado', rol: 'employee', local: 'Principal', telefono: '' };

describe('Startup and migration', () => {
  it.each([false, true])('migrates a legacy schema safely (duplicate active shifts: %s)', async duplicate => {
    const dir = mkdtempSync(path.join(tmpdir(), 'salguacate-legacy-'));
    const filename = path.join(dir, 'legacy.sqlite');
    let connection = new DatabaseSync(filename), migrated;
    try {
      connection.exec(`
        CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, rol TEXT NOT NULL, local TEXT, telefono TEXT, pin TEXT);
        INSERT INTO usuarios VALUES (1, 'Existing', 'owner', 'Todos', '', '0000');
        CREATE TABLE fichajes (id INTEGER PRIMARY KEY, usuario_id INTEGER, entrada TEXT NOT NULL, salida TEXT, estado TEXT);
        INSERT INTO fichajes VALUES (1, 1, '2026-09-18T08:00:00Z', NULL, 'trabajando');
      `);
      if (duplicate) connection.exec("INSERT INTO fichajes VALUES (2, 1, '2026-09-18T09:00:00Z', NULL, 'trabajando')");
      connection.close(); connection = null;
      migrated = createDatabase(filename);
      if (duplicate) {
        await expect(migrated.ready).rejects.toThrow(/UNIQUE/);
        migrated = null;
        connection = new DatabaseSync(filename);
        expect(connection.prepare('SELECT count(*) AS n FROM fichajes').get().n).toBe(2);
        expect(connection.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'").get()).toBeUndefined();
      } else {
        await migrated.ready;
        expect(migrated.connection.prepare('SELECT nombre, must_change_pin FROM usuarios').get()).toEqual({ nombre: 'Existing', must_change_pin: 1 });
        expect(migrated.connection.prepare('SELECT entrada FROM fichajes').get().entrada).toBe('2026-09-18T08:00:00Z');
      }
    } finally { migrated?.close(); connection?.close(); rmSync(dir, { recursive: true, force: true }); }
  });
  it('starts empty without demo accounts and reports readiness', async () => {
    const empty = createDatabase(':memory:'); await empty.ready;
    try {
      expect(empty.connection.prepare('SELECT count(*) AS n FROM usuarios').get().n).toBe(0);
      await request(createApp({ db: empty })).get('/api/health').expect(200, { status: 'ready' });
    } finally { empty.close(); }
  });
  it('reopens without reseeding or destroying data', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'salguacate-migration-'));
    let persisted;
    try {
      persisted = createDatabase(path.join(dir, 'test.sqlite')); await persisted.ready;
      persisted.connection.prepare("INSERT INTO usuarios(nombre,rol,pin) VALUES ('Existing','owner','0000')").run();
      persisted.close(); persisted = null;
      persisted = createDatabase(path.join(dir, 'test.sqlite')); await persisted.ready;
      expect(persisted.connection.prepare('SELECT nombre, must_change_pin FROM usuarios').all()).toEqual([{ nombre: 'Existing', must_change_pin: 1 }]);
      expect(persisted.connection.prepare('SELECT count(*) AS n FROM schema_migrations').get().n).toBe(3);
    } finally { persisted?.close(); rmSync(dir, { recursive: true, force: true }); }
  });
  it('refuses an unavailable database rather than reporting ready', async () => {
    const broken = createDatabase(':memory:'); await broken.ready;
    broken.close();
    broken.ready = Promise.reject(new Error('failed migration'));
    broken.ready.catch(() => {});
    await request(createApp({ db: broken })).get('/api/health').expect(503);
  });
  it('fails closed on Turso, incomplete production and invalid CORS', () => {
    expect(() => readConfig({ TURSO_DATABASE_URL: 'libsql://example' })).toThrow();
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() => readConfig({ CORS_ORIGINS: '*' })).toThrow();
    expect(readConfig({}).aiEnabled).toBe(false);
  });
  it('rolls back every write when a transaction fails', () => {
    expect(() => db.transaction(() => {
      db.connection.prepare("INSERT INTO notas (contenido) VALUES ('rollback')").run();
      throw new Error('failure');
    })).toThrow('failure');
    expect(db.connection.prepare('SELECT count(*) AS n FROM notas').get().n).toBe(0);
  });
});

describe('Authentication and authorization', () => {
  it('never exposes PINs or session data in public profiles', async () => {
    const res = await request(app).get('/api/usuarios/public').expect(200);
    expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'nombre', 'rol']);
  });
  it('stores only a digest of each random session token', async () => {
    const token = await login();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const session = db.connection.prepare('SELECT * FROM sessions').get();
    expect(session.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(session)).not.toContain(token);
    expect(db.connection.prepare('SELECT pin FROM usuarios WHERE id = 1').get().pin).toMatch(/^scrypt\$/);
    await request(app).get('/api/usuarios').set(auth(token)).expect(200);
  });
  it('rejects wrong PINs, forged tokens and hashes used as PINs', async () => {
    await request(app).post('/api/login').send({ usuario_id: 1, pin: '9999' }).expect(401);
    await request(app).get('/api/usuarios').set(auth('legacy-token-12345')).expect(401);
    await request(app).post('/api/login').send({ usuario_id: 1, pin: 'a'.repeat(64) }).expect(400);
  });
  it('revokes a logged-out session and rejects expired sessions', async () => {
    const token = await login();
    await request(app).post('/api/logout').set(auth(token)).expect(204);
    await request(app).get('/api/usuarios').set(auth(token)).expect(401);
    const second = await login();
    db.connection.prepare('UPDATE sessions SET expires_at = 0').run();
    await request(app).get('/api/usuarios').set(auth(second)).expect(401);
  });
  it('blocks business access for old PINs until renewal, then revokes the old token', async () => {
    const token = await login(4, '0000');
    expect(db.connection.prepare('SELECT pin FROM usuarios WHERE id = 4').get().pin).toMatch(/^scrypt\$/);
    const blocked = await request(app).get('/api/inventario').set(auth(token)).expect(403);
    expect(blocked.body.code).toBe('PIN_CHANGE_REQUIRED');
    await request(app).put('/api/auth/pin').set(auth(token)).send({ currentPin: '0000', newPin: TEST_PIN }).expect(200);
    await request(app).get('/api/inventario').set(auth(token)).expect(401);
    await request(app).post('/api/login').send({ usuario_id: 4, pin: '0000' }).expect(401);
    await request(app).get('/api/inventario').set(auth(await login(4))).expect(200);
  });
  it('upgrades legacy SHA256 without accepting the stored digest', async () => {
    const digest = createHash('sha256').update('1357').digest('hex');
    db.connection.prepare('UPDATE usuarios SET pin = ? WHERE id = 4').run(digest);
    await login(4, '1357');
    expect(db.connection.prepare('SELECT pin FROM usuarios WHERE id = 4').get().pin).toMatch(/^scrypt\$/);
  });
  it('limits failed attempts before expensive hashing and returns Retry-After', async () => {
    for (let i = 0; i < 8; i++) await request(app).post('/api/login').send({ usuario_id: 1, pin: '9999' }).expect(401);
    const res = await request(app).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN }).expect(429);
    expect(res.headers['retry-after']).toBe('900');
  });
  it('employees cannot read private notes, manage staff or clock another employee', async () => {
    const token = await login(3);
    await request(app).get('/api/notas').set(auth(token)).expect(403);
    await request(app).get('/api/usuarios').set(auth(token)).expect(403);
    await request(app).post('/api/fichar').set(auth(token)).send({ usuario_id: 2, tipo: 'entrada' }).expect(403);
  });
  it('role changes immediately invalidate existing sessions', async () => {
    const owner = await login(), manager = await login(2);
    await request(app).put('/api/usuarios/2').set(auth(owner)).send(userUpdate).expect(200);
    await request(app).get('/api/usuarios').set(auth(manager)).expect(401);
    await request(app).get('/api/usuarios').set(auth(await login(2))).expect(403);
  });
  it('managers cannot promote themselves or other employees', async () => {
    const token = await login(2);
    await request(app).put('/api/usuarios/2').set(auth(token)).send(userUpdate).expect(403);
    await request(app).post('/api/usuarios').set(auth(token)).send({ ...userUpdate, rol: 'owner', pin: TEST_PIN }).expect(403);
  });
  it('protects the last owner and requires an explicit strong PIN for new staff', async () => {
    const token = await login();
    await request(app).delete('/api/usuarios/1').set(auth(token)).expect(409);
    await request(app).put('/api/usuarios/1').set(auth(token)).send(userUpdate).expect(409);
    await request(app).post('/api/usuarios').set(auth(token)).send(userUpdate).expect(400);
    await request(app).post('/api/usuarios').set(auth(token)).send({ ...userUpdate, pin: '000000' }).expect(400);
    await request(app).post('/api/usuarios').set(auth(token)).send({ ...userUpdate, pin: TEST_PIN }).expect(201);
  });
  it('deactivation revokes access and preserves employee history', async () => {
    const employee = await login(3), owner = await login();
    await request(app).post('/api/fichar').set(auth(employee)).send({ tipo: 'entrada' }).expect(200);
    await request(app).delete('/api/usuarios/3').set(auth(owner)).expect(200);
    expect(db.connection.prepare('SELECT count(*) AS n FROM fichajes WHERE usuario_id = 3').get().n).toBe(1);
    await request(app).get('/api/inventario').set(auth(employee)).expect(401);
    await request(app).post('/api/login').send({ usuario_id: 3, pin: TEST_PIN }).expect(401);
    const profiles = await request(app).get('/api/usuarios/public').expect(200);
    expect(profiles.body.some(u => u.id === 3)).toBe(false);
  });
  it('rejects unknown origins and malformed JSON without database details', async () => {
    await request(app).get('/api/usuarios/public').set('Origin', 'https://evil.example').expect(403);
    const res = await request(app).post('/api/login').set('Content-Type', 'application/json').send('{').expect(400);
    expect(res.body).toHaveProperty('error');
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|SELECT|stack/);
  });
  it('AI is disabled for every endpoint without contacting external providers', async () => {
    const token = await login();
    for (const endpoint of ['chat', 'vision', 'poster']) {
      const res = await request(app).post('/api/ai/' + endpoint).set(auth(token)).send({ message: 'test' }).expect(503);
      expect(res.body.code).toBe('AI_DISABLED');
    }
  });
});

describe('Atomic operations', () => {
  const seedOrder = (products = [{ producto_id: 1, cantidad: 4 }]) => {
    db.connection.prepare("INSERT INTO inventario (producto, stock_actual, local) VALUES ('Agua', 2, 'Principal')").run();
    db.connection.prepare("INSERT INTO pedidos (fecha, proveedor_id, local, productos, estado) VALUES ('2026-09-19', NULL, 'Principal', ?, 'pendiente')").run(JSON.stringify(products));
  };
  it('receives an order exactly once even for concurrent retries', async () => {
    seedOrder(); const token = await login();
    const receive = () => request(app).patch('/api/pedidos/1/recibido').set(auth(token)).send({ sumar_stock: true });
    const results = await Promise.all([receive(), receive()]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(db.connection.prepare('SELECT stock_actual FROM inventario WHERE id = 1').get().stock_actual).toBe(6);
  });
  it('invalid order items leave all stock and order state untouched', async () => {
    seedOrder([{ producto_id: 1, cantidad: 4 }, { producto_id: 999, cantidad: 1 }]);
    await request(app).patch('/api/pedidos/1/recibido').set(auth(await login())).send({ sumar_stock: true }).expect(422);
    expect(db.connection.prepare('SELECT stock_actual FROM inventario').get().stock_actual).toBe(2);
    expect(db.connection.prepare('SELECT estado FROM pedidos').get().estado).toBe('pendiente');
  });
  it('can explicitly receive without updating stock', async () => {
    seedOrder();
    await request(app).patch('/api/pedidos/1/recibido').set(auth(await login())).send({ sumar_stock: false }).expect(200);
    expect(db.connection.prepare('SELECT stock_actual FROM inventario').get().stock_actual).toBe(2);
  });
  it('rolls back stock and order state if a later write fails', async () => {
    seedOrder(); const token = await login();
    db.connection.exec("CREATE TRIGGER reject_order_audit BEFORE INSERT ON audit_events WHEN NEW.action = 'order.received_with_stock' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    await request(app).patch('/api/pedidos/1/recibido').set(auth(token)).send({ sumar_stock: true }).expect(500);
    expect(db.connection.prepare('SELECT stock_actual FROM inventario').get().stock_actual).toBe(2);
    expect(db.connection.prepare('SELECT estado FROM pedidos').get().estado).toBe('pendiente');
  });
  it('validates inventory creation and preserves an explicit zero minimum', async () => {
    const token = await login();
    const body = { producto: 'Agua', stock_actual: 0, stock_minimo: 0, local: 'Principal', categoria: 'Bebida' };
    await request(app).post('/api/inventario').set(auth(token)).send(body).expect(200);
    expect(db.connection.prepare('SELECT stock_minimo FROM inventario').get().stock_minimo).toBe(0);
    await request(app).post('/api/inventario').set(auth(token)).send({ ...body, stock_actual: '2abc' }).expect(400);
    await request(app).post('/api/inventario').set(auth(token)).send({ ...body, proveedor_id: 999 }).expect(400);
  });
  it('validates stock adjustments rather than coercing arbitrary input', async () => {
    seedOrder(); const token = await login();
    for (const increment of ['10', 0.5, null, 1000001]) await request(app).put('/api/inventario/1/stock').set(auth(token)).send({ increment }).expect(400);
    await request(app).put('/api/inventario/999/stock').set(auth(token)).send({ increment: 1 }).expect(404);
  });
  it('prevents duplicate cash closes and computes totals in cents', async () => {
    const token = await login();
    const body = { fecha: '2026-09-19', local: 'Principal', efectivo: '0.10', tarjeta: '0.20' };
    await request(app).post('/api/cierres').set(auth(token)).send(body).expect(201);
    await request(app).post('/api/cierres').set(auth(token)).send(body).expect(409);
    expect(db.connection.prepare('SELECT total FROM cierres').get().total).toBe(0.3);
    for (const invalid of [{ fecha: '2026-02-30' }, { efectivo: '12foo' }, { efectivo: 0.001 }, { efectivo: -1 }]) {
      await request(app).post('/api/cierres').set(auth(token)).send({ ...body, ...invalid }).expect(400);
    }
  });
  it('validates expenses and preserves the original clock state machine', async () => {
    const owner = await login(), employee = await login(3);
    await request(app).post('/api/gastos').set(auth(owner)).send({ fecha: '2026-09-19', local: 'Principal', proveedor_nombre: 'Proveedor', total: '12.50' }).expect(201);
    await request(app).post('/api/gastos').set(auth(owner)).send({ total: 'NaN' }).expect(400);
    for (const tipo of ['entrada', 'descanso', 'volver', 'salida']) await request(app).post('/api/fichar').set(auth(employee)).send({ tipo }).expect(200);
    await request(app).get('/api/fichajes/activo').set(auth(employee)).expect(200, null);
  });
});
