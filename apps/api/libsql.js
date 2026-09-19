// Explicit remote adapter. No local replica, fallback, retries or environment loading.
const { createClient } = require('@libsql/client/web');

function readProbeConfig(env, expectedHost) {
  const raw = env.SALGUACATE_TURSO_PROBE_URL;
  const token = env.SALGUACATE_TURSO_PROBE_TOKEN;
  let url;
  try { url = new URL(raw); } catch { throw new Error('A dedicated Turso probe URL is required.'); }
  if (!['libsql:', 'https:'].includes(url.protocol) || !/^[a-z0-9][a-z0-9-]*(?:\.aws-[a-z0-9-]+)?\.turso\.io$/.test(url.hostname) ||
      url.hostname !== expectedHost || url.username || url.password || url.port || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('The probe URL must match the explicitly confirmed Turso database host, without credentials or options.');
  }
  if (typeof token !== 'string' || !token.trim() || token !== token.trim()) throw new Error('A dedicated Turso probe token is required.');
  return { url: `https://${url.hostname}`, authToken: token, intMode: 'bigint' };
}

function safeInteger(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Database integer exceeds the supported safe range.');
  return result;
}

function normalizeResult(result) {
  return {
    rows: result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? safeInteger(value) : value]))),
    changes: safeInteger(result.rowsAffected),
    lastInsertRowid: result.lastInsertRowid == null ? null : safeInteger(result.lastInsertRowid),
  };
}

function createLibsqlDatabase(client) {
  let queue = Promise.resolve();
  let closed = false;
  const checkOpen = () => { if (closed) throw new Error('Database is closed.'); };
  function access(target, isActive = () => true) {
    const check = () => { checkOpen(); if (!isActive()) throw new Error('Transaction is no longer active.'); };
    const execute = async (sql, args = []) => {
      check();
      return normalizeResult(await target.execute({ sql, args: args.map(value => value === undefined ? null : value) }));
    };
    return {
      async get(sql, args) { return (await execute(sql, args)).rows[0]; },
      async all(sql, args) { return (await execute(sql, args)).rows; },
      async run(sql, args) { return execute(sql, args); },
      async batch(statements) {
        check();
        return (await target.batch(statements)).map(normalizeResult);
      },
    };
  }
  const db = {
    ...access(client),
    transaction(work) {
      // One instance serializes its write transactions. Each callback receives only
      // its own transaction handle; unrelated queries cannot accidentally join it.
      const run = async () => {
        checkOpen();
        const transaction = await client.transaction('write');
        let active = true;
        let committing = false;
        try {
          const result = await work(access(transaction, () => active));
          committing = true;
          await transaction.commit();
          return result;
        } catch (error) {
          try { await transaction.rollback(); } catch { /* Closing releases the stream. Never replay a write. */ }
          if (committing) {
            const unknown = new Error('Commit was not confirmed. Reconcile the stored receipt before retrying.');
            unknown.code = 'COMMIT_UNCONFIRMED';
            throw unknown;
          }
          throw error;
        } finally {
          active = false;
          transaction.close();
        }
      };
      const pending = queue.then(run);
      queue = pending.catch(() => {});
      return pending;
    },
    async close() { await queue; closed = true; client.close(); },
  };
  return db;
}

function connectProbe(config) {
  const transport = config.fetch || (request => fetch(request, { redirect: 'error', signal: AbortSignal.timeout(10000) }));
  return createLibsqlDatabase(createClient({ ...config, fetch: transport }));
}
module.exports = { readProbeConfig, createLibsqlDatabase, connectProbe, normalizeResult };
