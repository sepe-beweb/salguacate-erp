// No dotenv, persistent path, or remote services: integration fixtures only.
const { createDatabase } = require('../apps/api/database');
const { createApp } = require('../apps/api/index');
const { seedTestUsers } = require('../tests/fixtures/users.cjs');
(async () => {
  const db = createDatabase(':memory:');
  await db.ready;
  await seedTestUsers(db);
  const app = createApp({ db, origins: ['http://127.0.0.1:5174'] });
  const server = app.listen(3101, '127.0.0.1');
  server.on('error', error => { db.close(); console.error(error.message); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
