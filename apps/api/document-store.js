const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { HttpError } = require('./http');
const MAX_FILE = 10 * 1024 * 1024;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (child, parent) => { const rel = path.relative(parent, child); return !rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
function safeDirectory(value) {
  if (!path.isAbsolute(value)) throw new Error('Document storage requires an absolute path.');
  fs.mkdirSync(value, { recursive: true, mode: 0o700 });
  let current = path.parse(value).root;
  for (const part of value.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Document storage cannot contain symbolic links.');
  }
  return fs.realpathSync(value);
}
function decodeDocument(file) {
  if (!file || typeof file.nombre !== 'string' || !file.nombre.trim() || file.nombre.length > 180 || /[\x00-\x1f\\/]/.test(file.nombre) || typeof file.base64 !== 'string' || file.base64.length > Math.ceil(MAX_FILE / 3) * 4)
    throw new HttpError(400, 'Archivo inválido. Máximo 10 MB por documento.');
  const bytes = Buffer.from(file.base64, 'base64');
  if (!bytes.length || bytes.length > MAX_FILE || bytes.toString('base64') !== file.base64) throw new HttpError(400, 'Contenido de archivo inválido.');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  const pdf = bytes.toString('ascii', 0, 5) === '%PDF-' && bytes.subarray(-1024).includes(Buffer.from('%%EOF'));
  const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : pdf ? 'application/pdf' : null;
  if (!mime || mime !== file.mime) throw new HttpError(400, 'Solo se admiten PDF, JPEG, PNG o WebP con formato reconocido.');
  // A conservative block, not a malware scanner. PDFs are never served publicly or executed by the application.
  if (pdf && /\/(?:JavaScript|JS|Launch|EmbeddedFile|AA|RichMedia|Encrypt|URI)\b|\/OpenAction\s*<</.test(bytes.toString('latin1')))
    throw new HttpError(400, 'El PDF contiene cifrado, enlaces o acciones no admitidos. Exporta una copia estática.');
  return { bytes, mime, sha256: digest(bytes), nombre: file.nombre.trim() };
}
function createDocumentStore(directory, publicDirectory) {
  const root = safeDirectory(path.resolve(directory));
  if (publicDirectory) {
    const pub = safeDirectory(path.resolve(publicDirectory));
    if (inside(root, pub) || inside(pub, root)) throw new Error('Private documents must be separate from public uploads.');
  }
  let queue = Promise.resolve();
  const target = key => { if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid document key.'); return path.join(root, key); };
  async function read(key) {
    const file = target(key); const stat = await fs.promises.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE) throw new Error('Invalid stored document.');
    const bytes = await fs.promises.readFile(file);
    if (digest(bytes) !== key) throw new Error('Document integrity check failed.');
    return bytes;
  }
  return { read, put(key, bytes) {
    const write = queue.then(async () => {
      if (digest(bytes) !== key) throw new Error('Invalid document digest.');
      try { await read(key); return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const entries = await fs.promises.readdir(root, { withFileTypes: true });
      let size = 0;
      for (const entry of entries) { const stat = await fs.promises.lstat(path.join(root, entry.name)); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unexpected storage entry.'); size += stat.size; }
      if (size + bytes.length > 250 * 1024 * 1024) throw new HttpError(413, 'El archivo documental ha alcanzado el límite local de 250 MB.');
      try { const file = await fs.promises.open(target(key), 'wx', 0o600); try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); } }
      catch (error) { if (error.code !== 'EEXIST') throw error; await read(key); }
    });
    queue = write.catch(() => {}); return write;
  } };
}
module.exports = { createDocumentStore, decodeDocument, digest };
