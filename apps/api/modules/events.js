const { runWrite } = require('../authorization');
const { asyncRoute } = require('../security');
const { sendDatabaseError } = require('../http');
const { validDate, validTime, text, requireValid } = require('../validation');

function validateEvent({ titulo, fecha, hora, descripcion, tipo }) {
  requireValid(text(titulo, 160) && validDate(fecha) && validTime(hora) && text(descripcion ?? '', 5000, true) && text(tipo ?? 'General', 80), 'Título, fecha, hora, tipo o descripción del evento inválidos.');
}

function registerEvents(app, { db, requireAuth, requireRole }) {
  // --- RUTAS DE AGENDA (EVENTOS) ---

  app.get('/api/eventos', requireAuth, asyncRoute(async (req, res) => {
    (await db.all('SELECT * FROM eventos ORDER BY fecha ASC, hora ASC', [], (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    }));
  }));

  app.post('/api/eventos', requireAuth, requireRole(['owner', 'manager']), asyncRoute(async (req, res) => {
    validateEvent(req.body);
    const { titulo, fecha, hora, descripcion, tipo } = req.body;
    (await runWrite(db, req, `INSERT INTO eventos (titulo, fecha, hora, descripcion, tipo) VALUES (?, ?, ?, ?, ?)`,
      [titulo, fecha, hora, descripcion || '', tipo || 'General'],
      function(err) {
        if (err) return sendDatabaseError(res, err);
        res.json({ id: this.lastID, mensaje: 'Evento programado' });
      }
    ));
  }));

  app.put('/api/eventos/:id', requireAuth, requireRole(['owner', 'manager']), asyncRoute(async (req, res) => {
    validateEvent(req.body);
    const { id } = req.params;
    const { titulo, fecha, hora, descripcion, tipo } = req.body;
    (await runWrite(db, req, `UPDATE eventos SET titulo = ?, fecha = ?, hora = ?, descripcion = ?, tipo = ? WHERE id = ?`,
      [titulo, fecha, hora, descripcion || '', tipo || 'General', id],
      function(err) {
        if (err) return sendDatabaseError(res, err);
        if (!this.changes) return res.status(404).json({ error: 'Evento no encontrado.' });
        res.json({ id, mensaje: 'Evento actualizado' });
      }
    ));
  }));

  app.delete('/api/eventos/:id', requireAuth, requireRole(['owner', 'manager']), asyncRoute(async (req, res) => {
    const { id } = req.params;
    (await runWrite(db, req, `DELETE FROM eventos WHERE id = ?`, [id], function(err) {
      if (err) return sendDatabaseError(res, err);
      if (!this.changes) return res.status(404).json({ error: 'Evento no encontrado.' });
      res.json({ id, mensaje: 'Evento eliminado' });
    }));
  }));
}

module.exports = { registerEvents };
