const { AsyncLocalStorage } = require('node:async_hooks');

const stores = new WeakMap();
const branded = new WeakSet();

// Application-only boundary. Migration/recovery tools keep their synchronous
// SQLite connection; request handlers must never access that raw connection.
function createAsyncStore(database) {
  if (branded.has(database)) return database;
  if (stores.has(database)) return stores.get(database);
  const remote = database.driver === 'libsql';
  if (!remote && !database.connection?.prepare) throw new Error('Unsupported database adapter.');
  const context = new AsyncLocalStorage();
  let queue = Promise.resolve();
  let accepting = true;
  const enqueue = work => {
    if (!accepting) return Promise.reject(new Error('Database is closed.'));
    if (context.getStore()) return Promise.reject(new Error('Use the explicit transaction handle; root queries and nested transactions are forbidden.'));
    const pending = queue.then(() => database.ready).then(work);
    queue = pending.catch(() => {});
    return pending;
  };
  const args = values => values.map(value => value === undefined ? null : value);
  function connection(execute, batch) {
    return {
      prepare(query) {
        return Object.fromEntries(['get', 'all', 'run'].map(method => [method, (...values) => execute(method, query, args(values))]));
      },
      batch,
    };
  }
  const direct = (target, method, query, values) => remote
    ? target[method](query, values)
    : target.prepare(query)[method](...values);
  const root = remote ? database : database.connection;
  const store = {
    ready: database.ready || Promise.resolve(),
    connection: connection((method, query, values) => enqueue(() => direct(root, method, query, values)), statements => store.transaction(sql => sql.batch(statements))),
    transaction(work) {
      return enqueue(() => context.run(true, async () => {
        const perform = async target => {
          let active = true;
          const check = () => { if (!active) throw new Error('Transaction is no longer active.'); };
          const sql = connection(async (method, query, values) => { check(); return direct(target, method, query, values); }, async statements => {
            check();
            if (remote) return target.batch(statements);
            return statements.map(statement => target.prepare(statement.sql).run(...args(statement.args || [])));
          });
          try { return await work(sql); } finally { active = false; }
        };
        if (remote) return database.transaction(perform);
        root.exec('BEGIN IMMEDIATE');
        try {
          const result = await perform(root);
          root.exec('COMMIT');
          return result;
        } catch (error) {
          try { root.exec('ROLLBACK'); } catch { /* Preserve the original failure. */ }
          throw error;
        }
      }));
    },
    async close() {
      if (context.getStore()) throw new Error('Cannot close the database inside a transaction.');
      accepting = false;
      await queue;
      await database.close();
    },
  };
  for (const method of ['get', 'all', 'run']) {
    store[method] = async (query, values, callback) => {
      if (typeof values === 'function') { callback = values; values = []; }
      let result;
      try { result = await store.connection.prepare(query)[method](...(values || [])); }
      catch (error) { if (callback) return callback(error); throw error; }
      if (!callback) return result;
      // Callback is deliberately outside the queue and after COMMIT: it may
      // perform another query and must not deadlock or publish premature success.
      return method === 'run' ? callback.call({ lastID: result.lastInsertRowid, changes: result.changes }, null) : callback(null, result);
    };
  }
  stores.set(database, store);
  branded.add(store);
  return store;
}

module.exports = { createAsyncStore };
