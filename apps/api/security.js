const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const PIN_PATTERN = /^\d{6,8}$/;
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

function validPin(pin) {
  return typeof pin === 'string' && PIN_PATTERN.test(pin) && !/^(\d)\1+$/.test(pin);
}

async function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(pin, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt}$${key.toString('hex')}`;
}

async function verifyPin(pin, stored) {
  if (typeof stored !== 'string') { await hashPin(pin); return false; }
  if (stored.startsWith('scrypt$')) {
    const [, salt, expected] = stored.split('$');
    if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(expected || '')) return false;
    const actual = await scrypt(pin, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  }
  // Legacy formats are accepted only for an upgrade; never accept a hash as the PIN.
  const actual = /^[a-f0-9]{64}$/.test(stored) ? hashToken(pin) : pin;
  const left = Buffer.from(actual);
  const right = Buffer.from(stored);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createSecurity(db) {
  const sql = db.connection;
  const audit = (actor, action, id) => sql.prepare('INSERT INTO audit_events (actor_id, action, entity_id) VALUES (?, ?, ?)').run(actor, action, String(id));
  const requireAuth = (req, res, next) => {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.get('authorization') || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Sesión no válida. Vuelve a acceder.' });
    req.tokenHash = hashToken(token);
    const user = sql.prepare(`SELECT u.id, u.nombre, u.rol, u.local, u.must_change_pin, u.auth_version
      FROM sessions s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1 AND s.auth_version = u.auth_version`).get(req.tokenHash, Date.now());
    if (!user) return res.status(401).json({ error: 'Sesión caducada o revocada. Vuelve a acceder.' });
    req.user = user;
    if (user.must_change_pin && !['/api/auth/pin', '/api/logout'].includes(req.path)) {
      return res.status(403).json({ error: 'Debes renovar tu PIN.', code: 'PIN_CHANGE_REQUIRED' });
    }
    next();
  };
  const requireRole = roles => (req, res, next) => roles.includes(req.user?.rol) ? next() : res.status(403).json({ error: 'Acceso no autorizado para tu rol' });

  function consumeLoginLimit(req, id) {
    const now = Date.now();
    return db.transaction(() => {
      sql.prepare('DELETE FROM login_limits WHERE expires_at <= ?').run(now);
      const buckets = [[`user:${id}`, 8], [`ip:${req.ip}`, 40], ['global', 200]];
      if (buckets.some(([key, max]) => (sql.prepare('SELECT attempts FROM login_limits WHERE bucket = ?').get(hashToken(key))?.attempts || 0) >= max)) return false;
      for (const [key] of buckets) sql.prepare(`INSERT INTO login_limits VALUES (?, 1, ?)
        ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1`).run(hashToken(key), now + 15 * 60 * 1000);
      return true;
    });
  }

  function register(app) {
    app.post('/api/login', asyncRoute(async (req, res) => {
      const { usuario_id, pin } = req.body;
      if (!['string', 'number'].includes(typeof usuario_id) || !/^\d+$/.test(String(usuario_id)) || !Number.isSafeInteger(Number(usuario_id)) || Number(usuario_id) < 1 || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
        return res.status(400).json({ error: 'Usuario o PIN inválido.' });
      }
      if (!consumeLoginLimit(req, Number(usuario_id))) {
        res.set('Retry-After', '900');
        return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
      }
      const row = sql.prepare('SELECT * FROM usuarios WHERE id = ? AND active = 1').get(Number(usuario_id));
      if (!await verifyPin(pin, row?.pin)) return res.status(401).json({ error: 'PIN incorrecto' });
      const upgraded = row.pin.startsWith('scrypt$') ? row.pin : await hashPin(pin);
      const token = crypto.randomBytes(32).toString('hex');
      const current = db.transaction(() => {
        const user = sql.prepare('SELECT * FROM usuarios WHERE id = ? AND active = 1').get(row.id);
        if (!user || user.pin !== row.pin || user.auth_version !== row.auth_version) return null;
        sql.prepare('UPDATE usuarios SET pin = ? WHERE id = ?').run(upgraded, row.id);
        sql.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
        sql.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(hashToken(token), row.id, user.auth_version, Date.now() + 8 * 60 * 60 * 1000);
        sql.prepare('DELETE FROM login_limits WHERE bucket = ?').run(hashToken(`user:${Number(usuario_id)}`));
        audit(row.id, 'session.created', row.id);
        return user;
      });
      if (!current) return res.status(401).json({ error: 'Credenciales modificadas. Vuelve a acceder.' });
      const { id, nombre, rol, local, must_change_pin } = current;
      res.json({ success: true, user: { id, nombre, rol, local, must_change_pin: Boolean(must_change_pin) }, token });
    }));
    app.post('/api/logout', requireAuth, (req, res) => {
      sql.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.tokenHash);
      res.status(204).end();
    });
    app.put('/api/auth/pin', requireAuth, asyncRoute(async (req, res) => {
      const { currentPin, newPin } = req.body;
      if (!validPin(newPin) || typeof currentPin !== 'string' || currentPin.length > 8 || newPin === currentPin) {
        return res.status(400).json({ error: 'Usa un PIN nuevo de 6 a 8 dígitos, sin repetir siempre el mismo dígito.' });
      }
      if (!consumeLoginLimit(req, req.user.id)) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
      const previous = sql.prepare('SELECT pin FROM usuarios WHERE id = ?').get(req.user.id);
      if (!await verifyPin(currentPin, previous.pin)) return res.status(401).json({ error: 'PIN actual incorrecto.' });
      const pin = await hashPin(newPin);
      const changed = db.transaction(() => {
        const result = sql.prepare('UPDATE usuarios SET pin = ?, must_change_pin = 0, auth_version = auth_version + 1 WHERE id = ? AND pin = ? AND active = 1').run(pin, req.user.id, previous.pin);
        if (!result.changes) return false;
        sql.prepare('DELETE FROM sessions WHERE usuario_id = ?').run(req.user.id);
        audit(req.user.id, 'pin.changed', req.user.id);
        return true;
      });
      if (!changed) return res.status(409).json({ error: 'El usuario cambió durante la operación. Vuelve a acceder.' });
      res.json({ success: true, message: 'PIN actualizado. Vuelve a acceder.' });
    }));
    app.get('/api/usuarios/public', (req, res) => res.json(sql.prepare('SELECT id, nombre, rol FROM usuarios WHERE active = 1').all()));
    app.get('/api/usuarios', requireAuth, requireRole(['owner', 'manager']), (req, res) => res.json(sql.prepare('SELECT id, nombre, rol, local, telefono, 1 AS has_pin FROM usuarios WHERE active = 1').all()));

    function validateStaff(req, res) {
      const { nombre, rol = 'employee', local = 'Principal', telefono = '', pin } = req.body;
      if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 120 || !['owner', 'manager', 'employee'].includes(rol) || !['Principal', 'Segundo Local', 'Todos'].includes(local) || typeof telefono !== 'string' || telefono.length > 40 || (pin && !validPin(pin))) {
        res.status(400).json({ error: 'Datos de empleado o PIN inválidos (6 a 8 dígitos).' });
        return null;
      }
      if (req.user.rol !== 'owner' && rol !== 'employee') {
        res.status(403).json({ error: 'Solo propietarios pueden asignar roles administrativos' });
        return null;
      }
      return { nombre: nombre.trim(), rol, local, telefono, pin };
    }
    const actorStillAllowed = (req, res) => {
      const actor = sql.prepare('SELECT rol, active, auth_version FROM usuarios WHERE id = ?').get(req.user.id);
      if (!actor?.active || actor.auth_version !== req.user.auth_version || actor.rol !== req.user.rol) {
        res.status(401).json({ error: 'Sesión revocada. Vuelve a acceder.' });
        return false;
      }
      return true;
    };
    app.post('/api/usuarios', requireAuth, requireRole(['owner', 'manager']), asyncRoute(async (req, res) => {
      const user = validateStaff(req, res);
      if (!user) return;
      if (!validPin(user.pin)) return res.status(400).json({ error: 'Indica un PIN de 6 a 8 dígitos.' });
      const pin = await hashPin(user.pin);
      if (!actorStillAllowed(req, res)) return;
      const id = db.transaction(() => {
        const result = sql.prepare('INSERT INTO usuarios (nombre, rol, local, telefono, pin, must_change_pin) VALUES (?, ?, ?, ?, ?, 0)').run(user.nombre, user.rol, user.local, user.telefono, pin);
        audit(req.user.id, 'user.created', result.lastInsertRowid);
        return Number(result.lastInsertRowid);
      });
      res.status(201).json({ id, mensaje: 'Empleado creado' });
    }));
    app.put('/api/usuarios/:id', requireAuth, requireRole(['owner', 'manager']), asyncRoute(async (req, res) => {
      const user = validateStaff(req, res);
      if (!user) return;
      const pin = user.pin ? await hashPin(user.pin) : null;
      if (!actorStillAllowed(req, res)) return;
      const outcome = db.transaction(() => {
        const target = sql.prepare('SELECT * FROM usuarios WHERE id = ? AND active = 1').get(req.params.id);
        if (!target) return { status: 404, body: { error: 'Usuario no encontrado' } };
        if (req.user.rol !== 'owner' && target.rol !== 'employee') return { status: 403, body: { error: 'Solo propietarios pueden editar usuarios administrativos' } };
        if (target.rol === 'owner' && user.rol !== 'owner' && sql.prepare("SELECT count(*) AS n FROM usuarios WHERE active = 1 AND rol = 'owner'").get().n <= 1) return { status: 409, body: { error: 'Debe quedar al menos un propietario activo.' } };
        sql.prepare('UPDATE usuarios SET nombre = ?, rol = ?, local = ?, telefono = ?, pin = ?, must_change_pin = ?, auth_version = auth_version + 1 WHERE id = ?').run(user.nombre, user.rol, user.local, user.telefono, pin || target.pin, pin ? 0 : target.must_change_pin, target.id);
        sql.prepare('DELETE FROM sessions WHERE usuario_id = ?').run(target.id);
        audit(req.user.id, 'user.updated', target.id);
        return { status: 200, body: { id: target.id, mensaje: 'Empleado actualizado; sesiones revocadas' } };
      });
      res.status(outcome.status).json(outcome.body);
    }));
    app.delete('/api/usuarios/:id', requireAuth, requireRole(['owner']), (req, res) => {
      const outcome = db.transaction(() => {
        const target = sql.prepare('SELECT id, rol FROM usuarios WHERE id = ? AND active = 1').get(req.params.id);
        if (!target) return { status: 404, body: { error: 'Usuario no encontrado' } };
        if (target.rol === 'owner' && sql.prepare("SELECT count(*) AS n FROM usuarios WHERE active = 1 AND rol = 'owner'").get().n <= 1) return { status: 409, body: { error: 'No se puede desactivar al último propietario.' } };
        sql.prepare('UPDATE usuarios SET active = 0, auth_version = auth_version + 1 WHERE id = ?').run(target.id);
        sql.prepare('DELETE FROM sessions WHERE usuario_id = ?').run(target.id);
        audit(req.user.id, 'user.deactivated', target.id);
        return { status: 200, body: { id: target.id, mensaje: 'Empleado desactivado. Se conserva su historial.' } };
      });
      res.status(outcome.status).json(outcome.body);
    });
  }
  return { requireAuth, requireRole, register };
}

module.exports = { createSecurity, hashPin, verifyPin, validPin, asyncRoute };
