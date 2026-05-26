require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const logFile = path.join(__dirname, 'server.log');

// Utilidad profesional de logging
function logger(level, message, error = null) {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (error) {
    logLine += ` | ERROR: ${error.message || error}\nSTACK: ${error.stack}`;
  }
  logLine += '\n';
  
  if (level === 'error') console.error(logLine);
  else console.log(logLine);
  
  fs.appendFile(logFile, logLine, (err) => {
    if (err) console.error("No se pudo escribir en el log:", err);
  });
}

const app = express();
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.JWT_SECRET || 'salguacate-erp-super-secret-key-2026';

// --- SEGURIDAD: Funciones del Token HMAC-SHA256 ---
function generateToken(user) {
  const payload = {
    id: user.id,
    nombre: user.nombre,
    rol: user.rol,
    local: user.local,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 horas de validez
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payloadStr).digest('base64url');
  if (signature !== expectedSig) return null;
  
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) return null; // Expirado
    return payload;
  } catch (e) {
    return null;
  }
}

// Middlewares de protección
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token no provisto' });
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Formato de token inválido' });
  }
  
  const user = verifyToken(parts[1]);
  if (!user) return res.status(401).json({ error: 'Token inválido o expirado' });
  
  req.user = user;
  next();
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Acceso no autorizado para tu rol' });
    }
    next();
  };
};

// --- RUTAS DE USUARIOS ---

// Listado de usuarios (Hides PIN completely, returns is_active or has_pin)
app.get('/api/usuarios', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  db.all('SELECT id, nombre, rol, local, telefono, CASE WHEN pin IS NOT NULL AND pin != "" THEN 1 ELSE 0 END AS has_pin FROM usuarios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Login con PIN
app.post('/api/login', (req, res) => {
  const { usuario_id, pin } = req.body;
  const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
  
  db.get('SELECT id, nombre, rol, local, pin FROM usuarios WHERE id = ?', [usuario_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'Usuario no encontrado' });
    
    if (row.pin !== pin && row.pin !== hashedPin) {
      return res.status(401).json({ error: 'PIN incorrecto' });
    }
    
    if (row.pin === pin) {
       db.run('UPDATE usuarios SET pin = ? WHERE id = ?', [hashedPin, usuario_id]);
    }
    
    const userForToken = { id: row.id, nombre: row.nombre, rol: row.rol, local: row.local };
    const token = generateToken(userForToken);
    res.json({ success: true, user: userForToken, token });
  });
});

// Listado público (para login — sin PIN ni datos sensibles)
app.get('/api/usuarios/public', (req, res) => {
  db.all('SELECT id, nombre, rol FROM usuarios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/usuarios', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { nombre, rol, local, telefono, pin } = req.body;
  const pinToSave = pin || '0000';
  const hashedPin = crypto.createHash('sha256').update(pinToSave).digest('hex');
  
  db.run(`INSERT INTO usuarios (nombre, rol, local, telefono, pin) VALUES (?, ?, ?, ?, ?)`,
    [nombre, rol || 'employee', local || 'Principal', telefono || null, hashedPin],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Empleado creado' });
    }
  );
});

app.put('/api/usuarios/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { id } = req.params;
  const { nombre, rol, local, telefono, pin } = req.body;
  
  if (pin && pin.trim() !== '') {
    const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
    db.run(`UPDATE usuarios SET nombre = ?, rol = ?, local = ?, telefono = ?, pin = ? WHERE id = ?`,
      [nombre, rol, local, telefono, hashedPin, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, mensaje: 'Empleado actualizado con nuevo PIN' });
      }
    );
  } else {
    db.run(`UPDATE usuarios SET nombre = ?, rol = ?, local = ?, telefono = ? WHERE id = ?`,
      [nombre, rol, local, telefono, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, mensaje: 'Empleado actualizado' });
      }
    );
  }
});

