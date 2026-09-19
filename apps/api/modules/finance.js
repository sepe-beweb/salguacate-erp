const { asyncRoute } = require('../security');
const { sendDatabaseError } = require('../http');

function registerFinance(app, { db, requireAuth, requireRole }) {
  // --- RUTAS DE CIERRES (ROBUSTO Y CON VALIDACIÓN) ---

  app.get('/api/cierres', requireAuth, requireRole(['owner', 'manager']), asyncRoute(async (req, res) => {
    (await db.all('SELECT * FROM cierres ORDER BY fecha DESC', [], (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    }));
  }));

  // --- RUTAS DE GASTOS (CON FILTRADO LOCAL) ---

  app.get('/api/gastos', requireAuth, requireRole(['owner', 'manager']), asyncRoute(async (req, res) => {
    const { local } = req.query;
    let query = 'SELECT * FROM gastos';
    const params = [];
    if (local) {
      query += ' WHERE local = ?';
      params.push(local);
    }
    query += ' ORDER BY fecha DESC';

    (await db.all(query, params, (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    }));
  }));
}

module.exports = { registerFinance };
