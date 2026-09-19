const { sendDatabaseError, canManageStaff } = require('../http');
const { LOCALS, validDate, validTime, validId, text, requireValid, activeUser } = require('../validation');

function registerWorkforce(app, { db, requireAuth, requireRole }) {
  // --- RUTAS DE FICHAJES (ROBUSTO) ---

  // Obtener fichaje activo del usuario
  app.get('/api/fichajes/activo', requireAuth, (req, res) => {
    const usuario_id = req.query.usuario_id ? String(req.query.usuario_id) : String(req.user.id);
    requireValid(validId(usuario_id), 'Identificador de usuario inválido.');
    if (usuario_id !== String(req.user.id) && !canManageStaff(req.user)) {
      return res.status(403).json({ error: 'No puedes consultar fichajes de otro usuario' });
    }
    db.get(`SELECT * FROM fichajes WHERE usuario_id = ? AND estado IN ('trabajando', 'descanso') LIMIT 1`,
      [usuario_id],
      (err, row) => {
        if (err) return sendDatabaseError(res, err);
        res.json(row || null);
      }
    );
  });

  // Registrar fichaje (entrada, salida, descanso, volver)
  app.post('/api/fichar', requireAuth, (req, res) => {
    const { usuario_id, tipo } = req.body; // tipo: 'entrada', 'salida', 'descanso', 'volver'
    const target_uid = usuario_id ? String(usuario_id) : String(req.user.id);
    requireValid(validId(target_uid) && ['entrada', 'salida', 'descanso', 'volver'].includes(tipo), 'Usuario o tipo de fichaje inválido.');
    if (target_uid !== String(req.user.id) && !canManageStaff(req.user)) {
      return res.status(403).json({ error: 'No puedes registrar fichajes de otro usuario' });
    }
    const fechaActual = new Date().toISOString();
    if (tipo === 'entrada') activeUser(db, target_uid);

    db.get(`SELECT * FROM fichajes WHERE usuario_id = ? AND estado IN ('trabajando', 'descanso') LIMIT 1`,
      [target_uid],
      (err, activeShift) => {
        if (err) return sendDatabaseError(res, err);

        if (tipo === 'entrada') {
          if (activeShift) {
            return res.status(400).json({ error: 'Ya tienes un fichaje activo registrado' });
          }
          db.run(`INSERT INTO fichajes (usuario_id, entrada, estado) VALUES (?, ?, 'trabajando')`,
            [target_uid, fechaActual],
            function(err) {
              if (err) return sendDatabaseError(res, err);
              res.json({ id: this.lastID, mensaje: 'Fichaje de entrada registrado correctamente' });
          });
        } else if (tipo === 'salida') {
          if (!activeShift) {
            return res.status(400).json({ error: 'No tienes ningún fichaje activo abierto' });
          }
          db.run(`UPDATE fichajes SET salida = ?, estado = 'fuera' WHERE id = ?`,
            [fechaActual, activeShift.id],
            function(err) {
              if (err) return sendDatabaseError(res, err);
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
              if (err) return sendDatabaseError(res, err);
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
              if (err) return sendDatabaseError(res, err);
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
      WHERE u.rol != 'owner' AND u.active = 1
      ORDER BY u.nombre ASC
    `;
    db.all(query, [], (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  // --- RUTAS DE TURNOS ---

  app.get('/api/turnos', requireAuth, (req, res) => {
    const { usuario_id } = req.query;
    if (usuario_id !== undefined) requireValid(validId(usuario_id), 'Identificador de usuario inválido.');
    let query = `
      SELECT t.*, u.nombre as empleado_nombre, u.rol as empleado_rol
      FROM turnos t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
    `;
    let params = [];

    if (req.user.rol === 'employee') {
      query += ' WHERE t.usuario_id = ?';
      params.push(req.user.id);
    } else if (usuario_id) {
      query += ' WHERE t.usuario_id = ?';
      params.push(usuario_id);
    }

    db.all(query, params, (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  app.post('/api/turnos', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { usuario_id, fecha, hora_inicio, hora_fin, local, compañeros } = req.body;
    requireValid(validDate(fecha) && validTime(hora_inicio) && validTime(hora_fin) && LOCALS.includes(local) && text(compañeros ?? '', 1000, true), 'Fecha, horas, local o compañeros inválidos.');
    activeUser(db, usuario_id);
    // End times earlier than start times remain valid: hospitality shifts can cross midnight.

    db.run(`INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, local, compañeros) VALUES (?, ?, ?, ?, ?, ?)`,
      [usuario_id, fecha, hora_inicio, hora_fin, local, compañeros || ''],
      function(err) {
        if (err) return sendDatabaseError(res, err);
        res.json({ id: this.lastID, mensaje: 'Turno asignado correctamente' });
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
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  app.post('/api/peticiones', requireAuth, (req, res) => {
    const { tipo, fecha_inicio, fecha_fin, comentarios } = req.body;

    requireValid(['vacaciones', 'cambio', 'baja', 'asuntos'].includes(tipo) && validDate(fecha_inicio) &&
      (fecha_fin === undefined || fecha_fin === null || fecha_fin === '' || (validDate(fecha_fin) && fecha_fin >= fecha_inicio)) && text(comentarios ?? '', 2000, true),
      'Tipo, fechas o comentarios de la petición inválidos.');

    db.run(`INSERT INTO peticiones (usuario_id, tipo, fecha_inicio, fecha_fin, comentarios, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')`,
      [req.user.id, tipo, fecha_inicio, fecha_fin || null, comentarios || null],
      function(err) {
        if (err) return sendDatabaseError(res, err);
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

    const existing = db.connection.prepare('SELECT estado FROM peticiones WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Petición no encontrada.' });
    if (existing.estado !== 'pendiente') return res.status(409).json({ error: 'La petición ya está resuelta. Recarga su estado.' });
    db.run(`UPDATE peticiones SET estado = ? WHERE id = ? AND estado = 'pendiente'`, [estado, id], function(err) {
      if (err) return sendDatabaseError(res, err);
      if (!this.changes) return res.status(409).json({ error: 'La petición cambió durante la operación.' });
      res.json({ id, mensaje: `Petición marcada como ${estado}` });
    });
  });
}

module.exports = { registerWorkforce };