app.delete('/api/usuarios/:id', requireAuth, requireRole(['owner']), (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT rol FROM usuarios WHERE id = ?', [id], (err, userToDelete) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!userToDelete) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    if (userToDelete.rol === 'owner') {
      db.get('SELECT count(*) as count FROM usuarios WHERE rol = "owner"', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count <= 1) {
          return res.status(400).json({ error: 'No se puede eliminar al último propietario del sistema' });
        }
        db.run(`DELETE FROM usuarios WHERE id = ?`, [id], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id, mensaje: 'Empleado eliminado' });
        });
      });
    } else {
      db.run(`DELETE FROM usuarios WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, mensaje: 'Empleado eliminado' });
      });
    }
  });
});

// --- RUTAS DE FICHAJES (ROBUSTO) ---

// Obtener fichaje activo del usuario
app.get('/api/fichajes/activo', requireAuth, (req, res) => {
  const usuario_id = req.query.usuario_id || req.user.id;
  db.get(`SELECT * FROM fichajes WHERE usuario_id = ? AND estado IN ('trabajando', 'descanso') LIMIT 1`,
    [usuario_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

// Registrar fichaje (entrada, salida, descanso, volver)
app.post('/api/fichar', requireAuth, (req, res) => {
  const { usuario_id, tipo } = req.body; // tipo: 'entrada', 'salida', 'descanso', 'volver'
  const target_uid = usuario_id || req.user.id;
  const fechaActual = new Date().toISOString();

  db.get(`SELECT * FROM fichajes WHERE usuario_id = ? AND estado IN ('trabajando', 'descanso') LIMIT 1`, 
    [target_uid], 
    (err, activeShift) => {
      if (err) return res.status(500).json({ error: err.message });

      if (tipo === 'entrada') {
        if (activeShift) {
          return res.status(400).json({ error: 'Ya tienes un fichaje activo registrado' });
        }
        db.run(`INSERT INTO fichajes (usuario_id, entrada, estado) VALUES (?, ?, 'trabajando')`, 
          [target_uid, fechaActual], 
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, mensaje: 'Fichaje de entrada registrado correctamente' });
        });
      } else if (tipo === 'salida') {
        if (!activeShift) {
          return res.status(400).json({ error: 'No tienes ningún fichaje activo abierto' });
        }
        db.run(`UPDATE fichajes SET salida = ?, estado = 'fuera' WHERE id = ?`, 
          [fechaActual, activeShift.id], 
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: 'Fichaje de salida registrado correctamente' });
        });
      } else if (tipo === 'descanso') {
        if (!activeShift) {
          return res.status(400).json({ error: 'No hay turno activo para iniciar descanso' });
        }
        if (activeShift.estado === 'descanso') {
          return res.status(400).json({ error: 'Ya te encuentras en descanso' });
        }
        db.run(`UPDATE fichajes SET estado = 'descanso' WHERE id = ?`, 
          [activeShift.id], 
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: 'Descanso iniciado correctamente' });
        });
      } else if (tipo === 'volver') {
        if (!activeShift) {
          return res.status(400).json({ error: 'No hay turno activo para volver de descanso' });
        }
        if (activeShift.estado !== 'descanso') {
          return res.status(400).json({ error: 'No te encuentras en descanso para reanudar' });
        }
        db.run(`UPDATE fichajes SET estado = 'trabajando' WHERE id = ?`, 
          [activeShift.id], 
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: 'Turno reanudado correctamente' });
        });
      } else {
        res.status(400).json({ error: 'Tipo de fichaje inválido' });
      }
  });
});

// Control de presencia en tiempo real
app.get('/api/fichajes/presencia', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const query = `
    SELECT 
      u.id as usuario_id, 
      u.nombre as usuario_nombre, 
      u.rol as usuario_rol, 
      u.local as usuario_local,
      f.entrada as ultimo_fichaje_entrada,
      f.salida as ultimo_fichaje_salida,
      COALESCE(f.estado, 'fuera') as estado_presencia
    FROM usuarios u
    LEFT JOIN (
      SELECT usuario_id, MAX(id) as max_id
      FROM fichajes
      GROUP BY usuario_id
    ) last_f ON u.id = last_f.usuario_id
    LEFT JOIN fichajes f ON last_f.max_id = f.id
    WHERE u.rol != 'owner'
    ORDER BY u.nombre ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- RUTAS DE INVENTARIO ---

app.get('/api/inventario', requireAuth, (req, res) => {
  const { local } = req.query;
  let query = 'SELECT inventario.*, proveedores.nombre as proveedor_nombre, proveedores.telefono as proveedor_telefono FROM inventario LEFT JOIN proveedores ON inventario.proveedor_id = proveedores.id';
  const params = [];
  if (local) { query += ' WHERE inventario.local = ?'; params.push(local); }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/inventario/:id/stock', requireAuth, (req, res) => {
  const { increment } = req.body;
  const { id } = req.params;
  
  db.run(`UPDATE inventario SET stock_actual = max(0, stock_actual + ?) WHERE id = ?`, 
    [increment, id], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: 'Stock actualizado' });
  });
});

