const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync, backup } = require('node:sqlite');
const { createDatabase } = require('./database');

const BUSINESS_TABLES = ['usuarios', 'fichajes', 'proveedores', 'inventario', 'turnos', 'mensajes', 'eventos', 'notas', 'cierres', 'gastos', 'tareas', 'pedidos', 'peticiones', 'audit_events'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const quote = name => '"' + name.replaceAll('"', '""') + '"';

function absolute(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('Se requiere una ruta absoluta explícita.');
  return path.resolve(value);
}

// Reject symlinks/junctions along the whole path, not only at the final entry.
function checkedPath(value, kind) {
  const resolved = absolute(value);
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('No se admiten enlaces simbólicos ni junctions.');
  }
  const stat = fs.statSync(resolved);
  if (kind === 'file' ? !stat.isFile() : !stat.isDirectory()) throw new Error('Tipo de ruta incorrecto.');
  return resolved;
}

function inside(child, parent) {
  const relative = path.relative(parent, child);
  return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function newDirectory(value, forbidden) {
  const output = absolute(value);
  checkedPath(path.dirname(output), 'directory');
  if (forbidden.some(source => inside(output, source) || inside(source, output))) throw new Error('Origen y destino deben estar separados.');
  // No recursive creation or overwrite. On failure the incomplete directory remains for inspection.
  fs.mkdirSync(output, { mode: 0o700 });
  return output;
}

function listFiles(root, prefix = '') {
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!/^[\p{L}\p{N}_. -]+$/u.test(entry.name) || entry.name === '.' || entry.name === '..') throw new Error('Nombre de archivo no admitido.');
    if (entry.isSymbolicLink()) throw new Error('No se admiten enlaces en los archivos.');
    if (entry.isDirectory()) result.push(...listFiles(root, name));
    else if (entry.isFile()) result.push(name);
    else throw new Error('Solo se admiten archivos regulares.');
  }
  return result.sort();
}

function metadata(filename) {
  const bytes = fs.readFileSync(checkedPath(filename, 'file'));
  return { size: bytes.length, sha256: hash(bytes) };
}

function checkDatabase(filename, standalone = false) {
  if (standalone) {
    const header = fs.readFileSync(checkedPath(filename, 'file')).subarray(0, 20);
    if (header[18] !== 1 || header[19] !== 1) throw new Error('La copia debe ser SQLite autónomo, sin depender de WAL.');
  }
  const db = new DatabaseSync(checkedPath(filename, 'file'), { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') throw new Error('Integridad SQLite incorrecta.');
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Existen relaciones huérfanas.');
    if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'usuarios'").get()) throw new Error('La base no contiene el esquema del ERP.');
    return true;
  } finally { db.close(); }
}

function checkUploads(filename, uploads) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    if (!db.prepare('PRAGMA table_info(inventario)').all().some(c => c.name === 'imagen_url')) return;
    for (const row of db.prepare("SELECT imagen_url FROM inventario WHERE imagen_url IS NOT NULL AND imagen_url != ''").all()) {
      if (typeof row.imagen_url !== 'string' || !row.imagen_url.startsWith('/uploads/')) throw new Error('Referencia de imagen no local; requiere conciliación.');
      const relative = row.imagen_url.slice('/uploads/'.length);
      if (!relative || relative.includes('\\') || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Referencia de imagen no válida.');
      const target = path.resolve(uploads, relative);
      if (!inside(target, uploads)) throw new Error('Referencia de imagen fuera de uploads.');
      checkedPath(target, 'file');
    }
  } finally { db.close(); }
}

function businessSnapshot(filename, previous) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const result = {};
    for (const name of BUSINESS_TABLES) {
      if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(name)) continue;
      const columns = previous?.[name]?.columns ?? db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(c => c.name);
      const rows = db.prepare(`SELECT ${columns.map(quote).join(',')} FROM ${quote(name)}`).all();
      result[name] = { columns, count: rows.length, sha256: hash(rows.map(row => JSON.stringify(row)).sort().join('\n')) };
    }
    return result;
  } finally { db.close(); }
}

function requireOffline(offline) {
  if (offline !== true) throw new Error('Detén las escrituras y confirma --offline. No se detienen servicios automáticamente.');
}

