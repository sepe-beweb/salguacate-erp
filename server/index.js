require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'server.log');

// Utilidad profesional de logging
function logger(level, message, error = null) {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (error) {
    logLine += ` | ERROR: ${error.message || error}\nSTACK: ${error.stack}`;
  }
  logLine += '\n';
  
  // Imprimir en consola y guardar en archivo
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

const PORT = 3001;

// Rutas de Usuarios
app.get('/api/usuarios', (req, res) => {
  db.all('SELECT id, nombre, rol, local, telefono, pin FROM usuarios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Login con PIN
app.post('/api/login', (req, res) => {
  const { usuario_id, pin } = req.body;
  db.get('SELECT id, nombre, rol, local FROM usuarios WHERE id = ? AND pin = ?', [usuario_id, pin], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'PIN incorrecto' });
    res.json({ success: true, user: row });
  });
});

// Listado público (para pantalla de login — solo nombre y rol, sin PIN)
app.get('/api/usuarios/public', (req, res) => {
  db.all('SELECT id, nombre, rol FROM usuarios', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/usuarios', (req, res) => {
  const { nombre, rol, local, telefono, pin } = req.body;
  db.run(`INSERT INTO usuarios (nombre, rol, local, telefono, pin) VALUES (?, ?, ?, ?, ?)`,
    [nombre, rol || 'employee', local || 'Principal', telefono || null, pin || '0000'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Empleado creado' });
    }
  );
});

app.put('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, rol, local, telefono, pin } = req.body;
  db.run(`UPDATE usuarios SET nombre = ?, rol = ?, local = ?, telefono = ?, pin = ? WHERE id = ?`,
    [nombre, rol, local, telefono, pin || '0000', id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, mensaje: 'Empleado actualizado' });
    }
  );
});

app.delete('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM usuarios WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Empleado eliminado' });
  });
});

// Rutas de Fichajes
app.post('/api/fichar', (req, res) => {
  const { usuario_id, tipo } = req.body; // tipo: 'entrada' o 'salida'
  const fechaActual = new Date().toISOString();

  if (tipo === 'entrada') {
    db.run(`INSERT INTO fichajes (usuario_id, entrada, estado) VALUES (?, ?, 'trabajando')`, 
      [usuario_id, fechaActual], 
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, mensaje: 'Fichaje de entrada registrado' });
    });
  } else if (tipo === 'salida') {
    db.run(`UPDATE fichajes SET salida = ?, estado = 'fuera' WHERE usuario_id = ? AND estado = 'trabajando'`, 
      [fechaActual, usuario_id], 
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Fichaje de salida registrado' });
    });
  }
});

// Control de presencia de empleados en tiempo real
app.get('/api/fichajes/presencia', (req, res) => {
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

// Rutas de Inventario
app.get('/api/inventario', (req, res) => {
  const { local } = req.query;
  let query = 'SELECT inventario.*, proveedores.nombre as proveedor_nombre, proveedores.telefono as proveedor_telefono FROM inventario LEFT JOIN proveedores ON inventario.proveedor_id = proveedores.id';
  const params = [];
  if (local) { query += ' WHERE inventario.local = ?'; params.push(local); }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/inventario/:id/stock', (req, res) => {
  const { increment } = req.body;
  const { id } = req.params;
  
  db.run(`UPDATE inventario SET stock_actual = max(0, stock_actual + ?) WHERE id = ?`, 
    [increment, id], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: 'Stock actualizado' });
  });
});

