import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApp } = require('../index');
const { createDatabase } = require('../database');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
let db, app, owner, employee, manager;
const auth = token => ({ Authorization: 'Bearer ' + token });
beforeEach(async () => {
  db = createDatabase(':memory:'); await db.ready; await seedTestUsers(db);
  app = createApp({ db });
  const login = async id => (await request(app).post('/api/login').send({ usuario_id: id, pin: TEST_PIN }).expect(200)).body.token;
  [owner, employee, manager] = await Promise.all([login(1), login(3), login(2)]);
});
afterEach(() => db.close());
const shift = { usuario_id: 3, fecha: '2026-09-19', hora_inicio: '18:00', hora_fin: '02:00', local: 'Principal' };
const petition = { tipo: 'vacaciones', fecha_inicio: '2026-09-20', fecha_fin: '2026-09-23', comentarios: 'Prueba' };
const task = { titulo: 'Preparar sala', fecha: '2026-09-19', local: 'Principal', prioridad: 'normal', asignado_a: 3 };
const event = { titulo: 'Concierto', fecha: '2026-09-20', hora: '22:00', tipo: 'Concierto', descripcion: '' };

describe('Workforce flows', () => {
  it('assigns an overnight shift and employees see only their own schedule', async () => {
    await request(app).post('/api/turnos').set(auth(manager)).send(shift).expect(200);
    await request(app).post('/api/turnos').set(auth(owner)).send({ ...shift, usuario_id: 2 }).expect(200);
    const own = await request(app).get('/api/turnos?usuario_id=2').set(auth(employee)).expect(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0]).toMatchObject({ usuario_id: 3, hora_inicio: '18:00', hora_fin: '02:00' });
    await request(app).post('/api/turnos').set(auth(employee)).send(shift).expect(403);
  });
  it('rejects malformed dates, times and employee identifiers before storing shifts', async () => {
    for (const invalid of [{ fecha: '2026-02-30' }, { hora_inicio: '25:00' }, { hora_fin: [] }, { usuario_id: true }, { local: 'Unknown' }]) {
      await request(app).post('/api/turnos').set(auth(manager)).send({ ...shift, ...invalid }).expect(400);
    }
    await request(app).post('/api/turnos').set(auth(manager)).send({ ...shift, usuario_id: 999 }).expect(404);
    expect(db.connection.prepare('SELECT count(*) AS n FROM turnos').get().n).toBe(0);
  });
  it('does not assign new work or send messages to inactive users', async () => {
    db.connection.prepare('UPDATE usuarios SET active = 0 WHERE id = 4').run();
    await request(app).post('/api/turnos').set(auth(owner)).send({ ...shift, usuario_id: 4 }).expect(404);
    await request(app).post('/api/tareas').set(auth(owner)).send({ ...task, asignado_a: 4 }).expect(404);
    await request(app).post('/api/mensajes').set(auth(owner)).send({ destinatario_id: 4, asunto: 'Hola', cuerpo: 'Prueba' }).expect(404);
    await request(app).post('/api/fichar').set(auth(owner)).send({ usuario_id: 4, tipo: 'entrada' }).expect(404);
  });
  it('binds requests to the authenticated employee and keeps other requests private', async () => {
    await request(app).post('/api/peticiones').set(auth(employee)).send({ ...petition, usuario_id: 1 }).expect(200);
    await request(app).post('/api/peticiones').set(auth(owner)).send(petition).expect(200);
    const own = await request(app).get('/api/peticiones').set(auth(employee)).expect(200);
    expect(own.body).toHaveLength(1); expect(own.body[0].usuario_id).toBe(3);
    expect((await request(app).get('/api/peticiones').set(auth(manager)).expect(200)).body).toHaveLength(2);
    await request(app).patch('/api/peticiones/1').set(auth(employee)).send({ estado: 'aprobado' }).expect(403);
  });
  it('resolves a pending request once and reports missing or conflicting requests', async () => {
    await request(app).post('/api/peticiones').set(auth(employee)).send(petition).expect(200);
    const outcomes = await Promise.all(['aprobado', 'rechazado'].map(estado => request(app).patch('/api/peticiones/1').set(auth(manager)).send({ estado })));
    expect(outcomes.map(r => r.status).sort()).toEqual([200, 409]);
    await request(app).patch('/api/peticiones/999').set(auth(owner)).send({ estado: 'aprobado' }).expect(404);
    await request(app).patch('/api/peticiones/1').set(auth(owner)).send({ estado: 'pending' }).expect(400);
  });
  it('validates request ranges and enums without inventing a past-date cutoff', async () => {
    for (const invalid of [{ tipo: 'unknown' }, { fecha_inicio: 'invalid' }, { fecha_fin: '2026-09-01' }, { fecha_fin: false }, { comentarios: {} }]) {
      await request(app).post('/api/peticiones').set(auth(employee)).send({ ...petition, ...invalid }).expect(400);
    }
    await request(app).post('/api/peticiones').set(auth(employee)).send({ tipo: 'baja', fecha_inicio: '2025-01-01' }).expect(200);
  });
  it('rejects invalid clock commands and duplicate entries', async () => {
    await request(app).post('/api/fichar').set(auth(employee)).send({ tipo: 'unknown' }).expect(400);
    await request(app).post('/api/fichar').set(auth(owner)).send({ tipo: 'entrada', usuario_id: 999 }).expect(404);
    await request(app).post('/api/fichar').set(auth(employee)).send({ tipo: 'entrada' }).expect(200);
    await request(app).post('/api/fichar').set(auth(employee)).send({ tipo: 'entrada' }).expect(400);
    expect(db.connection.prepare('SELECT count(*) AS n FROM fichajes').get().n).toBe(1);
  });
});

