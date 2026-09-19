const { createDatabase } = require('./database');
const { connectLibsql } = require('./libsql');
const { freshSchemaContract } = require('./schema-contract');

async function verifyRemoteDatabase(db) {
  const expected = await freshSchemaContract();
  const actual = await db.all("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*'");
  // Fail closed on structural drift, including missing constraints or extra triggers.
  // Never migrate an operational remote database during process startup.
  const canonical = rows => rows.map(row => JSON.stringify([row.type, row.name, row.tbl_name, row.sql.trim().replace(/;$/, '')])).sort();
  if (JSON.stringify(canonical(actual)) !== JSON.stringify(canonical(expected.objects))) throw new Error('Remote schema does not match this release.');
  const versions = (await db.all('SELECT version FROM schema_migrations ORDER BY version')).map(row => row.version);
  if (JSON.stringify(versions) !== JSON.stringify(expected.migrations.map(row => row.version))) throw new Error('Remote migrations do not match this release.');
  if ((await db.get('PRAGMA foreign_keys'))?.foreign_keys !== 1 || (await db.all('PRAGMA foreign_key_check')).length) throw new Error('Remote foreign-key validation failed.');
  const owners = await db.all("SELECT pin FROM usuarios WHERE rol = 'owner' AND active = 1 AND must_change_pin = 0");
  if (!owners.some(owner => typeof owner.pin === 'string' && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(owner.pin))) throw new Error('An explicitly bootstrapped active owner is required.');
}

async function connectConfiguredDatabase(config, factories = {}) {
  let db;
  try {
    if (config.databaseDriver === 'libsql') {
      db = (factories.remote || connectLibsql)(config.turso);
      await verifyRemoteDatabase(db);
    } else if (config.databaseDriver === 'sqlite') {
      db = (factories.local || createDatabase)(config.filename);
      await db.ready;
    } else throw new Error('Unknown database driver.');
    return db;
  } catch {
    try { await db?.close(); } catch { /* Never print remote SDK diagnostics. */ }
    throw new Error('Database startup rejected. Check configuration, schema and explicit owner bootstrap; no fallback was attempted.');
  }
}

module.exports = { verifyRemoteDatabase, connectConfiguredDatabase };
