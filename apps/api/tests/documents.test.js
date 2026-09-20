import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const { createDatabase } = require('../database');
const { createApp } = require('../index');
const { createBackup, restoreBackup, verifyBackup } = require('../recovery');
const { createDocumentStore, decodeDocument, digest } = require('../document-store');
const { unzipSync, strFromU8 } = require('fflate');
const { seedTestUsers, TEST_PIN } = require('../../../tests/fixtures/users.cjs');
let db, app, dir, owner, manager, employee;
const auth = token => ({ Authorization: `Bearer ${token}` });
const pdf = Buffer.from('%PDF-1.4\n% synthetic fixture\n%%EOF');
const body = (overrides = {}) => ({ local: 'Principal', titulo: 'Factura de prueba', fecha: '2026-09-20', tipo: 'factura_proveedor', etiquetas: ['Pagado', 'suministros', 'pagado'], notas: 'Compra semanal', proveedor_id: 1, archivo: { nombre: 'factura.pdf', mime: 'application/pdf', base64: pdf.toString('base64') }, ...overrides });
const post = (data = body(), token = manager, key = randomUUID()) => request(app).post('/api/documentos').set(auth(token)).set('Idempotency-Key', key).send(data);
const get = (id, token = manager) => request(app).get(`/api/documentos/${id}`).set(auth(token));
const list = (query = {}, token = manager) => request(app).get('/api/documentos').query(query).set(auth(token));
const count = name => db.connection.prepare(`SELECT count(*) n FROM ${name}`).get().n;
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salguacate-documents-'));
  db = createDatabase(path.join(dir, 'source.sqlite')); await db.ready; await seedTestUsers(db);
  db.connection.exec("INSERT INTO proveedores (nombre) VALUES ('Pan de prueba')");
  app = createApp({ db, uploadsDir: path.join(dir, 'uploads'), documentsDir: path.join(dir, 'documents') });
  const login = async id => (await request(app).post('/api/login').send({ usuario_id: id, pin: TEST_PIN }).expect(200)).body.token;
  [owner, manager, employee] = await Promise.all([login(1), login(2), login(3)]);
});
afterEach(() => { db?.close(); db = null; fs.rmSync(dir, { recursive: true, force: true }); });

