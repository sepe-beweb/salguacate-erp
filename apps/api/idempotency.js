const { createHash } = require('node:crypto');
const { HttpError } = require('./http');
const { writeAsActor } = require('./authorization');
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Call only after authentication, role checks and payload validation.
// Business writes, audit and receipt share the explicit asynchronous transaction.
async function createOnce(db, req, operation, payload, status, create) {
  const rawKey = req.get('Idempotency-Key');
  if (rawKey !== undefined && !KEY_PATTERN.test(rawKey)) {
    throw new HttpError(400, 'Idempotency-Key debe ser un UUID v4 válido.', 'IDEMPOTENCY_KEY_INVALID');
  }
  const key = rawKey?.toLowerCase();
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return (await writeAsActor(db, req, async sql => {
    if (key) {
      const receipt = (await sql.prepare('SELECT request_hash, status, response_json FROM idempotency_requests WHERE actor_id = ? AND operation = ? AND request_key = ?').get(req.user.id, operation, key));
      if (receipt) {
        if (receipt.request_hash !== fingerprint) throw new HttpError(409, 'Este intento ya se usó con otros datos. Concilia el resultado antes de iniciar otro.', 'IDEMPOTENCY_CONFLICT');
        return { status: receipt.status, body: JSON.parse(receipt.response_json) };
      }
    }
    const body = (await create(sql));
    if (key) (await sql.prepare('INSERT INTO idempotency_requests (actor_id, operation, request_key, request_hash, status, response_json) VALUES (?, ?, ?, ?, ?, ?)').run(req.user.id, operation, key, fingerprint, status, JSON.stringify(body)));
    return { status, body };
  }));
}
module.exports = { createOnce };
