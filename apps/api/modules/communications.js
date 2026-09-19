const { sendDatabaseError } = require('../http');
const { createOnce } = require('../idempotency');
const { text, boolean, requireValid, activeUser } = require('../validation');

function registerCommunications(app, { db, requireAuth, requireRole }) {
  // --- RUTAS DE MENSAJES ---

  app.get('/api/mensajes', requireAuth, (req, res) => {
    const { usuario_id } = req.query;
    if (usuario_id && String(usuario_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'No puedes consultar el buzón de otro usuario' });
    }
    const target_id = req.user.id;
    db.all('SELECT m.*, u.nombre as remitente_nombre FROM mensajes m JOIN usuarios u ON m.remitente_id = u.id WHERE m.destinatario_id = ? ORDER BY m.fecha DESC', [target_id], (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  app.post('/api/mensajes', requireAuth, (req, res) => {
    const { remitente_id, destinatario_id, asunto, cuerpo } = req.body;
    if (remitente_id && String(remitente_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'No puedes enviar mensajes en nombre de otro usuario' });
    }
    requireValid(text(asunto, 160) && text(cuerpo, 10000), 'Asunto o cuerpo del mensaje inválidos.');
    activeUser(db, destinatario_id);
    const from_id = req.user.id;
    const fecha = new Date().toISOString();
    db.run(`INSERT INTO mensajes (remitente_id, destinatario_id, asunto, cuerpo, fecha) VALUES (?, ?, ?, ?, ?)`,
      [from_id, destinatario_id, asunto, cuerpo, fecha],
      function(err) {
        if (err) return sendDatabaseError(res, err);
        res.json({ id: this.lastID, mensaje: 'Mensaje enviado' });
      }
    );
  });

  // --- RUTAS DE NOTAS ---

  app.get('/api/notas', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    db.all('SELECT * FROM notas ORDER BY fijada DESC, creado_en DESC', [], (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  app.post('/api/notas', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { contenido, color } = req.body;
    requireValid(text(contenido, 5000) && text(color ?? 'yellow', 30), 'Contenido o color de nota inválidos.');
    const result = createOnce(db, req, 'note.create', [contenido, color ?? 'yellow'], 200, sql => {
      const id = Number(sql.prepare('INSERT INTO notas (usuario_id, contenido, color, fijada) VALUES (?, ?, ?, 0)').run(req.user.id, contenido, color ?? 'yellow').lastInsertRowid);
      sql.prepare('INSERT INTO audit_events (actor_id, action, entity_id) VALUES (?, ?, ?)').run(req.user.id, 'note.created', String(id));
      return { id, mensaje: 'Nota guardada' };
    });
    res.status(result.status).json(result.body);
  });

  app.put('/api/notas/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { id } = req.params;
    const { contenido, color, fijada } = req.body;
    requireValid(text(contenido, 5000) && text(color, 30) && boolean(fijada), 'Datos de nota inválidos.');
    db.run(`UPDATE notas SET contenido = ?, color = ?, fijada = ? WHERE id = ?`,
      [contenido, color, fijada ? 1 : 0, id],
      function(err) {
        if (err) return sendDatabaseError(res, err);
        if (!this.changes) return res.status(404).json({ error: 'Nota no encontrada.' });
        res.json({ id, mensaje: 'Nota actualizada' });
      }
    );
  });

  app.delete('/api/notas/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM notas WHERE id = ?`, [id], function(err) {
      if (err) return sendDatabaseError(res, err);
      if (!this.changes) return res.status(404).json({ error: 'Nota no encontrada.' });
      res.json({ id, mensaje: 'Nota eliminada' });
    });
  });
}

module.exports = { registerCommunications };
