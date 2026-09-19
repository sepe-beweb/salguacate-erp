const { HttpError } = require('./http');

async function assertCurrentSession(sql, req) {
  const actor = await sql.prepare(`SELECT u.id, u.rol, u.auth_version, u.must_change_pin, u.local
    FROM sessions s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1 AND s.auth_version = u.auth_version`).get(req.tokenHash, Date.now());
  if (!actor || actor.id !== req.user.id || actor.rol !== req.user.rol || actor.auth_version !== req.user.auth_version ||
      actor.must_change_pin !== req.user.must_change_pin || actor.local !== req.user.local) {
    throw new HttpError(401, 'Sesión caducada o revocada. Vuelve a acceder.');
  }
}

function writeAsActor(db, req, work) {
  return db.transaction(async sql => {
    await assertCurrentSession(sql, req);
    return work(sql);
  });
}

async function runWrite(db, req, query, args, callback) {
  let result;
  try { result = await writeAsActor(db, req, sql => sql.prepare(query).run(...args)); }
  catch (error) { if (callback) return callback(error); throw error; }
  if (!callback) return result;
  return callback.call({ lastID: result.lastInsertRowid, changes: result.changes }, null);
}

module.exports = { assertCurrentSession, writeAsActor, runWrite };
