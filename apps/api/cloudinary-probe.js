const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { createDatabase } = require('./database');
const { createApp } = require('./index');
const { createCloudinaryImageStore, readImage } = require('./image-store');

// Explicit, disposable integration harness. Never imported by server startup.
async function runCloudinaryProbe(config, confirmation, images, onStep = () => {}, transport = fetch) {
  if (!confirmation || confirmation !== config.cloudName) throw new Error('Confirm the exact Cloudinary environment.');
  if (!Array.isArray(images) || images.length !== 2) throw new Error('Provide exactly two synthetic images.');
  const decoded = images.map(readImage);
  if (decoded[0].format !== 'png' || decoded[1].format !== 'jpg' || decoded.some(image => image.bytes.length > 65536)) {
    throw new Error('The probe requires a small synthetic PNG and JPEG, in that order.');
  }
  const requests = [];
  const remote = createCloudinaryImageStore(config, async (url, options) => {
    const event = { action: url.endsWith('/upload') ? 'upload' : 'destroy', publicId: options.body.get('public_id'), status: 'unconfirmed' };
    requests.push(event);
    try {
      const response = await transport(url, options);
      event.status = response.status;
      return response;
    } finally { onStep({ request: { ...event } }); }
  });
  const owned = [], checks = [], cleanup = [];
  let step = 'initialize', failed = false, server, ready = false;
  const raw = createDatabase(':memory:');
  let token = randomBytes(32).toString('hex');
  const imageStore = {
    async save(image) {
      const saved = await remote.save(image);
      let removal;
      const handle = { url: saved.url, remove: () => removal ||= saved.remove() };
      owned.push(handle);
      return handle;
    },
  };
  try {
    await raw.ready; ready = true;
    const user = raw.connection.prepare('INSERT INTO usuarios (nombre, rol, local, pin, active, must_change_pin) VALUES (?, ?, ?, NULL, 1, 0)')
      .run(`Synthetic image probe ${randomUUID()}`, 'owner', 'Principal');
    raw.connection.prepare('INSERT INTO sessions VALUES (?, ?, 1, ?)').run(createHash('sha256').update(token).digest('hex'), user.lastInsertRowid, Date.now() + 600000);
    server = createApp({ db: raw, imageStore }).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function call(method, body) {
      const response = await fetch(`${origin}/api/inventario`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(30000),
      });
      if (response.status !== 200) throw new Error('Unexpected catalogue response.');
      return response.json();
    }
    for (let index = 0; index < images.length; index++) {
      step = `catalogue-upload-download-${decoded[index].format}`;
      onStep({ check: step, status: 'running' });
      const start = performance.now();
      const product = await call('POST', { producto: `Synthetic ${index}`, local: 'Principal', imagen_base64: images[index] });
      const row = raw.connection.prepare('SELECT imagen_url FROM inventario WHERE id = ?').get(product.id);
      if (owned.length !== index + 1 || row?.imagen_url !== owned[index].url) throw new Error('Image reference not persisted.');
      const catalogue = await call('GET');
      if (!catalogue.some(item => item.id === product.id && item.imagen_url === row.imagen_url)) throw new Error('Image reference not delivered.');
      // Credentials are sent only by the upload store, never to the public CDN.
      const download = await transport(row.imagen_url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
      const expectedType = index ? 'image/jpeg' : 'image/png';
      if (!download.ok || download.headers.get('content-type')?.split(';')[0] !== expectedType) throw new Error('Unexpected image delivery.');
      const chunks = []; let size = 0;
      for await (const chunk of download.body) {
        size += chunk.length;
        if (size > 65536) throw new Error('Unexpected image size.');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (!bytes.equals(decoded[index].bytes)) throw new Error('Delivered image differs from input.');
      const result = { check: step, status: 'passed', bytes: size, sha256: createHash('sha256').update(bytes).digest('hex'), milliseconds: Math.round(performance.now() - start) };
      checks.push(result); onStep(result);
    }
  } catch {
    // Do not propagate provider errors, HTTP payloads, secrets or session tokens.
    failed = true;
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
    token = '';
    if (ready) raw.close();
    for (const saved of owned) {
      try { await saved.remove(); cleanup.push({ url: saved.url, status: 'confirmed' }); }
      catch { cleanup.push({ url: saved.url, status: 'unconfirmed' }); }
    }
  }
  return {
    status: !failed && cleanup.length === 2 && cleanup.every(item => item.status === 'confirmed') ? 'passed' : 'failed',
    scope: 'loopback-api-local-memory-database-cloudinary',
    failedStep: failed ? step : null, checks, cleanup, requests,
    // A rejected/lost upload response may still leave an untracked asset. Never
    // claim an empty provider account or retry/purge the prefix to resolve it.
    unconfirmedUploadPossible: requests.some(request => request.action === 'upload' &&
      (request.status === 'unconfirmed' || request.status >= 500 || (request.status >= 200 && request.status < 300)) &&
      !owned.some(saved => saved.url.includes(`/${request.publicId}.`))),
  };
}

module.exports = { runCloudinaryProbe };