app.post('/api/inventario', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { producto, stock_actual, stock_minimo, local, categoria, proveedor_id, imagen_base64 } = req.body;
  
  let imagen_url = null;
  if (imagen_base64) {
    try {
      const base64Data = imagen_base64.replace(/^data:image\/\w+;base64,/, "");
      const fileName = `item_${Date.now()}.jpg`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, base64Data, 'base64');
      imagen_url = `/uploads/${fileName}`;
    } catch (e) {
      logger('error', 'Error al guardar la foto del inventario', e);
    }
  }

  db.run(`INSERT INTO inventario (producto, stock_actual, stock_minimo, local, categoria, imagen_url, proveedor_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [producto, parseInt(stock_actual || 0), parseInt(stock_minimo || 5), local || 'Principal', categoria || 'Bebida', imagen_url, proveedor_id || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Producto añadido al inventario' });
    }
  );
});

// Alertas de Stock (<= Criterio unificado)
app.get('/api/inventario/alertas', requireAuth, (req, res) => {
  const { local } = req.query;
  let query = `
    SELECT i.*, p.nombre as proveedor_nombre, p.telefono as proveedor_telefono 
    FROM inventario i
    LEFT JOIN proveedores p ON i.proveedor_id = p.id
    WHERE i.stock_actual <= i.stock_minimo
  `;
  const params = [];
  if (local) { query += ' AND i.local = ?'; params.push(local); }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- RUTAS DE PROVEEDORES ---

app.get('/api/proveedores', requireAuth, (req, res) => {
  db.all('SELECT * FROM proveedores', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/proveedores', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { nombre, telefono, email, categoria } = req.body;
  db.run(`INSERT INTO proveedores (nombre, telefono, email, categoria) VALUES (?, ?, ?, ?)`,
    [nombre, telefono || '', email || '', categoria || 'General'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Proveedor registrado correctamente' });
    }
  );
});

// --- RUTAS DE TURNOS ---

app.get('/api/turnos', requireAuth, (req, res) => {
  const { usuario_id } = req.query;
  let query = `
    SELECT t.*, u.nombre as empleado_nombre, u.rol as empleado_rol 
    FROM turnos t 
    LEFT JOIN usuarios u ON t.usuario_id = u.id
  `;
  let params = [];
  
  if (usuario_id) {
    query += ' WHERE t.usuario_id = ?';
    params.push(usuario_id);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/turnos', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { usuario_id, fecha, hora_inicio, hora_fin, local, compañeros } = req.body;
  
  db.run(`INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, local, compañeros) VALUES (?, ?, ?, ?, ?, ?)`,
    [usuario_id, fecha, hora_inicio, hora_fin, local, compañeros || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Turno asignado correctamente' });
    }
  );
});

// --- RUTAS DE MENSAJES ---

app.get('/api/mensajes', requireAuth, (req, res) => {
  const { usuario_id } = req.query;
  const target_id = usuario_id || req.user.id;
  db.all('SELECT m.*, u.nombre as remitente_nombre FROM mensajes m JOIN usuarios u ON m.remitente_id = u.id WHERE m.destinatario_id = ? ORDER BY m.fecha DESC', [target_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/mensajes', requireAuth, (req, res) => {
  const { remitente_id, destinatario_id, asunto, cuerpo } = req.body;
  const from_id = remitente_id || req.user.id;
  const fecha = new Date().toISOString();
  db.run(`INSERT INTO mensajes (remitente_id, destinatario_id, asunto, cuerpo, fecha) VALUES (?, ?, ?, ?, ?)`,
    [from_id, destinatario_id, asunto, cuerpo, fecha],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Mensaje enviado' });
    }
  );
});

// --- RUTAS DE CIERRES (ROBUSTO Y CON VALIDACIÓN) ---

app.get('/api/cierres', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  db.all('SELECT * FROM cierres ORDER BY fecha DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/cierres', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { fecha, local, efectivo, tarjeta, invitaciones, descuadre } = req.body;
  
  const valEfectivo = parseFloat(efectivo || 0);
  const valTarjeta = parseFloat(tarjeta || 0);
  const valInvitaciones = parseFloat(invitaciones || 0);
  const valDescuadre = parseFloat(descuadre || 0);
  
  if (isNaN(valEfectivo) || valEfectivo < 0) return res.status(400).json({ error: 'El efectivo no puede ser negativo o inválido' });
  if (isNaN(valTarjeta) || valTarjeta < 0) return res.status(400).json({ error: 'La tarjeta no puede ser negativa o inválida' });
  if (isNaN(valInvitaciones) || valInvitaciones < 0) return res.status(400).json({ error: 'Las invitaciones no pueden ser negativas o inválidas' });
  if (isNaN(valDescuadre)) return res.status(400).json({ error: 'El descuadre es inválido' });
  
  if (!local || !['Principal', 'Segundo Local'].includes(local)) {
    return res.status(400).json({ error: 'Local inválido o no provisto' });
  }
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Fecha inválida. Debe ser YYYY-MM-DD' });
  }

  // Prevenir duplicado de cierre por fecha y local
  db.get('SELECT id FROM cierres WHERE fecha = ? AND local = ?', [fecha, local], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      return res.status(409).json({ error: `Ya existe un cierre registrado para el local ${local} en la fecha ${fecha}` });
    }
    
    const total = valEfectivo + valTarjeta;
    
    db.run(`INSERT INTO cierres (fecha, local, efectivo, tarjeta, invitaciones, descuadre, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fecha, local, valEfectivo, valTarjeta, valInvitaciones, valDescuadre, total],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, mensaje: 'Cierre registrado correctamente' });
      }
    );
  });
});

