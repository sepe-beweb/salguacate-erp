const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { sendDatabaseError } = require('../http');
const { LOCALS, validDate, validId, text, requireValid } = require('../validation');

function registerCatalog(app, { db, requireAuth, requireRole, uploadsDir, logger }) {
  // --- RUTAS DE INVENTARIO ---

  app.get('/api/inventario', requireAuth, (req, res) => {
    const { local } = req.query;
    let query = 'SELECT inventario.*, proveedores.nombre as proveedor_nombre, proveedores.telefono as proveedor_telefono FROM inventario LEFT JOIN proveedores ON inventario.proveedor_id = proveedores.id';
    const params = [];
    if (local) { query += ' WHERE inventario.local = ?'; params.push(local); }
    db.all(query, params, (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  app.post('/api/inventario', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { producto, stock_actual, stock_minimo, local, categoria, proveedor_id, imagen_base64 } = req.body;
    const stock = stock_actual ?? 0, minimum = stock_minimo ?? 5;
    if (typeof producto !== 'string' || !producto.trim() || producto.length > 160 ||
        !Number.isSafeInteger(stock) || stock < 0 || stock > 1000000 ||
        !Number.isSafeInteger(minimum) || minimum < 0 || minimum > 1000000 ||
        !['Principal', 'Segundo Local'].includes(local) ||
        (categoria !== undefined && !['Bebida', 'Comida'].includes(categoria))) {
      return res.status(400).json({ error: 'Producto, cantidades, categoría o local inválidos.' });
    }
    const supplier = proveedor_id === '' || proveedor_id == null ? null : Number(proveedor_id);
    if (supplier !== null && (!Number.isSafeInteger(supplier) || !db.connection.prepare('SELECT id FROM proveedores WHERE id = ?').get(supplier))) {
      return res.status(400).json({ error: 'Proveedor inválido.' });
    }
    let imagen_url = null;
    let savedPath;
    if (imagen_base64) {
      if (!uploadsDir) return res.status(503).json({ error: 'Almacenamiento de imágenes no configurado.' });
      const match = typeof imagen_base64 === 'string' && /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(imagen_base64);
      if (!match) return res.status(400).json({ error: 'Solo se admiten imágenes PNG o JPEG.' });
      const bytes = Buffer.from(match[2], 'base64');
      const validHeader = match[1] === 'png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
      if (!validHeader || bytes.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Imagen inválida o superior a 3 MB.' });
      try {
        const fileName = `${crypto.randomUUID()}.${match[1] === 'png' ? 'png' : 'jpg'}`;
        savedPath = path.join(uploadsDir, fileName);
        fs.writeFileSync(savedPath, bytes, { flag: 'wx' });
        imagen_url = `/uploads/${fileName}`;
      } catch (e) {
        logger('error', 'Error al guardar la foto del inventario', e);
        return res.status(500).json({ error: 'No se pudo guardar la imagen. El producto no se ha creado.' });
      }
    }

    db.run(`INSERT INTO inventario (producto, stock_actual, stock_minimo, local, categoria, imagen_url, proveedor_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [producto.trim(), stock, minimum, local, categoria || 'Bebida', imagen_url, supplier],
      function(err) {
        if (err) {
          if (savedPath) { try { fs.unlinkSync(savedPath); } catch { logger('error', 'No se pudo retirar una imagen sin producto.'); } }
          return sendDatabaseError(res, err);
        }
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
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  // --- RUTAS DE PROVEEDORES ---

  app.get('/api/proveedores', requireAuth, (req, res) => {
    db.all('SELECT * FROM proveedores', [], (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  app.post('/api/proveedores', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { nombre, telefono, email, categoria } = req.body;
    requireValid(text(nombre, 160) && text(telefono ?? '', 40, true) && text(email ?? '', 254, true) && text(categoria ?? 'General', 80), 'Datos de proveedor inválidos.');
    db.run(`INSERT INTO proveedores (nombre, telefono, email, categoria) VALUES (?, ?, ?, ?)`,
      [nombre, telefono || '', email || '', categoria || 'General'],
      function(err) {
        if (err) return sendDatabaseError(res, err);
        res.json({ id: this.lastID, mensaje: 'Proveedor registrado correctamente' });
      }
    );
  });

  // --- RUTAS DE PEDIDOS ---

  app.get('/api/pedidos', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    db.all('SELECT * FROM pedidos ORDER BY fecha DESC', [], (err, rows) => {
      if (err) return sendDatabaseError(res, err);
      res.json(rows);
    });
  });

  app.post('/api/pedidos', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { fecha, local, proveedor_id, proveedor_nombre, productos } = req.body;
    requireValid(validDate(fecha) && LOCALS.includes(local) && text(proveedor_nombre ?? 'Sin proveedor', 160) &&
      Array.isArray(productos) && productos.length > 0 && productos.length <= 500, 'Fecha, local, proveedor o líneas del pedido inválidos.');
    const supplier = proveedor_id === '' || proveedor_id == null ? null : proveedor_id;
    if (supplier !== null) requireValid(validId(supplier) && !!db.connection.prepare('SELECT id FROM proveedores WHERE id = ?').get(Number(supplier)), 'Proveedor no encontrado.');
    for (const item of productos) {
      requireValid(item && validId(item.producto_id) && Number.isSafeInteger(item.cantidad) && item.cantidad > 0 && item.cantidad <= 1000000 && text(item.nombre, 160), 'Cada línea necesita producto, nombre y cantidad entera positiva.');
      requireValid(!!db.connection.prepare('SELECT id FROM inventario WHERE id = ? AND local = ?').get(Number(item.producto_id), local), 'El producto no existe en el local del pedido.');
    }
    const lines = productos.map(({ producto_id, nombre, cantidad }) => ({ producto_id: Number(producto_id), nombre, cantidad }));

    db.run(`INSERT INTO pedidos (fecha, local, proveedor_id, proveedor_nombre, productos, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')`,
      [fecha, local, supplier === null ? null : Number(supplier), proveedor_nombre ?? 'Sin proveedor', JSON.stringify(lines)],
      function(err) {
        if (err) return sendDatabaseError(res, err);
        res.json({ id: this.lastID, mensaje: 'Pedido guardado' });
      }
    );
  });

  app.delete('/api/pedidos/:id', requireAuth, requireRole(['owner', 'manager']), (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM pedidos WHERE id = ?`, [id], function(err) {
      if (err) return sendDatabaseError(res, err);
      if (!this.changes) return res.status(404).json({ error: 'Pedido no encontrado.' });
      res.json({ id, mensaje: 'Pedido eliminado' });
    });
  });
}

module.exports = { registerCatalog };
