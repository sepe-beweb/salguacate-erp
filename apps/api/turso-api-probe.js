const assert = require('node:assert/strict');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { createApp } = require('./index');
const { createAsyncStore } = require('./async-store');

// Follow-up ONLY for a disposable compatibility-probe database, never bootstrap
// or migrate an installation. The caller must confirm its exact remote host.
async function runTursoApiProbe(database, onStep = () => {}) {
  const db = createAsyncStore(database);
  const users = await db.all('SELECT nombre, active, pin FROM usuarios');
  if (!users.some(user => user.nombre === 'Synthetic compatibility probe') || users.some(user => user.active || user.pin !== null ||
      !/^Synthetic (compatibility probe|API probe [a-f0-9-]+ (owner|employee))$/.test(user.nombre))) {
    throw new Error('API probe requires an inactive synthetic compatibility database, without real users or PINs.');
  }
  assert.deepEqual((await db.all('SELECT version FROM schema_migrations ORDER BY version')).map(row => row.version), [1, 2, 3]);
  const run = randomUUID();
  const names = [`Synthetic API probe ${run} owner`, `Synthetic API probe ${run} employee`];
  const tokens = names.map(() => randomBytes(32).toString('hex'));
  const hashes = tokens.map(token => createHash('sha256').update(token).digest('hex'));
  let server;
  const timings = [];
  const timed = async (check, work) => {
    onStep({ check, status: 'running' }); const start = performance.now();
    await work(); const result = { check, milliseconds: Math.round(performance.now() - start) };
    timings.push(result); onStep({ ...result, status: 'passed' });
  };
  try {
    // No PIN and no login-capable sample accounts. Short-lived synthetic sessions
    // are held in process memory and used only by the loopback HTTP client.
    await db.transaction(async sql => {
      for (let index = 0; index < names.length; index++) {
        const user = await sql.prepare('INSERT INTO usuarios (nombre, rol, local, pin, active, must_change_pin) VALUES (?, ?, ?, NULL, 1, 0)').run(names[index], index ? 'employee' : 'owner', 'Principal');
        await sql.prepare('INSERT INTO sessions VALUES (?, ?, 1, ?)').run(hashes[index], user.lastInsertRowid, Date.now() + 10 * 60 * 1000);
      }
    });
    server = createApp({ db }).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function call(method, path, body, expected, actor = 0, key) {
      const headers = { Authorization: `Bearer ${tokens[actor]}` };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (key) headers['Idempotency-Key'] = key;
      const response = await fetch(origin + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, expected, `Unexpected HTTP status for ${method} ${path}`);
      return response.status === 204 ? null : response.json();
    }
    await timed('http-health-and-all-lists', async () => {
      assert.equal((await call('GET', '/api/health', undefined, 200)).status, 'ready');
      for (const endpoint of ['usuarios', 'inventario', 'inventario/alertas', 'proveedores', 'pedidos', 'cierres', 'gastos', 'notas', 'eventos', 'tareas', 'turnos', 'peticiones', 'mensajes', 'fichajes/presencia']) {
        assert.ok(Array.isArray(await call('GET', `/api/${endpoint}`, undefined, 200)));
      }
      assert.ok(Array.isArray(await call('GET', '/api/tareas', undefined, 200, 1)));
      await call('GET', '/api/usuarios', undefined, 403, 1);
    });
    await timed('http-expense-duplicate-receipts', async () => {
      const key = randomUUID();
      const body = { fecha: '2026-09-19', local: 'Principal', proveedor_nombre: `Synthetic ${run}`, total: 12.50 };
      const results = await Promise.all(Array.from({ length: 8 }, () => call('POST', '/api/gastos', body, 201, 0, key)));
      assert.equal(new Set(results.map(result => result.id)).size, 1);
      assert.deepEqual(await call('POST', '/api/gastos', body, 201, 0, key), results[0]);
      await call('POST', '/api/gastos', { ...body, total: 13 }, 409, 0, key);
    });
    await timed('http-note-create-pin-delete', async () => {
      const key = randomUUID(); const body = { contenido: `Synthetic ${run}`, color: 'yellow' };
      const note = await call('POST', '/api/notas', body, 200, 0, key);
      assert.deepEqual(await call('POST', '/api/notas', body, 200, 0, key), note);
      await call('PATCH', `/api/notas/${note.id}/fijada`, { fijada: true }, 200);
      await call('DELETE', `/api/notas/${note.id}`, undefined, 200);
    });
    await timed('http-catalog-and-500-line-reception', async () => {
      const supplier = await call('POST', '/api/proveedores', { nombre: `Synthetic ${run}` }, 200);
      const product = await call('POST', '/api/inventario', { producto: `Synthetic ${run}`, local: 'Principal', stock_actual: 10, proveedor_id: supplier.id }, 200);
      const products = Array.from({ length: 500 }, () => ({ producto_id: product.id, nombre: 'Synthetic', cantidad: 1 }));
      const order = await call('POST', '/api/pedidos', { fecha: '2026-09-19', local: 'Principal', proveedor_id: supplier.id, productos: products }, 200);
      await call('PATCH', `/api/pedidos/${order.id}/recibido`, { sumar_stock: true }, 200);
      await call('PATCH', `/api/pedidos/${order.id}/recibido`, { sumar_stock: true }, 409);
      assert.equal((await db.get('SELECT stock_actual FROM inventario WHERE id = ?', [product.id])).stock_actual, 510);
    });
    await timed('http-employee-clock-and-task', async () => {
      for (const tipo of ['entrada', 'descanso', 'volver', 'salida']) await call('POST', '/api/fichar', { tipo }, 200, 1);
      await call('POST', '/api/fichar', { tipo: 'salida' }, 400, 1);
      const task = await call('POST', '/api/tareas', { titulo: `Synthetic ${run}`, fecha: '2026-09-19', local: 'Principal' }, 200);
      await call('PUT', `/api/tareas/${task.id}/completada`, { completada: true }, 200, 1);
      await call('DELETE', `/api/tareas/${task.id}`, undefined, 403, 1);
      await call('DELETE', `/api/tareas/${task.id}`, undefined, 200);
    });
    await timed('http-session-revocation', async () => {
      await call('POST', '/api/logout', undefined, 204, 1);
      await call('GET', '/api/tareas', undefined, 401, 1);
    });
    assert.deepEqual(await db.all('PRAGMA foreign_key_check'), []);
  } finally {
    if (server) await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); });
    // Exact run-owned rows only, even if the initial COMMIT acknowledgement was
    // lost. Retain business evidence, deactivate fixtures and revoke sessions.
    await db.transaction(async sql => {
      await sql.prepare('DELETE FROM sessions WHERE token_hash IN (?, ?)').run(...hashes);
      await sql.prepare('UPDATE usuarios SET active = 0, auth_version = auth_version + 1 WHERE nombre IN (?, ?) AND pin IS NULL').run(...names);
    });
    tokens.fill('');
  }
  assert.equal((await db.get('SELECT count(*) n FROM usuarios WHERE active = 1')).n, 0);
  assert.equal((await db.get('SELECT count(*) n FROM sessions')).n, 0);
  return { status: 'passed', scope: 'loopback-api-with-disposable-database', syntheticUsersDeactivated: true, syntheticSessionsRevoked: true, syntheticBusinessDataRetained: true, timings };
}

module.exports = { runTursoApiProbe };
