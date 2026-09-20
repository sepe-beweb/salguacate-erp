const { writeAsActor } = require('../authorization');
const { asyncRoute } = require('../security');
const { HttpError } = require('../http');
const { LOCALS, validDate, validId, text, requireValid, activeUser } = require('../validation');
const { createOnce } = require('../idempotency');

function checkLocal(user, local) {
  requireValid(LOCALS.includes(local), 'Selecciona un local concreto.');
  if (user.rol === 'employee' && user.local !== local) throw new HttpError(403, 'No puedes acceder al relevo de otro local.');
}
function applies(frequency, date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return frequency === 'diaria' || (frequency === 'laborables' ? day >= 1 && day <= 5 : day === 0 || day === 6);
}
const audit = (sql, user, action, id) => sql.prepare('INSERT INTO audit_events (actor_id, action, entity_id) VALUES (?, ?, ?)').run(user.id, action, String(id));
const noticesQuery = `SELECT r.*, a.nombre AS autor_nombre, u.nombre AS resuelto_nombre,
  g.responsable_id, p.nombre AS responsable_nombre,
  CASE WHEN p.active = 1 AND (p.rol = 'owner' OR p.local = r.local) THEN 1 ELSE 0 END AS responsable_disponible,
  COALESCE(g.prioridad, 'normal') AS prioridad, COALESCE(g.revision, 1) AS revision,
  CASE WHEN r.resuelto_por IS NOT NULL THEN 'resuelto' ELSE COALESCE(g.estado, 'pendiente') END AS estado
  FROM relevos r JOIN usuarios a ON a.id = r.autor_id LEFT JOIN usuarios u ON u.id = r.resuelto_por
  LEFT JOIN relevo_gestion g ON g.relevo_id = r.id LEFT JOIN usuarios p ON p.id = g.responsable_id`;
async function readNotices(sql, local) {
  const entries = await sql.prepare(`${noticesQuery} WHERE r.local = ? ORDER BY r.fecha DESC, r.id DESC`).all(local);
  const readings = await sql.prepare(`SELECT l.*, u.nombre AS usuario_nombre FROM relevo_lecturas l JOIN relevos r ON r.id = l.relevo_id
    JOIN usuarios u ON u.id = l.usuario_id WHERE r.local = ? ORDER BY l.leido_en, l.usuario_id`).all(local);
  const changes = await sql.prepare(`SELECT c.*, u.nombre AS actor_nombre FROM relevo_cambios c JOIN relevos r ON r.id = c.relevo_id
    JOIN usuarios u ON u.id = c.actor_id WHERE r.local = ? ORDER BY c.id DESC`).all(local);
  return entries.map(r => ({ ...r, lecturas: readings.filter(l => l.relevo_id === r.id), cambios: changes.filter(c => c.relevo_id === r.id) }));
}
async function manageNotice(sql, req, entry, desired) {
  const { responsable_id, prioridad, estado, revision } = desired;
  requireValid((responsable_id === null || validId(responsable_id)) && ['normal', 'alta'].includes(prioridad) &&
    ['pendiente', 'en_curso', 'resuelto'].includes(estado) && Number.isSafeInteger(revision) && revision > 0, 'Gestión del aviso inválida.');
  const target = responsable_id === null ? null : Number(responsable_id);
  if (req.user.rol === 'employee' && (entry.responsable_id !== req.user.id || target !== req.user.id || prioridad !== entry.prioridad || estado !== 'en_curso' || entry.estado === 'resuelto'))
    throw new HttpError(403, 'Solo puedes poner en curso un aviso asignado a ti; la dirección asigna y resuelve.');
  if (entry.responsable_id === target && entry.prioridad === prioridad && entry.estado === estado) return;
  if (revision !== entry.revision) throw new HttpError(409, 'El aviso ha cambiado. Actualiza y revisa su estado antes de guardar.');
  let person;
  if (target !== null && (target !== entry.responsable_id || estado === 'en_curso')) {
    person = await activeUser({ connection: sql }, target);
    requireValid(person.rol === 'owner' || person.local === entry.local, 'La persona no pertenece al local del aviso.');
  }
  requireValid(estado !== 'en_curso' || target !== null, 'Asigna un responsable antes de iniciar el aviso.');
  await sql.prepare(`INSERT INTO relevo_gestion (relevo_id, responsable_id, prioridad, estado, revision) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(relevo_id) DO UPDATE SET responsable_id=excluded.responsable_id, prioridad=excluded.prioridad, estado=excluded.estado, revision=excluded.revision`)
    .run(entry.id, target, prioridad, estado === 'resuelto' ? 'pendiente' : estado, entry.revision + 1);
  if (estado !== entry.estado) await sql.prepare('UPDATE relevos SET resuelto_por = ?, resuelto_en = ? WHERE id = ?')
    .run(estado === 'resuelto' ? req.user.id : null, estado === 'resuelto' ? new Date().toISOString() : null, entry.id);
  const assigned = target === null ? 'Sin responsable' : (await sql.prepare('SELECT nombre FROM usuarios WHERE id = ?').get(target)).nombre;
  await sql.prepare('INSERT INTO relevo_cambios (relevo_id, actor_id, detalle) VALUES (?, ?, ?)')
    .run(entry.id, req.user.id, `${estado === 'en_curso' ? 'En curso' : estado === 'resuelto' ? 'Resuelto' : 'Pendiente'} · Prioridad ${prioridad} · ${assigned}`);
  await audit(sql, req.user, estado === 'resuelto' && entry.estado !== estado ? 'handover.resolved' : 'handover.updated', entry.id);
}