app.post('/api/inventario', (req, res) => {
  const { producto, stock_actual, stock_minimo, local, categoria, proveedor_id, imagen_base64 } = req.body;
  
  let imagen_url = null;
  if (imagen_base64) {
    try {
      const base64Data = imagen_base64.replace(/^data:image\/\w+;base64,/, "");
      const fileName = `item_${Date.now()}.jpg`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, base64Data, 'base64');
      imagen_url = `/uploads/${fileName}`;
    } catch (err) {
      console.error("Error guardando la imagen:", err);
    }
  }

  db.run(`INSERT INTO inventario (producto, stock_actual, stock_minimo, local, categoria, proveedor_id, imagen_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [producto, stock_actual || 0, stock_minimo || 5, local || 'Principal', categoria || 'Bebida', proveedor_id || null, imagen_url],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Producto añadido al inventario' });
    }
  );
});

// Alertas de Stock (Pedidos Automáticos)
app.get('/api/inventario/alertas', (req, res) => {
  const { local } = req.query;
  let query = `
    SELECT i.*, p.nombre as proveedor_nombre, p.telefono as proveedor_telefono 
    FROM inventario i
    LEFT JOIN proveedores p ON i.proveedor_id = p.id
    WHERE i.stock_actual < i.stock_minimo
  `;
  const params = [];
  if (local) { query += ' AND i.local = ?'; params.push(local); }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Rutas de Proveedores
app.get('/api/proveedores', (req, res) => {
  db.all('SELECT * FROM proveedores', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/proveedores', (req, res) => {
  const { nombre, telefono, email, categoria } = req.body;
  db.run(`INSERT INTO proveedores (nombre, telefono, email, categoria) VALUES (?, ?, ?, ?)`,
    [nombre, telefono || '', email || '', categoria || 'General'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Proveedor registrado correctamente' });
    }
  );
});

// Rutas de Turnos (Calendario)
app.get('/api/turnos', (req, res) => {
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

app.post('/api/turnos', (req, res) => {
  const { usuario_id, fecha, hora_inicio, hora_fin, local, compañeros } = req.body;
  
  db.run(`INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, local, compañeros) VALUES (?, ?, ?, ?, ?, ?)`,
    [usuario_id, fecha, hora_inicio, hora_fin, local, compañeros || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Turno asignado correctamente' });
    }
  );
});

// Rutas de Mensajes (Correos)
app.get('/api/mensajes', (req, res) => {
  const { usuario_id } = req.query;
  db.all('SELECT m.*, u.nombre as remitente_nombre FROM mensajes m JOIN usuarios u ON m.remitente_id = u.id WHERE m.destinatario_id = ? ORDER BY m.fecha DESC', [usuario_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/mensajes', (req, res) => {
  const { remitente_id, destinatario_id, asunto, cuerpo } = req.body;
  const fecha = new Date().toISOString();
  db.run(`INSERT INTO mensajes (remitente_id, destinatario_id, asunto, cuerpo, fecha) VALUES (?, ?, ?, ?, ?)`,
    [remitente_id, destinatario_id, asunto, cuerpo, fecha],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Mensaje enviado' });
    }
  );
});

// Rutas de Cierres de Caja (Ventas)
app.get('/api/cierres', (req, res) => {
  db.all('SELECT * FROM cierres ORDER BY fecha DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/cierres', (req, res) => {
  const { fecha, local, efectivo, tarjeta, invitaciones, descuadre } = req.body;
  const total = parseFloat(efectivo || 0) + parseFloat(tarjeta || 0);
  
  db.run(`INSERT INTO cierres (fecha, local, efectivo, tarjeta, invitaciones, descuadre, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fecha, local, parseFloat(efectivo || 0), parseFloat(tarjeta || 0), parseFloat(invitaciones || 0), parseFloat(descuadre || 0), total],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Cierre registrado correctamente' });
    }
  );
});