describe('Communications and task permissions', () => {
  it('delivers a message only to its recipient and prevents sender impersonation', async () => {
    const message = { destinatario_id: 1, asunto: 'Cambio', cuerpo: 'Solicitud de cambio' };
    await request(app).post('/api/mensajes').set(auth(employee)).send({ ...message, remitente_id: 2 }).expect(403);
    await request(app).post('/api/mensajes').set(auth(employee)).send(message).expect(200);
    const inbox = await request(app).get('/api/mensajes').set(auth(owner)).expect(200);
    expect(inbox.body[0]).toMatchObject({ remitente_id: 3, cuerpo: message.cuerpo });
    expect((await request(app).get('/api/mensajes').set(auth(manager)).expect(200)).body).toEqual([]);
    await request(app).get('/api/mensajes?usuario_id=1').set(auth(employee)).expect(403);
    await request(app).get('/api/mensajes?usuario_id=3').set(auth(owner)).expect(403);
  });
  it('rejects empty, oversized and mistyped message payloads', async () => {
    for (const change of [{ asunto: ' ' }, { cuerpo: [] }, { asunto: 'x'.repeat(161) }, { cuerpo: 'x'.repeat(10001) }, { destinatario_id: {} }]) {
      await request(app).post('/api/mensajes').set(auth(employee)).send({ destinatario_id: 1, asunto: 'Hola', cuerpo: 'Texto', ...change }).expect(400);
    }
    expect(db.connection.prepare('SELECT count(*) AS n FROM mensajes').get().n).toBe(0);
  });
  it('protects notes and reports missing notes instead of phantom success', async () => {
    const note = await request(app).post('/api/notas').set(auth(manager)).send({ contenido: 'Nota', color: 'yellow' }).expect(200);
    const id = note.body.id;
    await request(app).put('/api/notas/' + id).set(auth(owner)).send({ contenido: 'Cambio', color: 'blue', fijada: true }).expect(200);
    await request(app).put('/api/notas/' + id).set(auth(owner)).send({ contenido: 'Cambio', color: 'blue', fijada: 'false' }).expect(400);
    await request(app).get('/api/notas').set(auth(employee)).expect(403);
    await request(app).delete('/api/notas/' + id).set(auth(manager)).expect(200);
    await request(app).delete('/api/notas/' + id).set(auth(manager)).expect(404);
    await request(app).put('/api/notas/' + id).set(auth(owner)).send({ contenido: 'Cambio', color: 'blue', fijada: false }).expect(404);
  });
  it('reads note authors without dropping legacy unattributed notes and keeps stable same-second ordering', async () => {
    db.connection.prepare("INSERT INTO notas (id,usuario_id,contenido,color,fijada,creado_en) VALUES (1,2,'De gestión','sepia',0,'2024-02-29 23:30:00'), (2,NULL,'Histórica',NULL,0,'2024-02-29 23:30:00')").run();
    const notes = (await request(app).get('/api/notas').set(auth(owner)).expect(200)).body;
    expect(notes.map(note => note.id)).toEqual([2, 1]);
    expect(notes[0]).toMatchObject({ usuario_id: null, autor: null, color: null });
    expect(notes[1].autor).toBe(db.connection.prepare('SELECT nombre FROM usuarios WHERE id=2').get().nombre);
    expect(notes[1].creado_en).toBe('2024-02-29 23:30:00');
    expect(notes.some(note => 'pin' in note || 'pin_hash' in note)).toBe(false);
  });
  it('pins only the requested state, preserving content, colour, author and creation time edited by another client', async () => {
    const { body: { id } } = await request(app).post('/api/notas').set(auth(manager)).send({ contenido: 'Original', color: 'yellow' }).expect(200);
    await request(app).put('/api/notas/' + id).set(auth(owner)).send({ contenido: 'Edición más reciente', color: 'sepia', fijada: false }).expect(200);
    const before = db.connection.prepare('SELECT * FROM notas WHERE id=?').get(id);
    await request(app).patch(`/api/notas/${id}/fijada`).set(auth(manager)).send({ fijada: true, contenido: 'Original', color: 'yellow' }).expect(200);
    expect(db.connection.prepare('SELECT * FROM notas WHERE id=?').get(id)).toEqual({ ...before, fijada: 1 });
    await request(app).patch(`/api/notas/${id}/fijada`).set(auth(owner)).send({ fijada: true }).expect(200);
    await request(app).patch(`/api/notas/${id}/fijada`).set(auth(owner)).send({ fijada: false }).expect(200);
    expect(db.connection.prepare('SELECT * FROM notas WHERE id=?').get(id)).toEqual(before);
  });
  it('requires authentication, management role and a valid note ID and pinned state', async () => {
    const { body: { id } } = await request(app).post('/api/notas').set(auth(owner)).send({ contenido: 'Original' }).expect(200);
    await request(app).patch(`/api/notas/${id}/fijada`).send({ fijada: true }).expect(401);
    await request(app).patch(`/api/notas/${id}/fijada`).set(auth(employee)).send({ fijada: true }).expect(403);
    await request(app).patch(`/api/notas/${id}/fijada`).set(auth(owner)).expect(400);
    for (const fijada of ['false', null, {}, [], 2]) await request(app).patch(`/api/notas/${id}/fijada`).set(auth(owner)).send({ fijada }).expect(400);
    for (const target of ['0', '-1', '1.5', 'abc', '9007199254740992']) await request(app).patch(`/api/notas/${target}/fijada`).set(auth(owner)).send({ fijada: true }).expect(400);
    await request(app).patch('/api/notas/999/fijada').set(auth(owner)).send({ fijada: true }).expect(404);
    expect(db.connection.prepare('SELECT fijada FROM notas WHERE id=?').get(id).fijada).toBe(0);
  });
  it('filters employee tasks by both assignment and location and enforces the same rule on writes', async () => {
    for (const data of [task, { ...task, asignado_a: 2 }, { ...task, local: 'Segundo Local' }, { ...task, asignado_a: null, local: 'Ambos' }]) {
      await request(app).post('/api/tareas').set(auth(manager)).send(data).expect(200);
    }
    const own = await request(app).get('/api/tareas?local=Segundo%20Local').set(auth(employee)).expect(200);
    expect(own.body.map(t => t.id).sort()).toEqual([1, 4]);
    for (const id of [2, 3]) await request(app).put('/api/tareas/' + id + '/completada').set(auth(employee)).send({ completada: true }).expect(403);
    await request(app).put('/api/tareas/1/completada').set(auth(employee)).send({ completada: 'false' }).expect(400);
    await request(app).put('/api/tareas/1/completada').set(auth(employee)).send({ completada: true }).expect(200);
    await request(app).put('/api/tareas/4/completada').set(auth(employee)).send({ completada: 1 }).expect(200);
    await request(app).delete('/api/tareas/1').set(auth(employee)).expect(403);
    await request(app).delete('/api/tareas/1').set(auth(owner)).expect(200);
    await request(app).put('/api/tareas/1/completada').set(auth(owner)).send({ completada: false }).expect(404);
    await request(app).delete('/api/tareas/1').set(auth(owner)).expect(404);
  });
  it('validates task payloads without writing partial records', async () => {
    for (const invalid of [{ titulo: ' ' }, { fecha: '2026-02-30' }, { asignado_a: true }, { prioridad: 'urgent' }, { local: 'unknown' }]) {
      await request(app).post('/api/tareas').set(auth(owner)).send({ ...task, ...invalid }).expect(400);
    }
    expect(db.connection.prepare('SELECT count(*) AS n FROM tareas').get().n).toBe(0);
  });
});

