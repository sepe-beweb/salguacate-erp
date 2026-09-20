const { writeAsActor } = require('../authorization');
const { asyncRoute } = require('../security');
const { sendDatabaseError, canManageStaff, HttpError } = require('../http');
const { LOCALS, validDate, text, boolean, requireValid, activeUser } = require('../validation');

function registerTasks(app, { db, requireAuth, requireRole }) {
  // --- RUTAS DE TAREAS ---

  app.get('/api/tareas', requireAuth, asyncRoute(async (req, res) => {
    const { local } = req.query;
    let query = 'SELECT t.*, u.nombre as asignado_nombre FROM tareas t LEFT JOIN usuarios u ON t.asignado_a = u.id';
    const params = [];
    const conditions = [];
    if (req.user.rol === 'employee') {
      conditions.push('(t.asignado_a IS NULL OR t.asignado_a = ?)');
      params.push(req.user.id);
      conditions.push("(t.local IS NULL OR t.local = '' OR t.local = 'Ambos' OR t.local = ?)");
      params.push(req.user.local || '');
    } else if (local) {
      conditions.push("(t.local = ? OR t.local = 'Ambos')");
      params.push(local);
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY t.fecha DESC, t.completada ASC';
    (await db.all(query, params, (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    }));
  }));

  app.post('/api/tareas', requireAuth, requireRole(['owner', 'manager']), asyncRoute(async (req, res) => {
    const { titulo, descripcion, asignado_a, fecha, prioridad, local } = req.body;
    requireValid(text(titulo, 160) && text(descripcion ?? '', 5000, true) && validDate(fecha) &&
      ['baja', 'normal', 'alta'].includes(prioridad ?? 'normal') && [...LOCALS, 'Ambos', ''].includes(local ?? 'Ambos'),
      'Título, fecha, prioridad, local o descripción de tarea inválidos.');
    const result = await writeAsActor(db, req, async sql => {
      if (asignado_a !== null && asignado_a !== undefined && asignado_a !== '') {
        const assignee = await activeUser({ connection: sql }, asignado_a);
        requireValid(assignee.rol !== 'employee' || !local || local === 'Ambos' || assignee.local === local,
          'El empleado no pertenece al local de la tarea. Elige su local o Ambos.');
      }
      return sql.prepare('INSERT INTO tareas (titulo, descripcion, asignado_a, fecha, prioridad, local, completada) VALUES (?, ?, ?, ?, ?, ?, 0)').run(titulo, descripcion || '', asignado_a || null, fecha, prioridad || 'normal', local || 'Ambos');
    });
    res.json({ id: result.lastInsertRowid, mensaje: 'Tarea añadida' });
  }));

  app.put('/api/tareas/:id/completada', requireAuth, asyncRoute(async (req, res) => {
    const { completada } = req.body;
    requireValid(boolean(completada), 'completada debe ser booleano.');
    const { id } = req.params;
    await writeAsActor(db, req, async sql => {
      const tarea = await sql.prepare('SELECT asignado_a, local FROM tareas WHERE id = ?').get(id);
      if (!tarea) throw new HttpError(404, 'Tarea no encontrada');
      if (!canManageStaff(req.user)) {
        const assignedToOther = tarea.asignado_a !== null && String(tarea.asignado_a) !== String(req.user.id);
        const localMismatch = tarea.local && tarea.local !== 'Ambos' && tarea.local !== req.user.local;
        if (assignedToOther || localMismatch) throw new HttpError(403, 'No puedes modificar esta tarea');
      }
      const result = await sql.prepare('UPDATE tareas SET completada = ?, completado_por = ?, completado_en = ? WHERE id = ? AND completada != ?')
        .run(completada ? 1 : 0, completada ? req.user.id : null, completada ? new Date().toISOString() : null, id, completada ? 1 : 0);
      if (result.changes) await sql.prepare('INSERT INTO audit_events (actor_id, action, entity_id) VALUES (?, ?, ?)')
        .run(req.user.id, completada ? 'task.completed' : 'task.reopened', String(id));
    });
    res.json({ mensaje: 'Estado de tarea actualizado' });
  }));

  app.delete('/api/tareas/:id', requireAuth, requireRole(['owner', 'manager']), asyncRoute(async (req, res) => {
    const { id } = req.params;
    await writeAsActor(db, req, async sql => {
      const task = await sql.prepare('SELECT rutina_ejecucion_id FROM tareas WHERE id = ?').get(id);
      if (!task) throw new HttpError(404, 'Tarea no encontrada.');
      if (task.rutina_ejecucion_id !== null) throw new HttpError(409, 'Las tareas de rutina se conservan en el historial. Puedes archivar la rutina para días futuros.');
      await sql.prepare('DELETE FROM tareas WHERE id = ?').run(id);
    });
    res.json({ id, mensaje: 'Tarea eliminada' });
  }));
}

module.exports = { registerTasks };