// Rutas de Gastos (Albaranes / AI)
app.get('/api/gastos', (req, res) => {
  db.all('SELECT * FROM gastos ORDER BY fecha DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/gastos', (req, res) => {
  const { fecha, proveedor_nombre, total, concepto } = req.body;
  
  db.run(`INSERT INTO gastos (fecha, proveedor_nombre, total, concepto) VALUES (?, ?, ?, ?)`,
    [fecha || new Date().toISOString().split('T')[0], proveedor_nombre || 'Desconocido', parseFloat(total || 0), concepto || 'Albarán procesado por IA'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Gasto registrado correctamente' });
    }
  );
});

// Rutas de Inteligencia Artificial (Gemini)
app.post('/api/ai/vision', async (req, res) => {
  const { imageBase64, mode } = req.body; // mode: 'invoice' o 'inventory'
  
  try {
    const { GoogleGenAI } = require('@google/genai');
    // Usando la clave proporcionada por el usuario
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Instrucciones dependiendo del modo
    let promptText = '';
    if (mode === 'invoice') {
      promptText = `Analiza esta imagen que es una factura o ticket de un local de hostelería. 
      Devuelve ÚNICAMENTE un objeto JSON válido con las siguientes claves:
      - "total": el importe total numérico de la factura (solo el número).
      - "proveedor": el nombre de la empresa proveedora o restaurante.
      - "rawText": un breve resumen de lo que has encontrado (max 2 lineas).
      Si no puedes encontrar algo, pon null.`;
    } else {
      promptText = `Analiza esta imagen de una estantería o almacén de bebidas.
      Devuelve ÚNICAMENTE un objeto JSON válido con las siguientes claves:
      - "botellasEstimadas": número entero con la cantidad de botellas que ves.
      - "confianza": porcentaje (ej. "80%") de tu seguridad en el conteo.
      - "rawText": un resumen de los tipos de bebida que ves (max 2 lineas).
      Si no ves botellas, devuelve 0.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: promptText },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
      ]
    });

    // Limpiar la respuesta para asegurar que es JSON (quitar bloques de código markdown)
    let jsonText = response.text;
    if (jsonText.startsWith('\`\`\`json')) {
      jsonText = jsonText.replace(/\`\`\`json\n?/, '').replace(/\`\`\`$/, '');
    }
    
    const parsedData = JSON.parse(jsonText);

    res.json({ 
      success: true, 
      result: parsedData
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error procesando la imagen con IA', details: error.message });
  }
});

// Agenda de Eventos (Manager)
app.get('/api/eventos', (req, res) => {
  db.all('SELECT * FROM eventos ORDER BY fecha ASC, hora ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/eventos', (req, res) => {
  const { titulo, fecha, hora, descripcion, tipo } = req.body;
  db.run(`INSERT INTO eventos (titulo, fecha, hora, descripcion, tipo) VALUES (?, ?, ?, ?, ?)`,
    [titulo, fecha, hora, descripcion, tipo || 'General'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Evento creado' });
    }
  );
});

app.delete('/api/eventos/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM eventos WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Evento eliminado' });
  });
});

app.put('/api/eventos/:id', (req, res) => {
  const { id } = req.params;
  const { titulo, fecha, hora, descripcion, tipo } = req.body;
  db.run(`UPDATE eventos SET titulo = ?, fecha = ?, hora = ?, descripcion = ?, tipo = ? WHERE id = ?`,
    [titulo, fecha, hora, descripcion, tipo, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, mensaje: 'Evento actualizado' });
    }
  );
});

// Notas Rápidas
app.get('/api/notas', (req, res) => {
  db.all(`SELECT notas.*, usuarios.nombre as autor FROM notas LEFT JOIN usuarios ON notas.usuario_id = usuarios.id ORDER BY fijada DESC, creado_en DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/notas', (req, res) => {
  const { contenido, color, usuario_id } = req.body;
  db.run(`INSERT INTO notas (contenido, color, usuario_id) VALUES (?, ?, ?)`,
    [contenido, color || 'yellow', usuario_id || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Nota creada' });
    }
  );
});

app.put('/api/notas/:id', (req, res) => {
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

app.delete('/api/notas/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM notas WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Nota eliminada' });
  });
});

// Tareas (Checklist)
app.get('/api/tareas', (req, res) => {
  db.all(`SELECT tareas.*, usuarios.nombre as asignado_nombre FROM tareas LEFT JOIN usuarios ON tareas.asignado_a = usuarios.id ORDER BY tareas.completada ASC, CASE tareas.prioridad WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 WHEN 'baja' THEN 2 END, tareas.fecha ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/tareas', (req, res) => {
  const { titulo, descripcion, asignado_a, fecha, prioridad, local } = req.body;
  db.run(`INSERT INTO tareas (titulo, descripcion, asignado_a, fecha, prioridad, local) VALUES (?, ?, ?, ?, ?, ?)`,
    [titulo, descripcion || null, asignado_a || null, fecha, prioridad || 'normal', local || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Tarea creada' });
    }
  );
});

app.put('/api/tareas/:id', (req, res) => {
  const { id } = req.params;
  const { titulo, descripcion, asignado_a, fecha, prioridad, completada } = req.body;
  db.run(`UPDATE tareas SET titulo = ?, descripcion = ?, asignado_a = ?, fecha = ?, prioridad = ?, completada = ? WHERE id = ?`,
    [titulo, descripcion, asignado_a, fecha, prioridad, completada ? 1 : 0, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, mensaje: 'Tarea actualizada' });
    }
  );
});

// Toggle completada (shortcut)
app.patch('/api/tareas/:id/toggle', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE tareas SET completada = CASE WHEN completada = 1 THEN 0 ELSE 1 END WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Tarea actualizada' });
  });
});

app.delete('/api/tareas/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM tareas WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Tarea eliminada' });
  });
});

// Pedidos a Proveedores
app.get('/api/pedidos', (req, res) => {
  db.all(`SELECT pedidos.*, proveedores.telefono as proveedor_telefono FROM pedidos LEFT JOIN proveedores ON pedidos.proveedor_id = proveedores.id ORDER BY pedidos.creado_en DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/pedidos', (req, res) => {
  const { fecha, local, proveedor_id, proveedor_nombre, productos } = req.body;
  db.run(`INSERT INTO pedidos (fecha, local, proveedor_id, proveedor_nombre, productos) VALUES (?, ?, ?, ?, ?)`,
    [fecha, local, proveedor_id || null, proveedor_nombre, JSON.stringify(productos)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, mensaje: 'Pedido registrado' });
    }
  );
});