it('persists a private file, strict classification and history without creating an expense', async () => {
  const { id } = (await post().expect(201)).body;
  const doc = (await get(id).expect(200)).body;
  expect(doc).toMatchObject({ titulo: 'Factura de prueba', etiquetas: ['pagado', 'suministros'], autor_id: 2, proveedor_nombre: 'Pan de prueba', gasto_id: null, revision: 1 });
  expect(doc.cambios).toHaveLength(1); expect(doc.sha256).toBeUndefined(); expect(doc.request_key).toBeUndefined();
  expect(count('gastos')).toBe(0);
  const file = await request(app).get(`/api/documentos/${id}/archivo`).set(auth(manager)).expect(200);
  expect(file.body).toEqual(pdf); expect(file.headers['content-disposition']).toContain('attachment'); expect(file.headers['cache-control']).toBe('private, no-store');
  await request(app).get(`/uploads/${digest(pdf)}`).expect(404);
  await request(app).get(`/documents/${digest(pdf)}`).expect(404);
  expect(fs.readdirSync(path.join(dir, 'documents'))).toEqual([digest(pdf)]);
});
it('isolates managers by local on every read and mutation, denies staff and anonymous access', async () => {
  const { id } = (await post(body({ local: 'Segundo Local' }), owner).expect(201)).body;
  for (const suffix of ['', '/archivo']) { await request(app).get(`/api/documentos/${id}${suffix}`).set(auth(manager)).expect(403); await request(app).get(`/api/documentos/${id}${suffix}`).expect(401); }
  await list({ local: 'Todos' }).expect(403); await list({ local: 'Segundo Local' }).expect(403);
  expect((await list().expect(200)).body.total).toBe(0); expect((await list({}, owner)).body.total).toBe(1);
  await post(body({ local: 'Segundo Local' })).expect(403); await post(body(), employee).expect(403); await list({}, employee).expect(403);
  await request(app).put(`/api/documentos/${id}`).set(auth(manager)).send({ ...body(), revision: 1, archivado: 0 }).expect(403);
  await request(app).put(`/api/documentos/${id}/gasto`).set(auth(manager)).send({ gasto_id: null, revision: 1 }).expect(403);
  await request(app).post(`/api/documentos/${id}/gasto`).set(auth(manager)).send({ fecha: '2026-09-20', proveedor_nombre: 'Test', concepto: 'Test', total: 4, revision: 1 }).expect(403);
});
it('deduplicates concurrent and uncertain upload retries and rejects changed fingerprints', async () => {
  const key = randomUUID(); const results = await Promise.all([post(body(), manager, key).expect(201), post(body(), manager, key).expect(201)]);
  expect(results[0].body.id).toBe(results[1].body.id); expect(count('documentos')).toBe(1); expect(count('documento_cambios')).toBe(1);
  await post(body({ titulo: 'Otro' }), manager, key).expect(409);
  await post().expect(409); await post(body(), owner).expect(409);
  await post(body({ local: 'Segundo Local' }), owner).expect(201); // separate business classification, shared immutable bytes
  expect(fs.readdirSync(path.join(dir, 'documents'))).toHaveLength(1);
});
it('rejects invalid types, tags, filename, signature, active PDF, IDs and filters', async () => {
  for (const changes of [{ tipo: 'inventado' }, { fecha: '2026-02-30' }, { proveedor_id: 999 }, { etiquetas: [''] }, { etiquetas: Array(13).fill('a') }, { local: 'Todos' }, { archivo: { nombre: '../x.pdf', mime: 'application/pdf', base64: pdf.toString('base64') } }, { archivo: { nombre: 'x.pdf', mime: 'application/pdf', base64: Buffer.from('not pdf').toString('base64') } }]) await post(body(changes)).expect(400);
  expect(() => decodeDocument({ nombre: 'x.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-1.4\n/JavaScript\n%%EOF').toString('base64') })).toThrow(/PDF/);
  expect(() => decodeDocument({ nombre: 'x.pdf', mime: 'application/pdf', base64: pdf.toString('base64') + '\n' })).toThrow();
  for (const q of [{ pagina: 0 }, { desde: 'bad' }, { desde: '2026-09-20', hasta: '2026-09-19' }, { proveedor: -1 }, { q: ['a', 'b'] }]) await list(q).expect(400);
  await get('no-id').expect(400); await get(999).expect(404); expect(count('documentos')).toBe(0);
  expect(fs.existsSync(path.join(dir, 'documents')) ? fs.readdirSync(path.join(dir, 'documents')) : []).toEqual([]);
});
it('filters title, type, provider, dates, exact tags and archived state; protects revisions', async () => {
  const { id } = (await post().expect(201)).body;
  expect((await list({ q: 'Compra', tipo: 'factura_proveedor', proveedor: 1, desde: '2026-09-20', hasta: '2026-09-20', etiqueta: 'PAGADO' })).body.total).toBe(1);
  for (const q of [{ q: '%' }, { q: '_' }, { etiqueta: 'paga' }, { tipo: 'ticket' }, { desde: '2026-09-21' }]) expect((await list(q)).body.total).toBe(0);
  await request(app).put(`/api/documentos/${id}`).set(auth(manager)).send({ ...body(), titulo: 'Factura revisada', revision: 1, archivado: 1 }).expect(200);
  await request(app).put(`/api/documentos/${id}`).set(auth(manager)).send({ ...body(), revision: 1, archivado: 0 }).expect(409);
  expect((await list()).body.total).toBe(0); expect((await list({ estado: 'archivados' })).body.total).toBe(1);
  expect((await get(id)).body.cambios).toHaveLength(2);
  await request(app).put(`/api/documentos/${id}`).set(auth(manager)).send({ ...body(), revision: 2, archivado: 0 }).expect(200);
  expect((await list()).body.total).toBe(1);
});
it('links only same-local expenses and creates an expense exactly once with atomic history', async () => {
  const { id } = (await post().expect(201)).body;
  db.connection.exec("INSERT INTO gastos (fecha,local,proveedor_nombre,total,concepto) VALUES ('2026-09-20','Segundo Local','Otro',9,'Otro')");
  await request(app).put(`/api/documentos/${id}/gasto`).set(auth(manager)).send({ gasto_id: 1, revision: 1 }).expect(400);
  const expense = { fecha: '2026-09-20', proveedor_nombre: 'Pan de prueba', concepto: 'Compra', total: 12.35, revision: 1 };
  const create = data => request(app).post(`/api/documentos/${id}/gasto`).set(auth(manager)).send(data);
  const results = await Promise.all([create(expense).expect(201), create(expense).expect(201)]);
  expect(results[0].body.id).toBe(results[1].body.id); expect(count('gastos')).toBe(2); expect(count('documento_cambios')).toBe(2);
  await create({ ...expense, total: 99 }).expect(409);
  expect((await list({ gasto: results[0].body.id })).body.total).toBe(1);
  expect((await list({ vinculo: 'con_gasto' })).body.total).toBe(1);
  expect((await list({ vinculo: 'sin_gasto' })).body.total).toBe(0);
  await list({ vinculo: 'invalid' }).expect(400);
  await request(app).put(`/api/documentos/${id}`).set(auth(owner)).send({ ...body({ local: 'Segundo Local' }), revision: 2, archivado: 0 }).expect(409);
  await request(app).put(`/api/documentos/${id}/gasto`).set(auth(manager)).send({ gasto_id: null, revision: 2 }).expect(200);
  await create(expense).expect(409); // old receipt cannot recreate an unlinked expense
  await request(app).put(`/api/documentos/${id}/gasto`).set(auth(manager)).send({ gasto_id: results[0].body.id, revision: 3 }).expect(200);
  expect(count('gastos')).toBe(2);
});
it('rolls back metadata, expense and history on audit failure; rejects revoked sessions', async () => {
  const { id } = (await post().expect(201)).body;
  db.connection.exec("CREATE TRIGGER fail_document_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test'); END");
  await request(app).post(`/api/documentos/${id}/gasto`).set(auth(manager)).send({ fecha: '2026-09-20', proveedor_nombre: 'Test', concepto: 'Test', total: 5, revision: 1 }).expect(500);
  expect(count('gastos')).toBe(0); expect((await get(id)).body.gasto_id).toBeNull(); expect(count('documento_cambios')).toBe(1);
  await post(body({ local: 'Segundo Local' }), owner).expect(500); expect(count('documentos')).toBe(1);
  db.connection.exec('DROP TRIGGER fail_document_audit');
  await request(app).post('/api/logout').set(auth(manager)).expect(204); await get(id).expect(401);
});
it('refuses missing or altered files and storage within the public directory', async () => {
  const { id } = (await post().expect(201)).body;
  fs.writeFileSync(path.join(dir, 'documents', digest(pdf)), 'damaged');
  await request(app).get(`/api/documentos/${id}/archivo`).set(auth(owner)).expect(503);
  expect(() => createDocumentStore(path.join(dir, 'uploads', 'private'), path.join(dir, 'uploads'))).toThrow(/separate/);
  const disabled = createApp({ db }); await request(disabled).get('/api/documentos').set(auth(owner)).expect(503);
});
it('includes originals and history in a verified restoration and refuses incomplete backups', async () => {
  const { id } = (await post().expect(201)).body;
  const options = { database: path.join(dir, 'source.sqlite'), uploads: path.join(dir, 'uploads'), output: path.join(dir, 'backup'), offline: true };
  await expect(createBackup(options)).rejects.toThrow(/documents/);
  await createBackup({ ...options, documents: path.join(dir, 'documents') });
  expect(verifyBackup(options.output).files.map(f => f.path)).toContain(`documents/${digest(pdf)}`);
  const restoredDir = path.join(dir, 'restored'); const report = await restoreBackup({ source: options.output, output: restoredDir, offline: true });
  expect(report.tables.documentos.count).toBe(1); expect(report.tables.documento_cambios.count).toBe(1);
  const copy = createDatabase(path.join(restoredDir, 'database.sqlite')); await copy.ready;
  try { expect(copy.connection.prepare('SELECT id FROM documentos').get().id).toBe(id); expect(fs.readFileSync(path.join(restoredDir, 'documents', digest(pdf)))).toEqual(pdf); }
  finally { copy.close(); }
  fs.writeFileSync(path.join(options.output, 'documents', digest(pdf)), 'altered'); expect(() => verifyBackup(options.output)).toThrow(/alterado/);
});
it('migrates a version-four copy without changing its source or business rows', async () => {
  db.connection.exec('DROP TABLE documento_cambios; DROP TABLE documentos; DELETE FROM schema_migrations WHERE version>=5');
  const users = db.connection.prepare('SELECT id,nombre,rol,local FROM usuarios').all(); db.close(); db = null;
  const source = path.join(dir, 'source.sqlite'); const bytes = fs.readFileSync(source); const target = path.join(dir, 'v5.sqlite'); fs.copyFileSync(source, target);
  const migrated = createDatabase(target); await migrated.ready;
  try { expect(migrated.connection.prepare('SELECT id,nombre,rol,local FROM usuarios').all()).toEqual(users); expect(migrated.connection.prepare('SELECT count(*) n FROM documentos').get().n).toBe(0); expect(migrated.connection.prepare('PRAGMA foreign_key_check').all()).toEqual([]); }
  finally { migrated.close(); }
  expect(fs.readFileSync(source)).toEqual(bytes);
});
it('paginates a full archive without losing totals and rejects uploads beyond the private quota', async () => {
  for (let i = 0; i < 26; i++) await post(body({ titulo: `Factura ${i}`, archivo: { nombre: `f${i}.pdf`, mime: 'application/pdf', base64: Buffer.from(`%PDF-1.4\n% ${i}\n%%EOF`).toString('base64') } })).expect(201);
  const first = (await list()).body; const second = (await list({ pagina: 2 })).body;
  expect(first.total).toBe(26); expect(first.items).toHaveLength(24); expect(second.items).toHaveLength(2);
  const beyond = (await list({ pagina: 99 })).body;
  expect(beyond.pagina).toBe(2); expect(beyond.items).toEqual(second.items);
  expect(new Set([...first.items, ...second.items].map(d => d.id)).size).toBe(26);
  const quotaFile = path.join(dir, 'documents', 'a'.repeat(64)); const handle = fs.openSync(quotaFile, 'wx'); fs.ftruncateSync(handle, 250 * 1024 * 1024); fs.closeSync(handle);
  await post().expect(413); expect(count('documentos')).toBe(26);
});