// --- RUTAS DE GASTOS (CON FILTRADO LOCAL) ---

app.get('/api/gastos', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { local } = req.query;
  let query = 'SELECT * FROM gastos';
  const params = [];
  if (local) {
    query += ' WHERE local = ?';
    params.push(local);
  }
  query += ' ORDER BY fecha DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/gastos', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { fecha, proveedor_nombre, total, concepto, local } = req.body;
  
  const targetLocal = local || 'Principal';
  if (!['Principal', 'Segundo Local'].includes(targetLocal)) {
    return res.status(400).json({ error: 'Local inválido' });
  }
  
  db.run(`INSERT INTO gastos (fecha, proveedor_nombre, total, concepto, local) VALUES (?, ?, ?, ?, ?)`,
    [
      fecha || new Date().toISOString().split('T')[0], 
      proveedor_nombre || 'Desconocido', 
      parseFloat(total || 0), 
      concepto || 'Albarán procesado',
      targetLocal
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Gasto registrado correctamente' });
    }
  );
});

// --- [NUEVO P0] RUTAS DE PETICIONES DE EMPLEADO ---

app.get('/api/peticiones', requireAuth, (req, res) => {
  let query = `
    SELECT p.*, u.nombre as empleado_nombre, u.rol as empleado_rol, u.local as empleado_local
    FROM peticiones p
    JOIN usuarios u ON p.usuario_id = u.id
  `;
  const params = [];
  
  // Si es un empleado, solo ve sus propias peticiones
  if (req.user.rol === 'employee') {
    query += ' WHERE p.usuario_id = ?';
    params.push(req.user.id);
  }
  
  query += ' ORDER BY p.creado_en DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/peticiones', requireAuth, (req, res) => {
  const { tipo, fecha_inicio, fecha_fin, comentarios } = req.body;
  
  if (!tipo || !fecha_inicio) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (tipo, fecha_inicio)' });
  }
  
  db.run(`INSERT INTO peticiones (usuario_id, tipo, fecha_inicio, fecha_fin, comentarios, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')`,
    [req.user.id, tipo, fecha_inicio, fecha_fin || null, comentarios || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Petición enviada correctamente' });
    }
  );
});

