const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { readConfig } = require('../config');
const { createDatabase } = require('../database');
const { hashPin, validPin } = require('../security');

async function bootstrap() {
  const config = readConfig();
  const name = process.env.BOOTSTRAP_OWNER_NAME?.trim();
  const pin = process.env.BOOTSTRAP_OWNER_PIN;
  if (!name || name.length > 120 || !validPin(pin)) throw new Error('Set BOOTSTRAP_OWNER_NAME and BOOTSTRAP_OWNER_PIN (6-8 digits, not a repeated digit).');
  const db = createDatabase(config.filename);
  await db.ready;
  try {
    const hashed = await hashPin(pin);
    db.transaction(sql => {
      if (sql.prepare('SELECT count(*) AS n FROM usuarios').get().n !== 0) throw new Error('Bootstrap only works on an empty user table; no accounts were changed.');
      sql.prepare("INSERT INTO usuarios (nombre, rol, local, pin, must_change_pin) VALUES (?, 'owner', 'Todos', ?, 0)").run(name, hashed);
    });
    console.log('Owner created. No sample records were inserted.');
  } finally { db.close(); }
}
bootstrap().catch(error => { console.error(error.message); process.exitCode = 1; });
