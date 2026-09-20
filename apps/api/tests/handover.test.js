import { beforeEach, afterEach, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { createDatabase } = require('../database');
const { createApp } = require('../index');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
let db, app, owner, manager, employee;
const auth = token => ({ Authorization: `Bearer ${token}` });
const routine = { local: 'Principal', titulo: 'Preparar sala', fase: 'apertura', frecuencia: 'diaria', pasos: ['Revisar mesas', 'Comprobar café'] };
const notice = { local: 'Principal', fecha: '2026-09-20', contenido: 'Revisar cafetera antes del servicio.' };
const day = { local: 'Principal', fecha: '2026-09-20' };
const create = (endpoint, body, token = manager, key = randomUUID()) => request(app).post(endpoint).set(auth(token)).set('Idempotency-Key', key).send(body);
const prepare = (body = day, token = manager) => request(app).post('/api/rutinas/preparar').set(auth(token)).send(body);
const workday = (token = manager, local = 'Principal', fecha = day.fecha) => request(app).get('/api/jornada').query({ local, fecha }).set(auth(token));
const count = table => db.connection.prepare(`SELECT count(*) n FROM ${table}`).get().n;
beforeEach(async () => {
  db = createDatabase(':memory:'); await db.ready; await seedTestUsers(db); app = createApp({ db });
  const login = async id => (await request(app).post('/api/login').send({ usuario_id: id, pin: TEST_PIN }).expect(200)).body.token;
  [owner, manager, employee] = await Promise.all([login(1), login(2), login(3)]);
});
afterEach(() => db.close());

const manageNotice = (id, body, token = manager) => request(app).put(`/api/relevos/${id}/gestion`).set(auth(token)).send(body);
const assignment = { responsable_id: 3, prioridad: 'alta', estado: 'pendiente', revision: 1 };
it('assigns, starts, resolves and reopens with optimistic revision and preserved history', async () => {
  const { id } = (await create('/api/relevos', notice).expect(201)).body;
  await manageNotice(id, assignment).expect(200);
  await manageNotice(id, assignment).expect(200); // identical replay does not duplicate history
  expect(count('relevo_cambios')).toBe(1);
  await manageNotice(id, { ...assignment, responsable_id: 2 }).expect(409);
  await manageNotice(id, { ...assignment, estado: 'en_curso', revision: 2 }, employee).expect(200);
  await manageNotice(id, { ...assignment, estado: 'resuelto', revision: 3 }, employee).expect(403);
  await manageNotice(id, { ...assignment, estado: 'resuelto', revision: 3 }).expect(200);
  let entry = (await workday()).body.relevos[0];
  expect(entry).toMatchObject({ estado: 'resuelto', revision: 4, resuelto_por: 2, lecturas: [] });
  await manageNotice(id, { ...assignment, revision: 4 }).expect(200);
  entry = (await workday()).body.relevos[0];
  expect(entry).toMatchObject({ estado: 'pendiente', revision: 5, resuelto_por: null, resuelto_en: null });
  expect(entry.cambios).toHaveLength(4);
  expect(entry.cambios.some(c => c.detalle.startsWith('Resuelto'))).toBe(true);
});
it('rejects missing, inactive or other-local assignees and unauthorized reassignment', async () => {
  const { id } = (await create('/api/relevos', notice).expect(201)).body;
  await manageNotice(id, assignment, employee).expect(403);
  await manageNotice(id, { ...assignment, responsable_id: 999 }).expect(404);
  db.connection.exec("UPDATE usuarios SET local='Segundo Local' WHERE id=3");
  await manageNotice(id, assignment).expect(400);
  db.connection.exec("UPDATE usuarios SET local='Principal',active=0 WHERE id=3");
  await manageNotice(id, assignment).expect(404);
  await manageNotice(id, { ...assignment, responsable_id: null, estado: 'en_curso' }).expect(400);
  await manageNotice(id, { ...assignment, revision: undefined }).expect(400);
  expect(count('relevo_gestion')).toBe(0);
});
it('reports personal and local counters without acknowledging notices and flags unavailable assignees', async () => {
  const { id } = (await create('/api/relevos', notice).expect(201)).body;
  await manageNotice(id, assignment).expect(200);
  await create('/api/relevos', { ...notice, local: 'Segundo Local' }).expect(201);
  await create('/api/rutinas', routine).expect(201); await prepare();
  const summary = token => request(app).get('/api/relevos/resumen').query(day).set(auth(token));
  expect((await summary(employee).expect(200)).body.locales).toEqual([{ local: 'Principal', pendientes: 1, sin_leer: 1, asignados: 1, sin_responsable: 0, pasos: 2, completados: 0 }]);
  expect(count('relevo_lecturas')).toBe(0);
  await request(app).put(`/api/relevos/${id}/leer`).set(auth(employee)).expect(200);
  expect((await summary(employee)).body.locales[0]).toMatchObject({ pendientes: 1, sin_leer: 0 });
  await request(app).get('/api/relevos/resumen').query({ ...day, local: 'Todos' }).set(auth(employee)).expect(400);
  await request(app).get('/api/relevos/resumen').query({ ...day, local: 'Segundo Local' }).set(auth(employee)).expect(403);
  db.connection.exec('UPDATE usuarios SET active=0 WHERE id=3');
  expect((await summary(manager)).body.locales[0].sin_responsable).toBe(1);
  expect((await workday()).body.relevos[0]).toMatchObject({ responsable_id: 3, responsable_disponible: 0 });
});
it('rolls back assignment, history and resolution when audit persistence fails; rejects revoked sessions', async () => {
  const { id } = (await create('/api/relevos', notice).expect(201)).body;
  db.connection.exec("CREATE TRIGGER fail_management_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test'); END;");
  await manageNotice(id, { ...assignment, estado: 'resuelto' }).expect(500);
  expect(count('relevo_gestion')).toBe(0); expect(count('relevo_cambios')).toBe(0);
  expect((await workday()).body.relevos[0].resuelto_por).toBeNull();
  db.connection.exec('DROP TRIGGER fail_management_audit');
  await request(app).post('/api/logout').set(auth(manager)).expect(204);
  await manageNotice(id, assignment).expect(401);
});

it('creates no tasks or acknowledgements on reads; prepares once under concurrent requests', async () => {
  await create('/api/rutinas', routine).expect(201); await create('/api/relevos', notice).expect(201);
  await workday().expect(200); await workday(employee).expect(200);
  expect(count('tareas')).toBe(0); expect(count('relevo_lecturas')).toBe(0);
  const results = await Promise.all(Array.from({ length: 8 }, () => prepare().expect(200)));
  expect(results.reduce((sum, r) => sum + r.body.creadas, 0)).toBe(2);
  expect(count('rutina_ejecuciones')).toBe(1); expect(count('tareas')).toBe(2);
  const list = (await workday(employee).expect(200)).body;
  expect(list.tareas).toHaveLength(2); expect(list.ejecuciones[0].preparado_por).toBe(2);
  expect((await request(app).get('/api/tareas').set(auth(employee)).expect(200)).body).toHaveLength(2);
});

it('respects recurrence, local and date independently and keeps archived execution history', async () => {
  const first = await create('/api/rutinas', { ...routine, frecuencia: 'laborables' }).expect(201);
  await create('/api/rutinas', { ...routine, local: 'Segundo Local', frecuencia: 'fin_semana' }).expect(201);
  expect((await prepare().expect(200)).body.creadas).toBe(0); // Sunday
  expect((await prepare({ ...day, local: 'Segundo Local' }).expect(200)).body.creadas).toBe(2);
  expect((await prepare({ ...day, fecha: '2026-09-21' }).expect(200)).body.creadas).toBe(2);
  await request(app).put(`/api/rutinas/${first.body.id}/archivar`).set(auth(owner)).expect(200);
  await request(app).put(`/api/rutinas/${first.body.id}/archivar`).set(auth(owner)).expect(200);
  expect((await prepare({ ...day, fecha: '2026-09-22' }).expect(200)).body.creadas).toBe(0);
  expect((await workday(manager, 'Principal', '2026-09-21')).body.tareas).toHaveLength(2);
  expect(count('tareas')).toBe(4);
});

it('enforces employee scope, management privileges and server-side author identity', async () => {
  await create('/api/rutinas', routine, employee).expect(403); await prepare(day, employee).expect(403);
  await workday(employee, 'Segundo Local').expect(403); await workday(employee, 'Todos').expect(400);
  await create('/api/relevos', { ...notice, local: 'Segundo Local' }, employee).expect(403);
  const entry = (await create('/api/relevos', { ...notice, autor_id: 1 }, employee).expect(201)).body;
  expect((await workday()).body.relevos[0].autor_id).toBe(3);
  await request(app).put(`/api/relevos/${entry.id}/resolver`).set(auth(employee)).expect(403);
  const other = (await create('/api/relevos', { ...notice, local: 'Segundo Local' }).expect(201)).body;
  await request(app).put(`/api/relevos/${other.id}/leer`).set(auth(employee)).expect(403);
  await request(app).put('/api/rutinas/1/archivar').set(auth(employee)).expect(403);
});

it('records explicit reading and resolution only once, keeping previous-day notices visible', async () => {
  const { id } = (await create('/api/relevos', notice).expect(201)).body;
  await request(app).put(`/api/relevos/${id}/leer`).set(auth(employee)).expect(200);
  const read = db.connection.prepare('SELECT * FROM relevo_lecturas').get();
  await request(app).put(`/api/relevos/${id}/leer`).set(auth(employee)).expect(200);
  expect(db.connection.prepare('SELECT * FROM relevo_lecturas').all()).toEqual([read]);
  await request(app).put(`/api/relevos/${id}/resolver`).set(auth(manager)).expect(200);
  await request(app).put(`/api/relevos/${id}/resolver`).set(auth(owner)).expect(200);
  const entry = (await workday(employee, 'Principal', '2026-09-21').expect(200)).body.relevos[0];
  expect(entry).toMatchObject({ resuelto_por: 2, autor_id: 2, lecturas: [{ usuario_id: 3 }] });
  expect(db.connection.prepare("SELECT count(*) n FROM audit_events WHERE action IN ('handover.read','handover.resolved')").get().n).toBe(2);
});

it('records task completion, keeps the first completing actor on replay and prevents deleting routine history', async () => {
  await create('/api/rutinas', routine).expect(201); await prepare().expect(200);
  const task = (await workday()).body.tareas[0];
  await request(app).put(`/api/tareas/${task.id}/completada`).set(auth(employee)).send({ completada: true }).expect(200);
  await request(app).put(`/api/tareas/${task.id}/completada`).set(auth(manager)).send({ completada: true }).expect(200);
  expect((await workday()).body.tareas[0]).toMatchObject({ completada: 1, completado_por: 3, completado_nombre: 'María García' });
  await request(app).delete(`/api/tareas/${task.id}`).set(auth(owner)).expect(409);
  await request(app).put(`/api/tareas/${task.id}/completada`).set(auth(employee)).send({ completada: false }).expect(200);
  expect((await workday()).body.tareas[0]).toMatchObject({ completada: 0, completado_por: null, completado_en: null });
  await create('/api/rutinas', { ...routine, local: 'Segundo Local' }).expect(201); await prepare({ ...day, local: 'Segundo Local' });
  const other = (await workday(owner, 'Segundo Local')).body.tareas[0];
  await request(app).put(`/api/tareas/${other.id}/completada`).set(auth(employee)).send({ completada: true }).expect(403);
});

it.each([['/api/rutinas', routine, 'rutinas'], ['/api/relevos', notice, 'relevos']])('deduplicates %s across retries and rejects changed payloads', async (endpoint, body, table) => {
  const key = randomUUID(); const first = await create(endpoint, body, manager, key).expect(201);
  expect((await create(endpoint, body, manager, key).expect(201)).body).toEqual(first.body);
  await create(endpoint, { ...body, local: 'Segundo Local' }, manager, key).expect(409);
  expect(count(table)).toBe(1);
  await request(app).post(endpoint).set(auth(manager)).send(body).expect(400);
  await request(app).post('/api/logout').set(auth(manager)).expect(204);
  await create(endpoint, body, manager, key).expect(401);
});

it.each([['/api/rutinas', routine, 'rutinas'], ['/api/relevos', notice, 'relevos']])('rolls back %s and audits if its receipt fails', async (endpoint, body, table) => {
  db.connection.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON idempotency_requests BEGIN SELECT RAISE(ABORT, 'test'); END;");
  const audits = count('audit_events'); await create(endpoint, body).expect(500);
  expect(count(table)).toBe(0); expect(count('audit_events')).toBe(audits);
});

it('rolls back every generated task and execution on a partial failure', async () => {
  await create('/api/rutinas', routine).expect(201);
  db.connection.exec("CREATE TRIGGER fail_step BEFORE INSERT ON tareas WHEN NEW.titulo = 'Comprobar café' BEGIN SELECT RAISE(ABORT, 'test'); END;");
  await prepare().expect(500); expect(count('tareas')).toBe(0); expect(count('rutina_ejecuciones')).toBe(0);
  db.connection.exec('DROP TRIGGER fail_step'); await prepare().expect(200); expect(count('tareas')).toBe(2);
});

it('validates civil dates, required keys and bounded routines without writing', async () => {
  for (const changes of [{ pasos: [] }, { pasos: [null] }, { pasos: [' '] }, { pasos: Array(31).fill('Paso') }, { fase: 'otra' }, { frecuencia: 'otra' }, { titulo: 42 }, { local: 'Aguacate' }]) await create('/api/rutinas', { ...routine, ...changes }).expect(400);
  for (const changes of [{ fecha: '2026-02-30' }, { contenido: '' }, { contenido: 'a'.repeat(3001) }, { local: 'Ambos' }]) await create('/api/relevos', { ...notice, ...changes }).expect(400);
  await prepare({ ...day, fecha: '2026-02-30' }).expect(400);
  expect(count('rutinas')).toBe(0); expect(count('relevos')).toBe(0);
});
