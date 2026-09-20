const { asyncRoute } = require('./security');
const { LOCALS, validDate } = require('./validation');
const { createOnce } = require('./idempotency');
const { writeAsActor } = require('./authorization');
const { sendDatabaseError, HttpError } = require('./http');

function money(value, negative = false) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^-?\d+(\.\d{1,2})?$/.test(String(value))) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && Math.abs(cents) <= 100000000 && (negative || cents >= 0) ? cents : null;
}

function registerOperations(app, db, { requireAuth, requireRole }) {
  const managers = requireRole(['owner', 'manager']);
  const audit = async (sql, req, action, id) => (await sql.prepare('INSERT INTO audit_events (actor_id, action, entity_id) VALUES (?, ?, ?)').run(req.user.id, action, String(id)));

  app.post('/api/cierres', requireAuth, managers, asyncRoute(async (req, res) => {
    const { fecha, local } = req.body;
    const values = ['efectivo', 'tarjeta', 'invitaciones', 'descuadre'].map(key => money(req.body[key] ?? 0, key === 'descuadre'));
    if (!validDate(fecha) || !LOCALS.includes(local) || values.includes(null)) return res.status(400).json({ error: 'Fecha, local o importes inválidos. Usa hasta dos decimales.' });
    const [efectivo, tarjeta, invitaciones, descuadre] = values;
    const result = (await writeAsActor(db, req, async sql => {
      if ((await sql.prepare('SELECT 1 FROM cierres WHERE fecha = ? AND local = ?').get(fecha, local))) return null;
      const inserted = (await sql.prepare('INSERT INTO cierres (fecha, local, efectivo, tarjeta, invitaciones, descuadre, total) VALUES (?, ?, ?, ?, ?, ?, ?)').run(fecha, local, efectivo / 100, tarjeta / 100, invitaciones / 100, descuadre / 100, (efectivo + tarjeta) / 100));
      (await audit(sql, req, 'cash.closed', inserted.lastInsertRowid));
      return Number(inserted.lastInsertRowid);
    }));
    if (result === null) return res.status(409).json({ error: 'Ya existe un cierre para esa fecha y local.' });
    res.status(201).json({ id: result, mensaje: 'Cierre registrado correctamente' });
  }));

  app.post('/api/gastos', requireAuth, managers, asyncRoute(async (req, res) => {
    const { fecha, local, proveedor_nombre, concepto = '', total } = req.body;
    const cents = money(total);
    if (!validDate(fecha) || !LOCALS.includes(local) || cents === null || typeof proveedor_nombre !== 'string' || !proveedor_nombre.trim() || proveedor_nombre.length > 160 || typeof concepto !== 'string' || concepto.length > 1000) {
      return res.status(400).json({ error: 'Revisa la fecha, el local, el proveedor y el importe.' });
    }
    const outcome = (await createOnce(db, req, 'expense.create', [fecha, local, proveedor_nombre.trim(), concepto, cents], 201, async sql => {
      const result = (await sql.prepare('INSERT INTO gastos (fecha, local, proveedor_nombre, concepto, total) VALUES (?, ?, ?, ?, ?)').run(fecha, local, proveedor_nombre.trim(), concepto, cents / 100));
      (await audit(sql, req, 'expense.created', result.lastInsertRowid));
      return { id: Number(result.lastInsertRowid), mensaje: 'Gasto registrado correctamente' };
    }));
    res.status(outcome.status).json(outcome.body);
  }));

  app.put('/api/inventario/:id/stock', requireAuth, managers, asyncRoute(async (req, res) => {
    const { increment } = req.body;
    if (!Number.isSafeInteger(increment) || Math.abs(increment) > 1000000) return res.status(400).json({ error: 'La cantidad debe ser un entero entre -1000000 y 1000000.' });
    const changed = (await writeAsActor(db, req, async sql => {
      const item = await sql.prepare('SELECT stock_actual FROM inventario WHERE id = ?').get(req.params.id);
      if (!item) return 0;
      if (!Number.isSafeInteger(item.stock_actual) || item.stock_actual < 0 || !Number.isSafeInteger(item.stock_actual + increment)) throw new HttpError(409, 'El stock resultante no es una cantidad exacta válida. No se ha modificado.');
      const result = (await sql.prepare('UPDATE inventario SET stock_actual = max(0, stock_actual + ?) WHERE id = ?').run(increment, req.params.id));
      if (result.changes) (await audit(sql, req, 'stock.adjusted', req.params.id));
      return result.changes;
    }));
    if (!changed) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ mensaje: 'Stock actualizado' });
  }));

  app.patch('/api/pedidos/:id/recibido', requireAuth, managers, asyncRoute(async (req, res) => {
    const { sumar_stock = false } = req.body || {};
    if (typeof sumar_stock !== 'boolean') return res.status(400).json({ error: 'sumar_stock debe ser booleano.' });
    try {
      const outcome = (await writeAsActor(db, req, async sql => {
        const order = (await sql.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id));
        if (!order) return 404;
        if (order.estado !== 'pendiente') return 409;
        if (sumar_stock) {
          let products;
          try { products = JSON.parse(order.productos); } catch { return 422; }
          if (!Array.isArray(products) || !products.length || products.length > 500) return 422;
          for (const item of products) {
            if (!item || !Number.isSafeInteger(item.producto_id) || !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 || item.cantidad > 1000000) return 422;
          }
          const rows = await sql.prepare(`SELECT id, stock_actual FROM inventario WHERE local = ? AND id IN (${products.map(() => '?').join(',')})`).all(order.local, ...products.map(item => item.producto_id));
          const ids = new Set(rows.map(row => row.id));
          if (products.some(item => !ids.has(item.producto_id))) return 422;
          const totals = new Map(rows.map(row => [row.id, row.stock_actual]));
          for (const item of products) {
            const stock = totals.get(item.producto_id);
            if (!Number.isSafeInteger(stock) || stock < 0 || !Number.isSafeInteger(stock + item.cantidad)) return 422;
            totals.set(item.producto_id, stock + item.cantidad);
          }
          await sql.batch(products.map(item => ({ sql: 'UPDATE inventario SET stock_actual = stock_actual + ? WHERE id = ?', args: [item.cantidad, item.producto_id] })));
        }
        (await sql.prepare("UPDATE pedidos SET estado = 'recibido' WHERE id = ?").run(order.id));
        (await audit(sql, req, sumar_stock ? 'order.received_with_stock' : 'order.received_without_stock', order.id));
        return 200;
      }));
      if (outcome !== 200) return res.status(outcome).json({ error: outcome === 409 ? 'El pedido ya está recibido; no se ha vuelto a sumar stock.' : outcome === 404 ? 'Pedido no encontrado.' : 'El pedido contiene productos o cantidades inválidos. No se ha cambiado ningún dato.' });
      res.json({ mensaje: sumar_stock ? 'Pedido recibido y stock actualizado.' : 'Pedido recibido sin actualizar stock.' });
    } catch (error) {
      // A lost COMMIT acknowledgement does not prove rollback. Never replay.
      sendDatabaseError(res, error);
    }
  }));
}

module.exports = { registerOperations, money, validDate };