app.patch('/api/peticiones/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // 'aprobado' o 'rechazado'
  
  if (!['aprobado', 'rechazado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado de petición inválido' });
  }
  
  db.run(`UPDATE peticiones SET estado = ? WHERE id = ?`, [estado, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: `Petición marcada como ${estado}` });
  });
});

// --- RUTAS DE PEDIDOS ---

app.get('/api/pedidos', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  db.all('SELECT * FROM pedidos ORDER BY fecha DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/pedidos', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { fecha, local, proveedor_id, proveedor_nombre, productos } = req.body;
  
  db.run(`INSERT INTO pedidos (fecha, local, proveedor_id, proveedor_nombre, productos, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')`,
    [fecha, local, proveedor_id, proveedor_nombre, JSON.stringify(productos)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Pedido guardado' });
    }
  );
});

app.patch('/api/pedidos/:id/recibido', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE pedidos SET estado = 'recibido' WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Pedido marcado como recibido' });
  });
});

app.delete('/api/pedidos/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM pedidos WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Pedido eliminado' });
  });
});

// --- RUTAS DE AGENDA (EVENTOS) ---

app.get('/api/eventos', requireAuth, (req, res) => {
  db.all('SELECT * FROM eventos ORDER BY fecha ASC, hora ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/eventos', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { titulo, fecha, hora, descripcion, tipo } = req.body;
  db.run(`INSERT INTO eventos (titulo, fecha, hora, descripcion, tipo) VALUES (?, ?, ?, ?, ?)`,
    [titulo, fecha, hora, descripcion || '', tipo || 'General'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Evento programado' });
    }
  );
});

app.put('/api/eventos/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { id } = req.params;
  const { titulo, fecha, hora, descripcion, tipo } = req.body;
  db.run(`UPDATE eventos SET titulo = ?, fecha = ?, hora = ?, descripcion = ?, tipo = ? WHERE id = ?`,
    [titulo, fecha, hora, descripcion || '', tipo || 'General', id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, mensaje: 'Evento actualizado' });
    }
  );
});

app.delete('/api/eventos/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM eventos WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Evento eliminado' });
  });
});

// --- RUTAS DE NOTAS ---

app.get('/api/notas', requireAuth, (req, res) => {
  db.all('SELECT * FROM notas ORDER BY fijada DESC, creado_en DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/notas', requireAuth, (req, res) => {
  const { contenido, color } = req.body;
  db.run(`INSERT INTO notas (usuario_id, contenido, color, fijada) VALUES (?, ?, ?, 0)`,
    [req.user.id, contenido, color || 'yellow'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Nota guardada' });
    }
  );
});

app.put('/api/notas/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { contenido, color, fijada } = req.body;
  db.run(`UPDATE notas SET contenido = ?, color = ?, fijada = ? WHERE id = ?`,
    [contenido, color, fijada ? 1 : 0, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, mensaje: 'Nota actualizada' });
    }
  );
});

app.delete('/api/notas/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM notas WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Nota eliminada' });
  });
});

