const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function createDatabase(filename) {
  if (!filename) throw new Error('Database path is required');
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const connection = new DatabaseSync(filename, { enableDoubleQuotedStringLiterals: true });
  connection.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (filename !== ':memory:') connection.exec('PRAGMA journal_mode = WAL;');
  // Compatibility boundary for existing routes. New modules use prepared statements.
  const db = { connection, close: () => connection.close() };
  for (const method of ['run', 'get', 'all']) {
    db[method] = (sql, params, callback) => {
      if (typeof params === 'function') { callback = params; params = []; }
      let result;
      try {
        result = connection.prepare(sql)[method](...(params || []).map(value => value === undefined ? null : value));
      } catch (error) {
        if (callback) return callback(error);
        throw error;
      }
      if (method === 'run') callback?.call({ lastID: Number(result.lastInsertRowid), changes: Number(result.changes) }, null);
      else callback?.(null, result);
    };
  }
  db.transaction = (work) => {
    connection.exec('BEGIN IMMEDIATE');
    try {
      const result = work(connection);
      if (result && typeof result.then === 'function') throw new Error('Transaction callbacks must be synchronous');
      connection.exec('COMMIT');
      return result;
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    }
  };
  db.ready = Promise.resolve().then(() => db.transaction(() => initializeDatabase(db))).catch(error => { connection.close(); throw error; });
  return db;
}

function runQuery(database, sql, params = []) {
  try { return database.connection.prepare(sql).run(...params); }
  catch (error) { if (!/duplicate column name/i.test(error.message)) throw error; }
}

function initializeDatabase(database) {
    const connection = database.connection;
    if (connection.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'").get() &&
      connection.prepare('SELECT 1 FROM schema_migrations WHERE version > 1').get()) throw new Error('Database schema is newer than this application.');
    // 1. Crear tabla usuarios
    runQuery(database, `CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      local TEXT,
      telefono TEXT,
      pin TEXT
    )`);

    // Migraciones usuarios
    runQuery(database, `ALTER TABLE usuarios ADD COLUMN telefono TEXT`);
    runQuery(database, `ALTER TABLE usuarios ADD COLUMN pin TEXT`);

    // 2. Fichajes
    runQuery(database, `CREATE TABLE IF NOT EXISTS fichajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      entrada TEXT NOT NULL,
      salida TEXT,
      estado TEXT DEFAULT 'trabajando',
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);

    // 3. Proveedores
    runQuery(database, `CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      categoria TEXT
    )`);

    // 4. Inventario
    runQuery(database, `CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto TEXT NOT NULL,
      stock_actual INTEGER DEFAULT 0,
      stock_minimo INTEGER DEFAULT 5,
      local TEXT,
      categoria TEXT DEFAULT 'Bebida',
      imagen_url TEXT,
      proveedor_id INTEGER,
      FOREIGN KEY(proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL
    )`);

    // Migraciones inventario
    runQuery(database, `ALTER TABLE inventario ADD COLUMN categoria TEXT DEFAULT 'Bebida'`);
    runQuery(database, `ALTER TABLE inventario ADD COLUMN imagen_url TEXT`);
    runQuery(database, `ALTER TABLE inventario ADD COLUMN proveedor_id INTEGER`);

    // 5. Turnos
    runQuery(database, `CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      fecha TEXT NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      local TEXT,
      compañeros TEXT,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);

    // 6. Mensajes
    runQuery(database, `CREATE TABLE IF NOT EXISTS mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remitente_id INTEGER,
      destinatario_id INTEGER,
      asunto TEXT NOT NULL,
      cuerpo TEXT NOT NULL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      leido BOOLEAN DEFAULT 0,
      FOREIGN KEY(remitente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY(destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);

    // 7. Eventos
    runQuery(database, `CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      descripcion TEXT,
      tipo TEXT DEFAULT 'General',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 8. Notas
    runQuery(database, `CREATE TABLE IF NOT EXISTS notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      contenido TEXT NOT NULL,
      color TEXT DEFAULT 'yellow',
      fijada BOOLEAN DEFAULT 0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);
    runQuery(database, `ALTER TABLE notas ADD COLUMN usuario_id INTEGER`);

    // 9. Cierres
    runQuery(database, `CREATE TABLE IF NOT EXISTS cierres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      local TEXT NOT NULL,
      efectivo REAL DEFAULT 0,
      tarjeta REAL DEFAULT 0,
      invitaciones REAL DEFAULT 0,
      descuadre REAL DEFAULT 0,
      total REAL DEFAULT 0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 10. Gastos
    runQuery(database, `CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      proveedor_nombre TEXT NOT NULL,
      total REAL DEFAULT 0,
      concepto TEXT,
      local TEXT DEFAULT 'Principal',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    runQuery(database, `ALTER TABLE gastos ADD COLUMN local TEXT DEFAULT 'Principal'`);

    // 11. Tareas
    runQuery(database, `CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      asignado_a INTEGER,
      fecha TEXT NOT NULL,
      prioridad TEXT DEFAULT 'normal',
      completada BOOLEAN DEFAULT 0,
      local TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(asignado_a) REFERENCES usuarios(id) ON DELETE SET NULL
    )`);
    runQuery(database, `ALTER TABLE tareas ADD COLUMN local TEXT`);

    // 12. Pedidos
    runQuery(database, `CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      local TEXT NOT NULL,
      proveedor_id INTEGER,
      proveedor_nombre TEXT,
      productos TEXT,
      estado TEXT DEFAULT 'pendiente',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL
    )`);

    // 13. [NUEVO P0] Tabla Peticiones
    runQuery(database, `CREATE TABLE IF NOT EXISTS peticiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      tipo TEXT NOT NULL,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT,
      comentarios TEXT,
      estado TEXT DEFAULT 'pendiente',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);


  runQuery(database, 'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  if (!connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 1').get()) {
    connection.exec(`
      ALTER TABLE usuarios ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE usuarios ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE usuarios ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 1;
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        auth_version INTEGER NOT NULL, expires_at INTEGER NOT NULL
      );
      CREATE TABLE login_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES usuarios(id),
        action TEXT NOT NULL, entity_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX one_active_shift ON fichajes(usuario_id) WHERE estado IN ('trabajando', 'descanso');
      CREATE UNIQUE INDEX one_daily_close ON cierres(fecha, local);
      INSERT INTO schema_migrations VALUES (1, CURRENT_TIMESTAMP);
    `);
  }
  if (connection.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Database contains orphaned references; reconcile before migration.');
}

module.exports = { createDatabase };
