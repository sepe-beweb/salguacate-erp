const { sendDatabaseError, canManageStaff } = require('../http');
const { LOCALS, validDate, text, boolean, requireValid, activeUser } = require('../validation');

function registerTasks(app, { db, requireAuth, requireRole }) {
  // --- RUTAS DE TAREAS ---

  app.get('/api/tareas', requireAuth, (req, res) => {
    const { local } = req.query;
    let query = 'SELECT t.*, u.nombre as asignado_nombre FROM tareas t LEFT JOIN usuarios u ON t.asignado_a = u.id';
    const params = [];
    const conditions = [];
    if (req.user.rol === 'employee') {
      conditions.push('(t.asignado_a IS NULL OR t.asignado_a = ?)');
      params.push(req.user.id);
      conditions.push('(t.local IS NULL OR t.local = "" OR t.local = "Ambos" OR t.local = ?)');
      params.push(req.user.local || '');
    } else if (local) {
      conditions.push('(t.local = ? OR t.local = "Ambos")');
      params.push(local);
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY t.fecha DESC, t.completada ASC';
    db.all(query, params, (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  app.post('/api/tareas', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { titulo, descripcion, asignado_a, fecha, prioridad, local } = req.body;
    requireValid(text(titulo, 160) && text(descripcion ?? '', 5000, true) && validDate(fecha) &&
      ['baja', 'normal', 'alta'].includes(prioridad ?? 'normal') && [...LOCALS, 'Ambos', ''].includes(local ?? 'Ambos'),
      'Título, fecha, prioridad, local o descripción de tarea inválidos.');
    if (asignado_a !== null && asignado_a !== undefined && asignado_a !== '') activeUser(db, asignado_a);
    db.run(`INSERT INTO tareas (titulo, descripcion, asignado_a, fecha, prioridad, local, completada) VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [titulo, descripcion || '', asignado_a || null, fecha, prioridad || 'normal', local || 'Ambos'],
      function(err) {
        if (err) return sendDatabaseError(res, err);
        res.json({ id: this.lastID, mensaje: 'Tarea añadida' });
      }
    );
  });

  app.put('/api/tareas/:id/completada', requireAuth, (req, res) => {
    const { completada } = req.body;
    requireValid(boolean(completada), 'completada debe ser booleano.');
    const { id } = req.params;
    const updateTask = () => {
      db.run(`UPDATE tareas SET completada = ? WHERE id = ?`,
        [completada ? 1 : 0, id],
        function(err) {
          if (err) return sendDatabaseError(res, err);
          if (!this.changes) return res.status(404).json({ error: 'Tarea no encontrada.' });
          res.json({ mensaje: 'Estado de tarea actualizado' });
        }
      );
    };

    if (canManageStaff(req.user)) {
      return updateTask();
    }

    db.get('SELECT asignado_a, local FROM tareas WHERE id = ?', [id], (err, tarea) => {
      if (err) return sendDatabaseError(res, err);
      if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

      const assignedToOther = tarea.asignado_a !== null && String(tarea.asignado_a) !== String(req.user.id);
      const localMismatch = tarea.local && tarea.local !== '' && tarea.local !== 'Ambos' && tarea.local !== req.user.local;
      if (assignedToOther || localMismatch) {
        return res.status(403).json({ error: 'No puedes modificar esta tarea' });
      }

      updateTask();
    });
  });

  app.delete('/api/tareas/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM tareas WHERE id = ?`, [id], function(err) {
      if (err) return sendDatabaseError(res, err);
      if (!this.changes) return res.status(404).json({ error: 'Tarea no encontrada.' });
      res.json({ id, mensaje: 'Tarea eliminada' });
    });
  });
}

module.exports = { registerTasks };