// --- RUTAS DE TAREAS ---

app.get('/api/tareas', requireAuth, (req, res) => {
  const { local } = req.query;
  let query = 'SELECT t.*, u.nombre as asignado_nombre FROM tareas t LEFT JOIN usuarios u ON t.asignado_a = u.id';
  const params = [];
  if (local) {
    query += ' WHERE t.local = ? OR t.local = "Ambos"';
    params.push(local);
  }
  query += ' ORDER BY t.fecha DESC, t.completada ASC';
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/tareas', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { titulo, descripcion, asignado_a, fecha, prioridad, local } = req.body;
  db.run(`INSERT INTO tareas (titulo, descripcion, asignado_a, fecha, prioridad, local, completada) VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [titulo, descripcion || '', asignado_a || null, fecha, prioridad || 'normal', local || 'Ambos'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Tarea añadida' });
    }
  );
});

app.put('/api/tareas/:id/completada', requireAuth, (req, res) => {
  const { completada } = req.body;
  const { id } = req.params;
  db.run(`UPDATE tareas SET completada = ? WHERE id = ?`,
    [completada ? 1 : 0, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: 'Estado de tarea actualizado' });
    }
  );
});

app.delete('/api/tareas/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM tareas WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Tarea eliminada' });
  });
});

// Promisify SQLite helpers for async/await inside AI logic
const dbRunAsync = (query, params) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) reject(err);
    else resolve(this || { lastID: 0, changes: 0 });
  });
});

const dbAllAsync = (query, params) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// Definir Herramientas (Tools) para Gemini
const aiTools = [{
  functionDeclarations: [
    {
      name: "crear_evento",
      description: "Crea un nuevo evento en la agenda. Usa esto cuando te pidan anotar una cita o recordar algo.",
      parameters: {
        type: "OBJECT",
        properties: {
          titulo: { type: "STRING" },
          fecha: { type: "STRING", description: "Formato YYYY-MM-DD. Hoy es " + new Date().toISOString().split('T')[0] },
          hora: { type: "STRING", description: "Formato HH:MM" },
          tipo: { type: "STRING", description: "Uno de: General, Mantenimiento, Proveedor, Reunion, Pinchada, Concierto" },
          descripcion: { type: "STRING", description: "Detalles o notas adicionales sobre el evento." }
        },
        required: ["titulo", "fecha", "hora", "tipo"]
      }
    },
    {
      name: "borrar_evento",
      description: "Elimina un evento de la agenda dado su ID.",
      parameters: {
        type: "OBJECT",
        properties: { id: { type: "INTEGER" } },
        required: ["id"]
      }
    },
    {
      name: "modificar_stock",
      description: "Modifica el stock actual de un producto sumando o restando unidades de forma no negativa.",
      parameters: {
        type: "OBJECT",
        properties: {
          producto_id: { type: "INTEGER", description: "El ID numérico del producto en el inventario" },
          cantidad: { type: "INTEGER", description: "Cantidad a sumar. Usa negativos para restar." }
        },
        required: ["producto_id", "cantidad"]
      }
    },
    {
      name: "asignar_turno",
      description: "Crea un nuevo turno para un empleado en un local.",
      parameters: {
        type: "OBJECT",
        properties: {
          usuario_id: { type: "INTEGER", description: "ID del empleado" },
          fecha: { type: "STRING", description: "Formato YYYY-MM-DD" },
          hora_inicio: { type: "STRING", description: "HH:MM" },
          hora_fin: { type: "STRING", description: "HH:MM" },
          local: { type: "STRING", description: "Principal o Segundo Local" },
          compañeros: { type: "STRING", description: "Nombre de compañeros de turno" }
        },
        required: ["usuario_id", "fecha", "hora_inicio", "hora_fin"]
      }
    }
  ]
}];

// --- RUTAS DE INTELIGENCIA ARTIFICIAL (GEMINI) ---

app.post('/api/ai/vision', requireAuth, async (req, res) => {
  const { imageBase64, mode } = req.body; // mode: 'invoice' o 'inventory'
  
  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    if (mode === 'invoice') {
      const prompt = `Analiza este ticket o factura de compra para un negocio de hostelería.
      Extrae los siguientes datos en un formato JSON plano y válido:
      {
        "proveedor": "Nombre del proveedor o emisor de la factura",
        "total": "Importe total sumado (número)",
        "concepto": "Breve resumen de lo comprado (máx. 10 palabras)"
      }
      Devuelve ÚNICAMENTE el JSON crudo, sin etiquetas markdown de bloque de código como \`\`\`json.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, "")
            }
          }
        ]
      });

      let cleanText = response.text.trim();
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
      const parsedData = JSON.parse(cleanText);

      res.json({
        success: true,
        proveedor: parsedData.proveedor,
        total: parsedData.total,
        concepto: parsedData.concepto,
        rawText: response.text
      });

    } else if (mode === 'inventory') {
      const prompt = `Analiza esta foto de una estantería o almacén de bar/restaurante.
      Estima el número de botellas físicas que puedes visualizar.
      Retorna un objeto JSON plano:
      {
        "botellasEstimadas": "Número aproximado de botellas visibles (entero)",
        "confianza": "Tu seguridad sobre el conteo del 0 al 100",
        "comentario": "Breve nota de lo que visualizas"
      }
      Devuelve ÚNICAMENTE el JSON crudo.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, "")
            }
          }
        ]
      });

      let cleanText = response.text.trim();
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
      const parsedData = JSON.parse(cleanText);

      res.json({
        success: true,
        botellasEstimadas: parsedData.botellasEstimadas,
        confianza: parsedData.confianza,
        rawText: parsedData.comentario
      });

    } else {
      res.status(400).json({ error: 'Modo de visión inválido' });
    }

  } catch (error) {
    logger('error', 'Error en visión AI', error);
    res.status(500).json({ error: 'Error en visión por IA: ' + error.message });
  }
});

