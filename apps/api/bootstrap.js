const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createDatabase } = require('./database');
const { hashPin, validPin } = require('./security');

async function bootstrapOwner({ filename, name, pin, newDatabase = false }) {
  const normalized = typeof name === 'string' ? name.trim() : '';
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) throw new Error('Bootstrap requires an absolute database path.');
  if (!normalized || normalized.length > 120 || !validPin(pin)) throw new Error('Provide an owner name and a PIN of 6-8 digits, not a repeated digit.');
  // Refuse populated legacy databases before initialization can migrate them.
  if (!newDatabase && fs.existsSync(filename)) {
    const existing = new DatabaseSync(filename, { readOnly: true });
    try {
      if (existing.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'usuarios'").get() &&
        existing.prepare('SELECT count(*) AS n FROM usuarios').get().n !== 0) throw new Error('Bootstrap only works on an empty user table; no accounts were changed.');
    } finally { existing.close(); }
  }
  const hashed = await hashPin(pin);
  if (newDatabase) {
    // Atomic exclusive creation: neither an existing empty database nor a race is overwritten.
    const file = fs.openSync(filename, 'wx', 0o600);
    fs.closeSync(file);
  }
  const db = createDatabase(filename);
  await db.ready;
  try {
    return db.transaction(sql => {
      if (sql.prepare('SELECT count(*) AS n FROM usuarios').get().n !== 0) throw new Error('Bootstrap only works on an empty user table; no accounts were changed.');
      const row = sql.prepare("INSERT INTO usuarios (nombre, rol, local, pin, must_change_pin) VALUES (?, 'owner', 'Todos', ?, 0)").run(normalized, hashed);
      return { id: Number(row.lastInsertRowid) };
    });
  } finally { db.close(); }
}

module.exports = { bootstrapOwner };