app.patch('/api/pedidos/:id/recibido', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE pedidos SET estado = 'recibido' WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Pedido marcado como recibido' });
  });
});

app.delete('/api/pedidos/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM pedidos WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, mensaje: 'Pedido eliminado' });
  });
});

// Promisify SQLite helpers for async/await inside AI logic
const dbRunAsync = (query, params) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) reject(err);
    else resolve(this);
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
          tipo: { type: "STRING", description: "Uno de: General, Mantenimiento, Proveedor, Reunion, Pinchada, Concierto" }
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
      description: "Modifica el stock actual de un producto sumando o restando unidades.",
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
      description: "Crea un nuevo turno para un empleado.",
      parameters: {
        type: "OBJECT",
        properties: {
          usuario_id: { type: "INTEGER", description: "ID del empleado" },
          fecha: { type: "STRING", description: "Formato YYYY-MM-DD" },
          hora_inicio: { type: "STRING", description: "HH:MM" },
          hora_fin: { type: "STRING", description: "HH:MM" }
        },
        required: ["usuario_id", "fecha", "hora_inicio", "hora_fin"]
      }
    }
  ]
}];

// Chatbot Asistente con Function Calling
app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  logger('info', `Nueva petición de chat: "${message}"`);
  let actionExecuted = false; // Flag to tell frontend to refresh
  
  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 1. Obtener contexto en tiempo real
    const usuarios = await dbAllAsync('SELECT id, nombre, rol FROM usuarios', []);
    const inventario = await dbAllAsync('SELECT id, producto, stock_actual FROM inventario', []);

    // 2. Construir Historial/Prompt
    const systemInstruction = `Eres "Salguabot", asistente del restaurante "Salguacate". 
HOY ES: ${new Date().toISOString().split('T')[0]}.
Tienes herramientas (functions) para modificar la base de datos si el usuario te lo pide.
Usa las herramientas SIEMPRE que el usuario te pida explícitamente añadir/borrar/asignar cosas.
Plantilla: ${JSON.stringify(usuarios)}
Inventario: ${JSON.stringify(inventario)}`;

    // Primera llamada a Gemini
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
      actionExecuted = true;
      
      try {
        if (call.name === 'crear_evento') {
          await dbRunAsync(`INSERT INTO eventos (titulo, fecha, hora, tipo) VALUES (?, ?, ?, ?)`, 
            [args.titulo, args.fecha, args.hora, args.tipo]);
          funcResult = { status: "success", message: "Evento insertado en base de datos" };
        } 
        else if (call.name === 'borrar_evento') {
          await dbRunAsync(`DELETE FROM eventos WHERE id = ?`, [args.id]);
          funcResult = { status: "success", message: "Evento eliminado" };
        }
        else if (call.name === 'modificar_stock') {
          await dbRunAsync(`UPDATE inventario SET stock_actual = stock_actual + ? WHERE id = ?`, 
            [args.cantidad, args.producto_id]);
          funcResult = { status: "success", message: `Stock actualizado` };
        }
        else if (call.name === 'asignar_turno') {
          await dbRunAsync(`INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, local) VALUES (?, ?, ?, ?, 'Principal')`,
            [args.usuario_id, args.fecha, args.hora_inicio, args.hora_fin]);
          funcResult = { status: "success", message: "Turno asignado" };
        }
      } catch (dbErr) {
        funcResult = { status: "error", message: dbErr.message };
        logger('error', 'Error ejecutando función de base de datos', dbErr);
      }

      // 4. Devolver resultado a Gemini para que genere la respuesta final en lenguaje natural
      response = await chatSession.sendMessage([{
        functionResponse: {
          name: call.name,
          response: funcResult
        }
      }]);
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
app.post('/api/ai/poster', async (req, res) => {
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger('info', `Servidor backend corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
