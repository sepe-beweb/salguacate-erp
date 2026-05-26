const path = require('path');

let db;

// Helper to run query returning a promise, ignoring duplicate column errors
function runQuery(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function(err) {
      if (err) {
        const msg = err.message || '';
        if (msg.includes('duplicate column') || msg.includes('already exists') || msg.includes('Duplicate column')) {
          resolve({ lastID: 0, changes: 0 });
        } else {
          reject(err);
        }
      } else {
        // En sqlite3 de node, "this" contiene lastID y changes.
        // En Turso proxy, devolvemos un objeto plano.
        resolve(this || { lastID: 0, changes: 0 });
      }
    });
  });
}

function allQuery(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getQuery(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function initializeDatabase(database) {
  try {
    console.log("Inicializando base de datos de forma secuencial...");

    // 1. Crear tabla usuarios
    await runQuery(database, `CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      local TEXT,
      telefono TEXT,
      pin TEXT DEFAULT '0000'
    )`);

    // Migraciones usuarios
    await runQuery(database, `ALTER TABLE usuarios ADD COLUMN telefono TEXT`);
    await runQuery(database, `ALTER TABLE usuarios ADD COLUMN pin TEXT DEFAULT '0000'`);

    // 2. Fichajes
    await runQuery(database, `CREATE TABLE IF NOT EXISTS fichajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      entrada TEXT NOT NULL,
      salida TEXT,
      estado TEXT DEFAULT 'trabajando',
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);

    // 3. Proveedores
    await runQuery(database, `CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      categoria TEXT
    )`);

    // 4. Inventario
    await runQuery(database, `CREATE TABLE IF NOT EXISTS inventario (
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
    await runQuery(database, `ALTER TABLE inventario ADD COLUMN categoria TEXT DEFAULT 'Bebida'`);
    await runQuery(database, `ALTER TABLE inventario ADD COLUMN imagen_url TEXT`);
    await runQuery(database, `ALTER TABLE inventario ADD COLUMN proveedor_id INTEGER`);

    // 5. Turnos
    await runQuery(database, `CREATE TABLE IF NOT EXISTS turnos (
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
    await runQuery(database, `CREATE TABLE IF NOT EXISTS mensajes (
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
    await runQuery(database, `CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      descripcion TEXT,
      tipo TEXT DEFAULT 'General',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 8. Notas
    await runQuery(database, `CREATE TABLE IF NOT EXISTS notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      contenido TEXT NOT NULL,
      color TEXT DEFAULT 'yellow',
      fijada BOOLEAN DEFAULT 0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);
    await runQuery(database, `ALTER TABLE notas ADD COLUMN usuario_id INTEGER`);

    // 9. Cierres
    await runQuery(database, `CREATE TABLE IF NOT EXISTS cierres (
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
    await runQuery(database, `CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      proveedor_nombre TEXT NOT NULL,
      total REAL DEFAULT 0,
      concepto TEXT,
      local TEXT DEFAULT 'Principal',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await runQuery(database, `ALTER TABLE gastos ADD COLUMN local TEXT DEFAULT 'Principal'`);

    // 11. Tareas
    await runQuery(database, `CREATE TABLE IF NOT EXISTS tareas (
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
    await runQuery(database, `ALTER TABLE tareas ADD COLUMN local TEXT`);

    // 12. Pedidos
    await runQuery(database, `CREATE TABLE IF NOT EXISTS pedidos (
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
    await runQuery(database, `CREATE TABLE IF NOT EXISTS peticiones (
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

    // 14. Seed de datos de prueba
    const row = await getQuery(database, "SELECT count(*) as count FROM usuarios");
    if (row && row.count === 0) {
      console.log("Insertando datos de prueba (Seed)...");
      await runQuery(database, `INSERT INTO usuarios (nombre, rol, local) VALUES ('Jefe Admin', 'owner', 'Todos')`);
      await runQuery(database, `INSERT INTO usuarios (nombre, rol, local) VALUES ('Encargado Principal', 'manager', 'Principal')`);
      await runQuery(database, `INSERT INTO usuarios (nombre, rol, local) VALUES ('María García', 'employee', 'Principal')`);
      await runQuery(database, `INSERT INTO usuarios (nombre, rol, local) VALUES ('Juan Pérez', 'employee', 'Principal')`);

      const hoy = new Date().toISOString().split('T')[0];
      
      await runQuery(database, `INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, local, compañeros) VALUES 
        (3, '${hoy}', '18:00', '02:00', 'Principal', 'Juan Pérez'),
        (4, '${hoy}', '18:00', '02:00', 'Principal', 'María García')
      `);

      await runQuery(database, `INSERT INTO mensajes (remitente_id, destinatario_id, asunto, cuerpo, fecha, leido) VALUES 
        (1, 3, 'Reunión mañana', 'Hola María, mañana necesitamos revisar la caja antes de abrir.', '${new Date().toISOString()}', 0),
        (4, 3, 'Cambio de turno', 'Hola, ¿te importa si te cambio el turno del viernes?', '${new Date().toISOString()}', 0)
      `);
    }

    console.log("Base de datos inicializada correctamente de forma secuencial.");
  } catch (err) {
    console.error("Error crítico durante la inicialización de la base de datos:", err);
  }
}

if (process.env.TURSO_DATABASE_URL) {
  const { createClient } = require('@libsql/client');
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  console.log('Conectado a la base de datos Turso (libSQL).');
  
  db = {
    serialize: function(cb) { if (cb) cb(); },
    run: function(query, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      client.execute({ sql: query, args: params || [] }).then(res => {
        if (callback) callback.call({ lastID: Number(res.lastInsertRowid), changes: res.rowsAffected }, null);
      }).catch(err => {
        if (err.message && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
          if (callback) callback.call({ lastID: 0, changes: 0 }, null);
          return;
        }
        if (callback) callback(err);
        else console.error('Turso run error:', err.message);
      });
    },
    all: function(query, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      client.execute({ sql: query, args: params || [] }).then(res => {
        if (callback) callback(null, res.rows);
      }).catch(err => {
        if (callback) callback(err);
      });
    },
    get: function(query, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      client.execute({ sql: query, args: params || [] }).then(res => {
        if (callback) callback(null, res.rows[0]);
      }).catch(err => {
        if (callback) callback(err);
      });
    }
  };
  
  // Inicialización asíncrona segura
  setTimeout(() => initializeDatabase(db), 0);
  
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.resolve(__dirname, 'database.sqlite');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error abriendo la base de datos', err.message);
    } else {
      console.log('Conectado a la base de datos SQLite local.');
      db.run("PRAGMA foreign_keys = ON", (err) => {
        if (err) console.error("Error al habilitar PRAGMA foreign_keys = ON:", err.message);
      });
      initializeDatabase(db);
    }
  });
}

module.exports = db;