async function createBackup({ database, uploads, output, offline }) {
  requireOffline(offline);
  const source = checkedPath(database, 'file');
  const images = checkedPath(uploads, 'directory');
  if (inside(source, images)) throw new Error('La base no puede estar dentro de uploads.');
  checkDatabase(source);
  checkUploads(source, images);
  const names = listFiles(images);
  const originals = Object.fromEntries(names.map(name => [name, metadata(path.join(images, name))]));
  const destination = newDirectory(output, [source, images]);
  const db = new DatabaseSync(source, { readOnly: true });
  try { await backup(db, path.join(destination, 'database.sqlite')); }
  finally { db.close(); }
  // Normalize only our new snapshot. A portable artifact must not create or need WAL sidecars.
  const snapshot = new DatabaseSync(path.join(destination, 'database.sqlite'));
  try { snapshot.exec('PRAGMA journal_mode = DELETE'); }
  finally { snapshot.close(); }
  fs.mkdirSync(path.join(destination, 'uploads'), { mode: 0o700 });
  for (const name of names) {
    const target = path.join(destination, 'uploads', name);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.copyFileSync(checkedPath(path.join(images, name), 'file'), target, fs.constants.COPYFILE_EXCL);
    if (JSON.stringify(metadata(target)) !== JSON.stringify(originals[name])) throw new Error('Uploads cambió durante la copia. Copia incompleta.');
  }
  if (JSON.stringify(names) !== JSON.stringify(listFiles(images)) || names.some(name => JSON.stringify(metadata(path.join(images, name))) !== JSON.stringify(originals[name]))) {
    throw new Error('Uploads cambió durante la copia. Copia incompleta.');
  }
  checkDatabase(path.join(destination, 'database.sqlite'), true);
  checkUploads(path.join(destination, 'database.sqlite'), path.join(destination, 'uploads'));
  const files = ['database.sqlite', ...names.map(name => `uploads/${name}`)].map(name => ({ path: name, ...metadata(path.join(destination, name)) }));
  const manifest = { format: 1, createdAt: new Date().toISOString(), node: process.version, files };
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  verifyBackup(destination);
  return { output: destination, files: files.length, status: 'verified' };
}

function verifyBackup(directory) {
  const root = checkedPath(directory, 'directory');
  const manifestPath = checkedPath(path.join(root, 'manifest.json'), 'file');
  if (fs.statSync(manifestPath).size > 5 * 1024 * 1024) throw new Error('Manifiesto demasiado grande.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Formato de copia no admitido.');
  const seen = new Set();
  for (const file of manifest.files) {
    if (!file || typeof file.path !== 'string' || !(file.path === 'database.sqlite' || /^uploads\/(?:[\p{L}\p{N}_ .-]+\/)*[\p{L}\p{N}_ .-]+$/u.test(file.path)) || file.path.split('/').some(part => part === '.' || part === '..' || part.endsWith('.') || part.endsWith(' '))) throw new Error('Ruta de manifiesto no válida.');
    const key = file.path.toLowerCase();
    if (seen.has(key)) throw new Error('Archivo duplicado en el manifiesto.');
    seen.add(key);
    if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Metadatos no válidos.');
    const actual = metadata(path.join(root, file.path));
    if (file.size !== actual.size || file.sha256 !== actual.sha256) throw new Error(`Archivo alterado o incompleto: ${file.path}`);
  }
  if (!seen.has('database.sqlite')) throw new Error('Falta la base de datos.');
  const actualNames = listFiles(root);
  const expected = [...manifest.files.map(file => file.path), 'manifest.json'].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expected)) throw new Error('Hay archivos no declarados en la copia.');
  checkDatabase(path.join(root, 'database.sqlite'), true);
  checkUploads(path.join(root, 'database.sqlite'), path.join(root, 'uploads'));
  return manifest;
}

async function restoreBackup({ source, output, offline }) {
  requireOffline(offline);
  const root = checkedPath(source, 'directory');
  const manifest = verifyBackup(root);
  const destination = newDirectory(output, [root]);
  fs.mkdirSync(path.join(destination, 'uploads'), { mode: 0o700 });
  for (const file of manifest.files) {
    const target = path.join(destination, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.copyFileSync(checkedPath(path.join(root, file.path), 'file'), target, fs.constants.COPYFILE_EXCL);
    const actual = metadata(target);
    if (actual.sha256 !== file.sha256 || actual.size !== file.size) throw new Error('La copia cambió durante la restauración.');
  }
  const filename = path.join(destination, 'database.sqlite');
  checkDatabase(filename);
  const before = businessSnapshot(filename);
  const migrated = createDatabase(filename);
  await migrated.ready;
  let sessionsRevoked;
  try {
    sessionsRevoked = Number(migrated.connection.prepare('DELETE FROM sessions').run().changes);
    migrated.connection.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } finally { migrated.close(); }
  checkDatabase(filename);
  const after = businessSnapshot(filename, before);
  for (const [table, snapshot] of Object.entries(before)) {
    if (JSON.stringify(after[table]) !== JSON.stringify(snapshot)) throw new Error(`La migración alteró datos existentes: ${table}`);
  }
  const report = { format: 1, status: 'verified', createdAt: new Date().toISOString(), sessionsRevoked,
    tables: Object.fromEntries(Object.entries(after).map(([name, item]) => [name, { count: item.count, sha256: item.sha256 }])) };
  fs.writeFileSync(path.join(destination, 'recovery.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { output: destination, ...report };
}

module.exports = { createBackup, verifyBackup, restoreBackup };