const reviewBody = (overrides = {}) => ({ estado: 'en_revision', responsable_id: 2, fecha_limite: '2026-09-19', observaciones: 'Comprobar el importe', revision: 1, ...overrides });
const reviewDoc = (id, body, token = manager) => request(app).put(`/api/documentos/${id}/revision`).set(auth(token)).send(body);
const preview = (query = {}, token = manager) => request(app).get('/api/documentos/paquete').set(auth(token)).query({ local: 'Principal', mes: '2026-09', ...query });
const download = (selection, token = manager) => request(app).post('/api/documentos/paquete').set(auth(token)).send(selection).buffer(true).parse((res, callback) => { const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => callback(null, Buffer.concat(chunks))); });

it('assigns review to eligible managers, filters pending work and records completion without changing expenses', async () => {
  const { id } = (await post().expect(201)).body;
  await reviewDoc(id, reviewBody()).expect(200);
  let doc = (await get(id)).body;
  expect(doc).toMatchObject({ revision_estado: 'en_revision', revision_responsable_id: 2, revision_fecha_limite: '2026-09-19', revision: 2, revisado_por: null });
  const board = (await list({ hoy: '2026-09-20', vencidos: '1', responsable: 'mios' })).body;
  expect(board.total).toBe(1); expect(board.resumen).toEqual({ activos: 1, pendientes: 0, en_revision: 1, revisados: 0, vencidos: 1, sin_asignar: 0 });
  await reviewDoc(id, reviewBody({ estado: 'revisado', revision: 2 })).expect(200);
  doc = (await get(id)).body;
  expect(doc).toMatchObject({ revision_estado: 'revisado', revisado_por: 2, revision: 3 }); expect(doc.revisado_en).toMatch(/^\d{4}-/); expect(doc.cambios).toHaveLength(3);
  expect((await list({ vencidos: '1', hoy: '2026-09-20' })).body.total).toBe(0);
  expect(count('gastos')).toBe(0);
  await reviewDoc(id, reviewBody({ revision: 2 })).expect(409);
});
it('denies review assignment to employees, inactive and other-local managers; preserves revision on failures', async () => {
  const { id } = (await post().expect(201)).body;
  db.connection.exec("INSERT INTO usuarios(nombre,rol,local,pin) VALUES ('Otro encargado','manager','Segundo Local','disabled')");
  for (const responsible of [3, 5, 999]) await reviewDoc(id, reviewBody({ responsable_id: responsible })).expect(400);
  await reviewDoc(id, reviewBody(), employee).expect(403);
  const foreign = (await post(body({ local: 'Segundo Local' }), owner)).body.id;
  await reviewDoc(foreign, reviewBody()).expect(403);
  await reviewDoc(id, reviewBody({ fecha_limite: '2026-02-30' })).expect(400);
  db.connection.exec('UPDATE usuarios SET active=0 WHERE id=2');
  await reviewDoc(id, reviewBody(), owner).expect(400);
  const candidates = (await request(app).get('/api/documentos/responsables').set(auth(owner)).expect(200)).body;
  expect(candidates.map(r => r.id)).toEqual([1, 5]); expect(candidates.every(r => r.pin === undefined)).toBe(true);
  expect((await get(id, owner)).body.revision).toBe(1);
});
it('reopens completed review when classification or expense changes and clears an assignee on a local move', async () => {
  const { id } = (await post().expect(201)).body;
  await reviewDoc(id, reviewBody({ estado: 'revisado' })).expect(200);
  await request(app).put(`/api/documentos/${id}`).set(auth(manager)).send({ ...body(), titulo: 'Corregida', revision: 2, archivado: 0 }).expect(200);
  expect((await get(id)).body).toMatchObject({ revision_estado: 'pendiente', revisado_por: null, revisado_en: null });
  await reviewDoc(id, reviewBody({ estado: 'revisado', revision: 3 })).expect(200);
  db.connection.exec("INSERT INTO gastos(fecha,local,proveedor_nombre,total,concepto) VALUES ('2026-09-20','Principal','Pan',9,'Test')");
  await request(app).put(`/api/documentos/${id}/gasto`).set(auth(manager)).send({ gasto_id: 1, revision: 4 }).expect(200);
  expect((await get(id)).body.revision_estado).toBe('pendiente');
  await request(app).put(`/api/documentos/${id}/gasto`).set(auth(manager)).send({ gasto_id: null, revision: 5 }).expect(200);
  await request(app).put(`/api/documentos/${id}`).set(auth(owner)).send({ ...body({ local: 'Segundo Local' }), revision: 6, archivado: 0 }).expect(200);
  expect((await get(id, owner)).body).toMatchObject({ revision_estado: 'pendiente', revision_responsable_id: null });
  expect(count('gastos')).toBe(1);
});
it('keeps completed review when only archiving, blocks archived edits and rolls review back with audit failure', async () => {
  const { id } = (await post().expect(201)).body;
  await reviewDoc(id, reviewBody({ estado: 'revisado' })).expect(200);
  const canonical = (await get(id)).body;
  await request(app).put(`/api/documentos/${id}`).set(auth(manager)).send({ ...canonical, archivado: 1 }).expect(200);
  expect((await get(id)).body.revision_estado).toBe('revisado');
  await reviewDoc(id, reviewBody({ revision: 3 })).expect(409);
  await request(app).put(`/api/documentos/${id}`).set(auth(manager)).send({ ...canonical, revision: 3, archivado: 0 }).expect(200);
  db.connection.exec("CREATE TRIGGER fail_review_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test'); END");
  await reviewDoc(id, reviewBody({ revision: 4 })).expect(500);
  expect((await get(id)).body).toMatchObject({ revision_estado: 'revisado', revision: 4 });
});
it('exports a consistent private ZIP with escaped index, logical paths and byte-identical originals', async () => {
  const title = '<script>alert(1)</script> Factura';
  const { id } = (await post(body({ titulo: title })).expect(201)).body;
  expect((await preview()).body.total).toBe(0);
  await reviewDoc(id, reviewBody({ estado: 'revisado' })).expect(200);
  const selected = (await preview().expect(200)).body;
  const result = await download(selected).expect(200);
  expect(result.headers['cache-control']).toBe('private, no-store'); expect(result.headers['content-disposition']).toContain('.zip');
  const entries = unzipSync(result.body); const filePath = `Aguacate/2026-09/factura_proveedor/documento-${String(id).padStart(6, '0')}.pdf`;
  expect(Buffer.from(entries[filePath])).toEqual(pdf);
  expect(strFromU8(entries['indice.html'])).toContain('&lt;script&gt;'); expect(strFromU8(entries['indice.html'])).not.toContain('<script>');
  const index = JSON.parse(strFromU8(entries['indice.json'])); expect(index.documentos[0].sha256).toBe(digest(pdf)); expect(index.documentos[0].titulo).toBe(title);
  expect(count('gastos')).toBe(0); expect((await get(id)).body.revision).toBe(2);
});
it('rejects stale package previews, missing originals and unauthorized scopes without returning partial ZIPs', async () => {
  const { id } = (await post().expect(201)).body;
  const selected = (await preview({ incluir_pendientes: '1' }).expect(200)).body;
  await preview({ local: 'Todos' }).expect(403); await preview({ local: 'Segundo Local' }).expect(403); await preview({}, employee).expect(403);
  await preview({ mes: '2026-13' }).expect(400);
  await request(app).post('/api/documentos/paquete').send(selected).expect(401);
  await download({ ...selected, local: 'Segundo Local' }).expect(403);
  await reviewDoc(id, reviewBody()).expect(200); await download(selected).expect(409);
  const fresh = (await preview({ incluir_pendientes: '1' })).body;
  fs.writeFileSync(path.join(dir, 'documents', digest(pdf)), 'altered'); await download(fresh).expect(503);
  expect(count('documentos')).toBe(1);
});
it('excludes archived and other-month documents and rejects oversized packages before reading originals', async () => {
  const { id } = (await post().expect(201)).body;
  await request(app).put(`/api/documentos/${id}`).set(auth(manager)).send({ ...body(), archivado: 1, revision: 1 }).expect(200);
  expect((await preview({ incluir_pendientes: '1' })).body.total).toBe(0);
  await request(app).put(`/api/documentos/${id}`).set(auth(manager)).send({ ...body(), archivado: 0, revision: 2 }).expect(200);
  expect((await preview({ incluir_pendientes: '1', mes: '2026-08' })).body.total).toBe(0);
  db.connection.prepare('UPDATE documentos SET bytes=? WHERE id=?').run(51 * 1024 * 1024, id);
  await preview({ incluir_pendientes: '1' }).expect(413);
});
it('migrates a version-five copy preserving document history and defaults review to pending', async () => {
  await post().expect(201);
  db.connection.exec('DROP INDEX documentos_revision');
  for (const column of ['revisado_en', 'revisado_por', 'revision_notas', 'revision_fecha_limite', 'revision_responsable_id', 'revision_estado']) db.connection.exec(`ALTER TABLE documentos DROP COLUMN ${column}`);
  db.connection.exec('DELETE FROM schema_migrations WHERE version=6');
  const original = db.connection.prepare('SELECT * FROM documentos').all(); const history = db.connection.prepare('SELECT * FROM documento_cambios').all(); db.close(); db = null;
  const source = path.join(dir, 'source.sqlite'); const before = fs.readFileSync(source); const target = path.join(dir, 'v6.sqlite'); fs.copyFileSync(source, target);
  const copy = createDatabase(target); await copy.ready;
  try { const migrated = copy.connection.prepare('SELECT * FROM documentos').all(); expect(migrated[0]).toMatchObject(original[0]); expect(migrated[0]).toMatchObject({ revision_estado: 'pendiente', revision_responsable_id: null, revisado_en: null }); expect(copy.connection.prepare('SELECT * FROM documento_cambios').all()).toEqual(history); }
  finally { copy.close(); }
  expect(fs.readFileSync(source)).toEqual(before);
});
it.each(['classification', 'authorization'])('rechecks %s after reading originals and returns no ZIP when it changed', async kind => {
  const { id } = (await post().expect(201)).body;
  const selected = (await preview({ incluir_pendientes: '1' })).body;
  const originalRead = fs.promises.readFile.bind(fs.promises);
  const spy = vi.spyOn(fs.promises, 'readFile').mockImplementation(async (...args) => {
    const bytes = await originalRead(...args);
    if (String(args[0]) === path.join(dir, 'documents', digest(pdf))) {
      if (kind === 'classification') db.connection.prepare('UPDATE documentos SET titulo=? WHERE id=?').run('Changed while preparing', id);
      else db.connection.exec('UPDATE usuarios SET auth_version=auth_version+1 WHERE id=2');
    }
    return bytes;
  });
  try {
    const result = await download(selected).expect(kind === 'classification' ? 409 : 401);
    expect(result.headers['content-type']).not.toContain('zip'); expect(count('gastos')).toBe(0);
  } finally { spy.mockRestore(); }
});
it('serializes ZIP preparation and releases the guard after completion', async () => {
  await post().expect(201); const selected = (await preview({ incluir_pendientes: '1' })).body;
  let release; let entered;
  const gate = new Promise(resolve => { release = resolve; }); const reading = new Promise(resolve => { entered = resolve; });
  const originalRead = fs.promises.readFile.bind(fs.promises);
  const spy = vi.spyOn(fs.promises, 'readFile').mockImplementation(async (...args) => {
    if (String(args[0]) === path.join(dir, 'documents', digest(pdf))) { entered(); await gate; }
    return originalRead(...args);
  });
  const first = download(selected).then(r => r);
  try { await reading; await download(selected).expect(429); }
  finally { release(); spy.mockRestore(); }
  expect((await first).status).toBe(200); await download(selected).expect(200);
});
