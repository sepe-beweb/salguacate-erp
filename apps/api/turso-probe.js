const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createDatabase } = require('./database');

async function freshSchemaStatements() {
  // Derive the fresh schema from the authoritative migrations, not a second schema.
  const local = createDatabase(':memory:');
  try {
    await local.ready;
    return [
      ...local.connection.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, rowid").all().map(row => row.sql),
      ...local.connection.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all().map(row => ({
        sql: 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', args: [row.version, row.applied_at],
      })),
    ];
  } finally { local.close(); }
}

async function runTursoProbe(db) {
  const schema = await freshSchemaStatements();
  const timings = [];
  const timed = async (name, work) => {
    const start = performance.now();
    const value = await work();
    timings.push({ check: name, milliseconds: Math.round(performance.now() - start) });
    return value;
  };
  const assertEqual = (actual, expected, message) => assert.deepEqual(actual, expected, message);
  await timed('fresh-schema', () => db.transaction(async tx => {
    const existing = await tx.all("SELECT name FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'");
    if (existing.length) throw new Error('Probe requires an empty disposable database. Existing objects were not changed.');
    const fk = await tx.get('PRAGMA foreign_keys');
    assertEqual(fk?.foreign_keys, 1, 'Foreign-key enforcement must already be enabled by the remote service.');
    await tx.batch(schema);
    assertEqual(await tx.all('PRAGMA foreign_key_check'), [], 'Fresh schema has invalid references.');
  }));

  // Fixtures are synthetic, inactive and have no PIN. They can never sign in.
  const actor = await timed('synthetic-fixtures', () => db.transaction(async tx => {
    const user = await tx.run("INSERT INTO usuarios (nombre, rol, active, pin) VALUES ('Synthetic compatibility probe', 'employee', 0, NULL)");
    await tx.run("INSERT INTO inventario (producto, local, stock_actual) VALUES ('Synthetic item', 'Principal', 10)");
    return user.lastInsertRowid;
  }));
  const item = await db.get('SELECT id FROM inventario');
  const rollback = new Error('Deliberate rollback');
  await timed('rollback-business-audit-receipt', async () => {
    await assert.rejects(db.transaction(async tx => {
      await tx.run('UPDATE inventario SET stock_actual = stock_actual + 5 WHERE id = ?', [item.id]);
      await tx.run("INSERT INTO audit_events (actor_id, action) VALUES (?, 'probe.rollback')", [actor]);
      await tx.run("INSERT INTO idempotency_requests (actor_id, operation, request_key, request_hash, status, response_json) VALUES (?, 'expense.create', 'rollback', 'synthetic', 201, '{}')", [actor]);
      throw rollback;
    }), error => error === rollback);
    assertEqual((await db.get('SELECT stock_actual FROM inventario WHERE id = ?', [item.id])).stock_actual, 10);
    assertEqual((await db.get('SELECT count(*) n FROM audit_events')).n, 0);
    assertEqual((await db.get('SELECT count(*) n FROM idempotency_requests')).n, 0);
  });

  await timed('foreign-key-rejection', async () => {
    let rejected = false;
    await db.transaction(async tx => {
      try { await tx.run("INSERT INTO notas (usuario_id, contenido) VALUES (-1, 'invalid reference')"); }
      catch (error) { if (!/foreign key|constraint/i.test(error.message)) throw error; rejected = true; }
      assertEqual(rejected, true, 'Orphan insert must fail.');
      throw rollback;
    }).catch(error => { if (error !== rollback) throw error; });
    assertEqual((await db.get('SELECT count(*) n FROM notas')).n, 0);
  });

  const createExpense = () => db.transaction(async tx => {
    const receipt = await tx.get("SELECT response_json FROM idempotency_requests WHERE actor_id = ? AND operation = 'expense.create' AND request_key = 'duplicate'", [actor]);
    if (receipt) return JSON.parse(receipt.response_json);
    const result = await tx.run("INSERT INTO gastos (fecha, proveedor_nombre, total, local) VALUES ('2026-01-01', 'Synthetic supplier', 12.50, 'Principal')");
    const body = { id: result.lastInsertRowid };
    await tx.batch([
      { sql: "INSERT INTO audit_events (actor_id, action, entity_id) VALUES (?, 'probe.expense', ?)", args: [actor, String(body.id)] },
      { sql: "INSERT INTO idempotency_requests (actor_id, operation, request_key, request_hash, status, response_json) VALUES (?, 'expense.create', 'duplicate', 'synthetic', 201, ?)", args: [actor, JSON.stringify(body)] },
    ]);
    return body;
  });
  await timed('concurrent-duplicates-single-instance', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, createExpense));
    assertEqual(new Set(results.map(result => result.id)).size, 1);
    assertEqual((await db.get('SELECT count(*) n FROM gastos')).n, 1);
    assertEqual((await db.get('SELECT count(*) n FROM audit_events')).n, 1);
    assertEqual((await db.get('SELECT count(*) n FROM idempotency_requests')).n, 1);
  });
  await timed('receipt-after-discarded-response', async () => {
    // Discarding a successful result models a caller that has lost its receipt,
    // not an actual network cut during COMMIT. The adapter has separate tests for that.
    await createExpense();
    const replay = await createExpense();
    assertEqual(replay.id, (await db.get('SELECT id FROM gastos')).id);
    assertEqual((await db.get('SELECT count(*) n FROM gastos')).n, 1);
  });

  await timed('bulk-stock-500-lines', () => db.transaction(async tx => {
    // Exercise the maximum order length in one batch, not 500 network round trips.
    await tx.batch(Array.from({ length: 500 }, () => ({
      sql: 'UPDATE inventario SET stock_actual = stock_actual + 1 WHERE id = ?', args: [item.id],
    })));
    assertEqual((await tx.get('SELECT stock_actual FROM inventario WHERE id = ?', [item.id])).stock_actual, 510);
  }));
  assertEqual(await db.all('PRAGMA foreign_key_check'), []);
  return { status: 'passed', scope: 'database-compatibility-only', syntheticDataRetained: true, timings };
}

module.exports = { freshSchemaStatements, runTursoProbe };