function registerHandover(app, { db, requireAuth, requireRole }) {
  const manage = requireRole(['owner', 'manager']);
  app.get('/api/jornada', requireAuth, asyncRoute(async (req, res) => {
    const { local, fecha } = req.query;
    checkLocal(req.user, local); requireValid(validDate(fecha), 'Fecha inválida.');
    const result = await writeAsActor(db, req, async sql => {
      const rutinas = await sql.prepare('SELECT * FROM rutinas WHERE local = ? ORDER BY id').all(local);
      const tareas = await sql.prepare(`SELECT t.*, r.titulo AS rutina_titulo, r.fase, u.nombre AS completado_nombre
        FROM tareas t JOIN rutina_ejecuciones e ON e.id = t.rutina_ejecucion_id
        JOIN rutinas r ON r.id = e.rutina_id LEFT JOIN usuarios u ON u.id = t.completado_por
        WHERE t.local = ? AND t.fecha = ? ORDER BY r.fase, r.id, t.id`).all(local, fecha);
      const ejecuciones = await sql.prepare(`SELECT e.* FROM rutina_ejecuciones e JOIN rutinas r ON r.id = e.rutina_id
        WHERE r.local = ? AND e.fecha = ? ORDER BY e.id`).all(local, fecha);
      // Open notices remain visible across dates; reading this endpoint never acknowledges them.
      const relevos = await readNotices(sql, local);
      const responsables = await sql.prepare("SELECT id, nombre FROM usuarios WHERE active = 1 AND (rol = 'owner' OR local = ?) ORDER BY nombre, id").all(local);
      return { local, fecha, rutinas: rutinas.map(r => ({ ...r, pasos: JSON.parse(r.pasos_json) })), tareas, ejecuciones,
        relevos, responsables };
    });
    res.json(result);
  }));

  app.get('/api/relevos/resumen', requireAuth, asyncRoute(async (req, res) => {
    const { local, fecha } = req.query;
    requireValid(validDate(fecha) && [...LOCALS, 'Todos'].includes(local), 'Local o fecha inválidos.');
    if (req.user.rol === 'employee') checkLocal(req.user, local);
    const result = await writeAsActor(db, req, async sql => {
      const locales = [];
      for (const place of local === 'Todos' ? LOCALS : [local]) {
        const notices = await readNotices(sql, place); const pending = notices.filter(r => r.estado !== 'resuelto');
        const tasks = await sql.prepare('SELECT completada FROM tareas WHERE rutina_ejecucion_id IS NOT NULL AND local = ? AND fecha = ?').all(place, fecha);
        locales.push({ local: place, pendientes: pending.length, sin_leer: pending.filter(r => !r.lecturas.some(l => l.usuario_id === req.user.id)).length,
          asignados: pending.filter(r => r.responsable_id === req.user.id).length, sin_responsable: pending.filter(r => r.responsable_id === null || !r.responsable_disponible).length,
          pasos: tasks.length, completados: tasks.filter(t => t.completada === 1).length });
      }
      return { fecha, locales };
    });
    res.json(result);
  }));

  app.put('/api/relevos/:id/gestion', requireAuth, asyncRoute(async (req, res) => {
    await writeAsActor(db, req, async sql => {
      const entry = await sql.prepare(`${noticesQuery} WHERE r.id = ?`).get(req.params.id);
      if (!entry) throw new HttpError(404, 'Aviso no encontrado.');
      checkLocal(req.user, entry.local); await manageNotice(sql, req, entry, req.body);
    });
    res.json({ mensaje: 'Gestión guardada.' });
  }));

  app.post('/api/rutinas', requireAuth, manage, asyncRoute(async (req, res) => {
    const { local, titulo, fase, frecuencia, pasos } = req.body;
    checkLocal(req.user, local);
    requireValid(text(titulo, 120) && ['apertura', 'cierre'].includes(fase) && ['diaria', 'laborables', 'fin_semana'].includes(frecuencia) &&
      Array.isArray(pasos) && pasos.length > 0 && pasos.length <= 30 && pasos.every(p => text(p, 160)), 'Rutina inválida: incluye entre 1 y 30 pasos de hasta 160 caracteres.');
    requireValid(Boolean(req.get('Idempotency-Key')), 'Falta la clave de guardado.');
    const result = await createOnce(db, req, 'routine.create', [local, titulo, fase, frecuencia, pasos], 201, async sql => {
      const id = Number((await sql.prepare('INSERT INTO rutinas (local, titulo, fase, frecuencia, pasos_json, autor_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(local, titulo, fase, frecuencia, JSON.stringify(pasos), req.user.id)).lastInsertRowid);
      await audit(sql, req.user, 'routine.created', id); return { id };
    });
    res.status(result.status).json(result.body);
  }));

  app.put('/api/rutinas/:id/archivar', requireAuth, manage, asyncRoute(async (req, res) => {
    await writeAsActor(db, req, async sql => {
      const routine = await sql.prepare('SELECT * FROM rutinas WHERE id = ?').get(req.params.id);
      if (!routine) throw new HttpError(404, 'Rutina no encontrada.');
      if (routine.activa) {
        await sql.prepare('UPDATE rutinas SET activa = 0 WHERE id = ?').run(routine.id);
        await audit(sql, req.user, 'routine.archived', routine.id);
      }
    });
    res.json({ mensaje: 'Rutina archivada. Sus tareas e historial se conservan.' });
  }));

  app.post('/api/rutinas/preparar', requireAuth, manage, asyncRoute(async (req, res) => {
    const { local, fecha } = req.body;
    checkLocal(req.user, local); requireValid(validDate(fecha), 'Fecha inválida.');
    const result = await writeAsActor(db, req, async sql => {
      const routines = await sql.prepare('SELECT * FROM rutinas WHERE local = ? AND activa = 1 ORDER BY id').all(local);
      let creadas = 0;
      for (const routine of routines) {
        if (!applies(routine.frecuencia, fecha)) continue;
        const inserted = await sql.prepare('INSERT INTO rutina_ejecuciones (rutina_id, fecha, preparado_por) VALUES (?, ?, ?) ON CONFLICT (rutina_id, fecha) DO NOTHING')
          .run(routine.id, fecha, req.user.id);
        if (!inserted.changes) continue;
        const execution = Number(inserted.lastInsertRowid);
        for (const step of JSON.parse(routine.pasos_json)) {
          await sql.prepare(`INSERT INTO tareas (titulo, descripcion, fecha, prioridad, local, completada, rutina_ejecucion_id)
            VALUES (?, ?, ?, 'normal', ?, 0, ?)`).run(step, `${routine.titulo} · ${routine.fase}`, fecha, local, execution);
          creadas++;
        }
        await audit(sql, req.user, 'routine.prepared', execution);
      }
      return { creadas };
    });
    res.json(result);
  }));

  app.post('/api/relevos', requireAuth, asyncRoute(async (req, res) => {
    const { local, fecha, contenido } = req.body;
    checkLocal(req.user, local); requireValid(validDate(fecha) && text(contenido, 3000), 'Indica una fecha y un aviso de hasta 3000 caracteres.');
    requireValid(Boolean(req.get('Idempotency-Key')), 'Falta la clave de guardado.');
    const result = await createOnce(db, req, 'handover.create', [local, fecha, contenido], 201, async sql => {
      const id = Number((await sql.prepare('INSERT INTO relevos (local, fecha, contenido, autor_id) VALUES (?, ?, ?, ?)')
        .run(local, fecha, contenido, req.user.id)).lastInsertRowid);
      await audit(sql, req.user, 'handover.created', id); return { id };
    });
    res.status(result.status).json(result.body);
  }));

  for (const action of ['leer', 'resolver']) {
    app.put(`/api/relevos/:id/${action}`, requireAuth, ...(action === 'resolver' ? [manage] : []), asyncRoute(async (req, res) => {
      await writeAsActor(db, req, async sql => {
        const entry = await sql.prepare(`${noticesQuery} WHERE r.id = ?`).get(req.params.id);
        if (!entry) throw new HttpError(404, 'Aviso no encontrado.');
        checkLocal(req.user, entry.local);
        if (action === 'leer') {
          const result = await sql.prepare('INSERT INTO relevo_lecturas (relevo_id, usuario_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(entry.id, req.user.id);
          if (result.changes) await audit(sql, req.user, 'handover.read', entry.id);
        } else if (entry.resuelto_por === null) {
          await manageNotice(sql, req, entry, { responsable_id: entry.responsable_id, prioridad: entry.prioridad, estado: 'resuelto', revision: entry.revision });
        }
      });
      res.json({ mensaje: action === 'leer' ? 'Lectura registrada.' : 'Aviso resuelto.' });
    }));
  }
}
module.exports = { registerHandover, applies };
