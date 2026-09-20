import { beforeEach, afterEach, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApp } = require('../index');
const { createDatabase } = require('../database');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
let db, app, headers;
beforeEach(async () => {
  db = createDatabase(':memory:'); await db.ready; await seedTestUsers(db); app = createApp({ db });
  const login = await request(app).post('/api/login').send({ usuario_id: 1, pin: TEST_PIN }).expect(200);
  headers = { Authorization: `Bearer ${login.body.token}` };
});
afterEach(() => db.close());
it.each(['/api/login','/api/inventario','/api/proveedores','/api/pedidos','/api/cierres','/api/gastos','/api/turnos','/api/tareas','/api/eventos','/api/mensajes','/api/peticiones','/api/usuarios'])('rejects missing or wrongly typed bodies at %s without an internal error', async url => {
  await request(app).post(url).set(headers).expect(400);
  await request(app).post(url).set(headers).type('text/plain').send('not-json').expect(400);
});
it('keeps bodyless logout and health requests valid', async () => {
  await request(app).get('/api/health').expect(200); await request(app).post('/api/logout').set(headers).expect(204);
});
it('rejects unsafe stock adjustments and preserves the stock and audit', async () => {
  db.connection.prepare("INSERT INTO inventario(producto,local,stock_actual) VALUES ('Pan','Principal',?)").run(Number.MAX_SAFE_INTEGER);
  const audits = db.connection.prepare('SELECT count(*) n FROM audit_events').get().n;
  await request(app).put('/api/inventario/1/stock').set(headers).send({ increment: 1 }).expect(409);
  expect(db.connection.prepare('SELECT stock_actual FROM inventario').get().stock_actual).toBe(Number.MAX_SAFE_INTEGER);
  expect(db.connection.prepare('SELECT count(*) n FROM audit_events').get().n).toBe(audits);
});
it('checks repeated receipt lines together before changing any product', async () => {
  db.connection.prepare("INSERT INTO inventario(producto,local,stock_actual) VALUES ('Pan','Principal',?)").run(Number.MAX_SAFE_INTEGER - 3);
  db.connection.exec("INSERT INTO inventario(producto,local,stock_actual) VALUES ('Café','Principal',5)");
  const lines = [{ producto_id: 2, nombre: 'Café', cantidad: 1 }, { producto_id: 1, nombre: 'Pan', cantidad: 2 }, { producto_id: 1, nombre: 'Pan', cantidad: 2 }];
  const order = await request(app).post('/api/pedidos').set(headers).send({ fecha: '2026-09-20', local: 'Principal', productos: lines }).expect(200);
  await request(app).patch(`/api/pedidos/${order.body.id}/recibido`).set(headers).send({ sumar_stock: true }).expect(422);
  expect(db.connection.prepare('SELECT stock_actual FROM inventario ORDER BY id').all().map(r => r.stock_actual)).toEqual([Number.MAX_SAFE_INTEGER - 3, 5]);
  expect(db.connection.prepare('SELECT estado FROM pedidos').get().estado).toBe('pendiente');
});
