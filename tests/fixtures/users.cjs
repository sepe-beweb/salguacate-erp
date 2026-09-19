const { hashPin } = require('../../apps/api/security');
// Credentials are exclusive to disposable tests. Never loaded by the server/bootstrap.
const TEST_PIN = '246810';
async function seedTestUsers(db) {
  const pin = await hashPin(TEST_PIN);
  const insert = db.connection.prepare('INSERT INTO usuarios (nombre, rol, local, pin, must_change_pin) VALUES (?, ?, ?, ?, ?)');
  insert.run('Jefe Admin', 'owner', 'Todos', pin, 0);
  insert.run('Encargado Principal', 'manager', 'Principal', pin, 0);
  insert.run('María García', 'employee', 'Principal', pin, 0);
  insert.run('Cuenta Antigua', 'employee', 'Principal', '0000', 1);
}
module.exports = { seedTestUsers, TEST_PIN };