app.post('/api/ai/chat', requireAuth, async (req, res) => {
  const { message } = req.body;
  logger('info', `Nueva petición de chat: "${message}"`);
  let actionExecuted = false;
  
  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 1. Obtener contexto en tiempo real
    const usuarios = await dbAllAsync('SELECT id, nombre, rol, local FROM usuarios', []);
    const inventario = await dbAllAsync('SELECT id, producto, stock_actual, stock_minimo, local FROM inventario', []);

    // 2. Construir Historial/Prompt
    const systemInstruction = `Eres "Salguabot", asistente del restaurante "Salguacate". 
    HOY ES: ${new Date().toISOString().split('T')[0]}.
    Tienes herramientas (functions) para modificar la base de datos si el usuario te lo pide.
    IMPORTANTE: Antes de usar herramientas que modifiquen o borren datos (borrar_evento, modificar_stock, asignar_turno, crear_evento), DEBES pedir confirmación explícita al usuario en el chat. Solo ejecuta la herramienta una vez que el usuario te haya confirmado su intención.
    Plantilla: ${JSON.stringify(usuarios)}
    Inventario: ${JSON.stringify(inventario)}`;

    const chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
        tools: aiTools,
        temperature: 0.2
      }
    });

    let response = await chatSession.sendMessage({ message: message });

    // 3. Comprobar si Gemini quiere llamar a una función
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      const args = call.args;
      logger('info', `Gemini solicita ejecutar función: ${call.name} con args ${JSON.stringify(args)}`);
      
      let funcResult = {};
      
      try {
        if (call.name === 'crear_evento') {
          await dbRunAsync(`INSERT INTO eventos (titulo, fecha, hora, tipo, descripcion) VALUES (?, ?, ?, ?, ?)`, 
            [args.titulo, args.fecha, args.hora, args.tipo, args.descripcion || '']);
          funcResult = { status: "success", message: "Evento insertado en base de datos correctamente." };
          actionExecuted = true;
        } 
        else if (call.name === 'borrar_evento') {
          const check = await dbRunAsync(`DELETE FROM eventos WHERE id = ?`, [args.id]);
          if (check.changes > 0) {
            funcResult = { status: "success", message: `Evento con ID ${args.id} eliminado.` };
            actionExecuted = true;
          } else {
            funcResult = { status: "error", message: `No se encontró ningún evento con el ID ${args.id}.` };
          }
        }
        else if (call.name === 'modificar_stock') {
          // UPDATE SET stock_actual = max(0, stock_actual + ?) para evitar stock negativo
          await dbRunAsync(`UPDATE inventario SET stock_actual = max(0, stock_actual + ?) WHERE id = ?`, 
            [args.cantidad, args.producto_id]);
          funcResult = { status: "success", message: `Stock del producto ${args.producto_id} actualizado.` };
          actionExecuted = true;
        }
        else if (call.name === 'asignar_turno') {
          await dbRunAsync(`INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, local, compañeros) VALUES (?, ?, ?, ?, ?, ?)`,
            [args.usuario_id, args.fecha, args.hora_inicio, args.hora_fin, args.local || 'Principal', args.compañeros || '']);
          funcResult = { status: "success", message: `Turno programado correctamente.` };
          actionExecuted = true;
        }
      } catch (dbErr) {
        funcResult = { status: "error", message: dbErr.message };
        logger('error', 'Error ejecutando función de base de datos desde Chatbot', dbErr);
      }

      // 4. Devolver resultado a Gemini con la firma correcta del SDK (sendMessage({ message: [...] }))
      response = await chatSession.sendMessage({
        message: [{
          functionResponse: {
            name: call.name,
            response: funcResult
          }
        }]
      });
    }

    res.json({ 
      success: true, 
      reply: response.text,
      actionExecuted: actionExecuted
    });

  } catch (error) {
    logger('error', 'Error en el endpoint de chat AI', error);
    res.status(500).json({ error: 'Error en el chat de IA', details: error.message });
  }
});

