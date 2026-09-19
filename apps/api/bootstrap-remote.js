const { connectLibsql, readTursoConfig } = require('./libsql');
const { freshSchemaStatements } = require('./schema-contract');
const { verifyRemoteDatabase } = require('./database-runtime');
const { hashPin, validPin } = require('./security');

function failure(code) { const error = new Error('Remote bootstrap did not complete with a confirmed result. Do not retry without reconciliation.'); error.code = code; return error; }

async function bootstrapRemoteOwner({ url, host, token, name, pin }, connect = connectLibsql) {
  const config = readTursoConfig({ TURSO_DATABASE_URL: url, TURSO_DATABASE_HOST: host, TURSO_AUTH_TOKEN: token });
  const normalized = typeof name === 'string' ? name.trim() : '';
  if (!normalized || normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized) || !validPin(pin)) throw failure('INVALID_BOOTSTRAP_INPUT');
  const hashed = await hashPin(pin); pin = ''; token = '';
  const schema = await freshSchemaStatements();
  let db, committed = false;
  try {
    db = connect(config);
    const owner = await db.transaction(async tx => {
      if ((await tx.all("SELECT name FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*'")).length) throw failure('DATABASE_NOT_EMPTY');
      if ((await tx.get('PRAGMA foreign_keys'))?.foreign_keys !== 1) throw failure('FOREIGN_KEYS_DISABLED');
      await tx.batch(schema);
      const result = await tx.run("INSERT INTO usuarios (nombre, rol, local, pin, must_change_pin) VALUES (?, 'owner', 'Todos', ?, 0)", [normalized, hashed]);
      await tx.run("INSERT INTO audit_events (actor_id, action, entity_id) VALUES (?, 'owner.bootstrap', ?)", [result.lastInsertRowid, String(result.lastInsertRowid)]);
      if ((await tx.all('PRAGMA foreign_key_check')).length) throw failure('INVALID_FRESH_SCHEMA');
      return { id: result.lastInsertRowid };
    });
    committed = true;
    await verifyRemoteDatabase(db);
    return { status: 'ready', ownerId: owner.id, sampleDataInserted: false };
  } catch (error) {
    if (error.code === 'COMMIT_UNCONFIRMED') throw failure('COMMIT_UNCONFIRMED');
    if (committed) throw failure('BOOTSTRAP_VERIFICATION_UNCONFIRMED');
    if (['DATABASE_NOT_EMPTY', 'FOREIGN_KEYS_DISABLED', 'INVALID_FRESH_SCHEMA'].includes(error.code)) throw failure(error.code);
    throw failure('BOOTSTRAP_FAILED');
  } finally {
    config.authToken = '';
    try { await db?.close(); } catch { /* No untrusted diagnostic output or replay. */ }
  }
}

module.exports = { bootstrapRemoteOwner };
