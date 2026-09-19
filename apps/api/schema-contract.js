const { createDatabase } = require('./database');

async function freshSchemaContract() {
  // The local migrations remain the sole definition of schema and constraints.
  const local = createDatabase(':memory:');
  try {
    await local.ready;
    return {
      objects: local.connection.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, rowid").all(),
      migrations: local.connection.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all(),
    };
  } finally { local.close(); }
}

async function freshSchemaStatements() {
  const schema = await freshSchemaContract();
  return [
    ...schema.objects.map(row => row.sql),
    ...schema.migrations.map(row => ({ sql: 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', args: [row.version, row.applied_at] })),
  ];
}

module.exports = { freshSchemaContract, freshSchemaStatements };