// Generador de Carteles con IA (Imagen)
app.post('/api/ai/poster', requireAuth, async (req, res) => {
  const { titulo, fecha, hora, tipo, descripcion } = req.body;
  logger('info', `Generando cartel para: "${titulo}"`);

  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const fechaFormateada = new Date(fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const esMusical = tipo === 'Pinchada' || tipo === 'Concierto';
    
    const prompt = `Create a stunning, professional event poster for a bar/venue called "Salguacate". 
    Event: "${titulo}"
    Date: ${fechaFormateada}
    Time: ${hora}
    Type: ${esMusical ? (tipo === 'Pinchada' ? 'DJ Night / Electronic Music Set' : 'Live Music Concert') : tipo}
    ${descripcion ? `Details: ${descripcion}` : ''}

    Style: Modern, vibrant, bold typography, ${esMusical ? 'neon lights, dark background, musical atmosphere, vinyl records or turntables imagery' : 'clean professional design'}. 
    The poster must include the event name "${titulo}" prominently, the date "${fechaFormateada}" and time "${hora}", and the venue name "Salguacate" at the bottom.
    Make it eye-catching and suitable for social media sharing. Vertical portrait orientation.`;

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      config: {
        numberOfImages: 1,
      }
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const imageBytes = response.generatedImages[0].image.imageBytes;
      const base64 = `data:image/png;base64,${imageBytes}`;
      logger('info', 'Cartel generado con éxito');
      res.json({ success: true, image: base64 });
    } else {
      logger('warn', 'La API no devolvió imágenes');
      res.json({ success: false, error: 'La IA no pudo generar la imagen. Inténtalo de nuevo.' });
    }

  } catch (error) {
    logger('error', 'Error generando cartel', error);
    res.status(500).json({ success: false, error: 'Error al generar el cartel: ' + error.message });
  }
});

if (process.env.NODE_ENV !== 'test' || process.env.START_SERVER === 'true') {
  app.listen(PORT, () => {
    logger('info', `Servidor backend corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