describe('Catalog, agenda and HTTP boundaries', () => {
  it('validates event lifecycle and missing-resource responses', async () => {
    await request(app).post('/api/eventos').set(auth(owner)).send(event).expect(200);
    await request(app).put('/api/eventos/1').set(auth(manager)).send({ ...event, titulo: 'Actualizado' }).expect(200);
    expect((await request(app).get('/api/eventos').set(auth(employee)).expect(200)).body[0].titulo).toBe('Actualizado');
    await request(app).post('/api/eventos').set(auth(employee)).send(event).expect(403);
    await request(app).post('/api/eventos').set(auth(owner)).send({ ...event, hora: '24:60' }).expect(400);
    await request(app).delete('/api/eventos/1').set(auth(owner)).expect(200);
    await request(app).delete('/api/eventos/1').set(auth(owner)).expect(404);
    await request(app).put('/api/eventos/1').set(auth(owner)).send(event).expect(404);
  });
  it('validates supplier and order data before persisting any line', async () => {
    await request(app).post('/api/proveedores').set(auth(owner)).send({ nombre: ' ' }).expect(400);
    await request(app).post('/api/proveedores').set(auth(manager)).send({ nombre: 'Proveedor', email: 'test@example.com' }).expect(200);
    await request(app).post('/api/inventario').set(auth(owner)).send({ producto: 'Agua', stock_actual: 2, stock_minimo: 5, local: 'Principal', proveedor_id: 1 }).expect(200);
    const order = { fecha: '2026-09-19', local: 'Principal', proveedor_id: 1, proveedor_nombre: 'Proveedor', productos: [{ producto_id: 1, nombre: 'Agua', cantidad: 3 }] };
    for (const invalid of [{ productos: [] }, { productos: '[]' }, { local: 'Segundo Local' }, { proveedor_id: 999 }, { fecha: '2026-02-30' }, { productos: [{ producto_id: 1, nombre: 'Agua', cantidad: 0.5 }] }]) {
      await request(app).post('/api/pedidos').set(auth(owner)).send({ ...order, ...invalid }).expect(400);
    }
    expect(db.connection.prepare('SELECT count(*) AS n FROM pedidos').get().n).toBe(0);
    const response = await request(app).post('/api/pedidos').set(auth(owner)).send(order).expect(200);
    await request(app).delete('/api/pedidos/' + response.body.id).set(auth(owner)).expect(200);
    await request(app).delete('/api/pedidos/' + response.body.id).set(auth(owner)).expect(404);
  });
  it('rejects arrays, nested query parameters and malformed resource IDs', async () => {
    await request(app).post('/api/mensajes').set(auth(employee)).send([]).expect(400);
    await request(app).get('/api/inventario?local[x]=Principal').set(auth(owner)).expect(400);
    await request(app).get('/api/turnos?usuario_id=1&usuario_id=2').set(auth(owner)).expect(400);
    for (const id of ['0', '-1', '1.5', 'abc', '99999999999999999999']) await request(app).delete('/api/tareas/' + id).set(auth(owner)).expect(400);
  });
  it('keeps every extracted business module behind authentication', async () => {
    for (const endpoint of ['fichajes/activo', 'inventario', 'proveedores', 'turnos', 'mensajes', 'cierres', 'gastos', 'peticiones', 'pedidos', 'eventos', 'notas', 'tareas']) {
      await request(app).get('/api/' + endpoint).expect(401);
    }
    for (const endpoint of ['fichar', 'inventario', 'proveedores', 'turnos', 'mensajes', 'peticiones', 'pedidos', 'eventos', 'notas', 'tareas']) {
      await request(app).post('/api/' + endpoint).send({}).expect(401);
    }
  });
});
