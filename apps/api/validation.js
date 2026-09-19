const { HttpError } = require('./http');

const LOCALS = ['Principal', 'Segundo Local'];
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validId = value => ['string', 'number'].includes(typeof value) && /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const text = (value, max, allowEmpty = false) => typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
const boolean = value => [true, false, 0, 1].includes(value);
function requireValid(condition, message) {
  if (!condition) throw new HttpError(400, message);
}
async function activeUser(db, id) {
  requireValid(validId(id), 'Identificador de usuario inválido.');
  const user = (await db.connection.prepare('SELECT id, local, rol FROM usuarios WHERE id = ? AND active = 1').get(Number(id)));
  if (!user) throw new HttpError(404, 'Usuario activo no encontrado.');
  return user;
}
module.exports = { LOCALS, validDate, validTime, validId, text, boolean, requireValid, activeUser };
