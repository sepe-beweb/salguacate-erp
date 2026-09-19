function sendDatabaseError(res, error) {
  const conflict = /constraint|UNIQUE/i.test(error.message);
  return res.status(conflict ? 409 : 500).json({ error: conflict ? 'La operación entra en conflicto con los datos existentes.' : 'No se pudo completar la operación.' });
}

const canManageStaff = user => ['owner', 'manager'].includes(user?.rol);
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
module.exports = { sendDatabaseError, canManageStaff, HttpError };
