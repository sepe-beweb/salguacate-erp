const path = require('path');

let db;

function initializeDatabase(db) {
  // Crear tablas
  db.serialize(() => {
    // Usuarios / Empleados
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        rol TEXT NOT NULL,
        local TEXT,
        telefono TEXT,
        pin TEXT DEFAULT '0000'
      )`, () => {
        db.run(`ALTER TABLE usuarios ADD COLUMN telefono TEXT`, (err) => {});
        db.run(`ALTER TABLE usuarios ADD COLUMN pin TEXT DEFAULT '0000'`, (err) => {});
      });

      // Fichajes
      db.run(`CREATE TABLE IF NOT EXISTS fichajes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        entrada TEXT NOT NULL,
        salida TEXT,
        estado TEXT DEFAULT 'trabajando',
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
      )`);

      // Inventario
      db.run(`CREATE TABLE IF NOT EXISTS inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto TEXT NOT NULL,
        stock_actual INTEGER DEFAULT 0,
        stock_minimo INTEGER DEFAULT 5,
        local TEXT,
        categoria TEXT DEFAULT 'Bebida',
        imagen_url TEXT,
        proveedor_id INTEGER,
        FOREIGN KEY(proveedor_id) REFERENCES proveedores(id)
      )`, () => {
        // Migración
        db.run(`ALTER TABLE inventario ADD COLUMN categoria TEXT DEFAULT 'Bebida'`, (err) => {});
        db.run(`ALTER TABLE inventario ADD COLUMN imagen_url TEXT`, (err) => {});
        db.run(`ALTER TABLE inventario ADD COLUMN proveedor_id INTEGER`, (err) => {});
      });

      // Proveedores
      db.run(`CREATE TABLE IF NOT EXISTS proveedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        telefono TEXT,
        email TEXT,
        categoria TEXT
      )`);

      // Turnos
      db.run(`CREATE TABLE IF NOT EXISTS turnos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        fecha TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        local TEXT,
        compañeros TEXT,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
      )`);

      // Mensajes
      db.run(`CREATE TABLE IF NOT EXISTS mensajes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        remitente_id INTEGER,
        destinatario_id INTEGER,
        asunto TEXT NOT NULL,
        cuerpo TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        leido BOOLEAN DEFAULT 0,
        FOREIGN KEY(remitente_id) REFERENCES usuarios(id),
        FOREIGN KEY(destinatario_id) REFERENCES usuarios(id)
      )`);

      // Agenda de Eventos (Manager)
      db.run(`CREATE TABLE IF NOT EXISTS eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        descripcion TEXT,
        tipo TEXT DEFAULT 'General',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Notas Rápidas
      db.run(`CREATE TABLE IF NOT EXISTS notas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        contenido TEXT NOT NULL,
        color TEXT DEFAULT 'yellow',
        fijada BOOLEAN DEFAULT 0,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
      )`, () => {
        db.run(`ALTER TABLE notas ADD COLUMN usuario_id INTEGER`, (err) => {});
      });

      // Cierres de Caja (Ventas)
      db.run(`CREATE TABLE IF NOT EXISTS cierres (
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

      // Gastos (Albaranes / Compras)
      db.run(`CREATE TABLE IF NOT EXISTS gastos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        proveedor_nombre TEXT NOT NULL,
        total REAL DEFAULT 0,
        concepto TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tareas (Checklist)
      db.run(`CREATE TABLE IF NOT EXISTS tareas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        asignado_a INTEGER,
        fecha TEXT NOT NULL,
        prioridad TEXT DEFAULT 'normal',
        completada BOOLEAN DEFAULT 0,
        local TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(asignado_a) REFERENCES usuarios(id)
      )`, () => {
        db.run(`ALTER TABLE tareas ADD COLUMN local TEXT`, (err) => {});
      });

      // Pedidos a Proveedores
      db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        local TEXT NOT NULL,
        proveedor_id INTEGER,
        proveedor_nombre TEXT,
        productos TEXT,
        estado TEXT DEFAULT 'pendiente',
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(proveedor_id) REFERENCES proveedores(id)
      )`);

      // Migración: local en gastos
      db.run(`ALTER TABLE gastos ADD COLUMN local TEXT DEFAULT 'Principal'`, (err) => {});

      // Datos de prueba (Seed)
      db.get("SELECT count(*) as count FROM usuarios", (err, row) => {
        if (row.count === 0) {
          console.log("Insertando datos de prueba...");
          db.run(`INSERT INTO usuarios (nombre, rol, local) VALUES 
            ('Jefe Admin', 'owner', 'Todos'),
            ('Encargado Principal', 'manager', 'Principal'),
            ('María García', 'employee', 'Principal'),
            ('Juan Pérez', 'employee', 'Principal')
          `, function(err) {
            if (!err) {
              // Sembrar turnos y mensajes después de los usuarios
              const hoy = new Date().toISOString().split('T')[0];
              
              db.run(`INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, local, compañeros) VALUES 
                (3, '${hoy}', '18:00', '02:00', 'Principal', 'Juan Pérez'),
                (4, '${hoy}', '18:00', '02:00', 'Principal', 'María García')
              `);

              db.run(`INSERT INTO mensajes (remitente_id, destinatario_id, asunto, cuerpo, fecha, leido) VALUES 
                (1, 3, 'Reunión mañana', 'Hola María, mañana necesitamos revisar la caja antes de abrir.', '${new Date().toISOString()}', 0),
                (4, 3, 'Cambio de turno', 'Hola, ¿te importa si te cambio el turno del viernes?', '${new Date().toISOString()}', 0)
              `);
            }
          });
        }
      });
    });
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
        if (callback) callback.call({ lastID: Number(res.lastInsertRowid) }, null);
      }).catch(err => {
        if (err.message && err.message.includes('duplicate column')) {
          if (callback) callback.call({ lastID: 0 }, null);
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
  
  // Wait a tick to simulate async open if needed, or just initialize:
  setTimeout(() => initializeDatabase(db), 0);
  
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.resolve(__dirname, 'database.sqlite');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error abriendo la base de datos', err.message);
    } else {
      console.log('Conectado a la base de datos SQLite local.');
      initializeDatabase(db);
    }
  });
}

module.exports = db;
