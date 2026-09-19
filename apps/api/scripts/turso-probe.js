const { readProbeConfig, connectProbe } = require('../libsql');
const { runTursoProbe } = require('../turso-probe');

const HELP = `Disposable Turso/libSQL compatibility probe (not an ERP deployment).
Usage: npm run probe:turso -- --confirm-empty-disposable HOST

Creates the current schema and synthetic, inactive fixtures in an EMPTY database.
Refuses existing objects. Does not delete the database or fixtures afterwards.
Requires SALGUACATE_TURSO_PROBE_URL and SALGUACATE_TURSO_PROBE_TOKEN in the process
environment. Never reads .env or production TURSO_* variables; never logs secrets.
HOST must exactly match the dedicated database hostname (name.turso.io or
name.aws-REGION.turso.io, as displayed in the Turso console).
Do not use a production database or token. No automatic retries or paid services.
`;

async function main(args = process.argv.slice(2), env = process.env, output = console, { connect = connectProbe, probe = runTursoProbe } = {}) {
  if (args.length === 1 && args[0] === '--help') { output.log(HELP); return 0; }
  let db;
  try {
    if (args.length !== 2 || args[0] !== '--confirm-empty-disposable') throw new Error('Explicit empty disposable database confirmation is required.');
    const config = readProbeConfig(env, args[1]);
    db = connect(config);
    const result = await probe(db);
    output.log(JSON.stringify(result, null, 2));
    return 0;
  } catch {
    // SDK failures can contain SQL, URLs or remote response bodies. Keep terminal
    // output safe even when the token is rejected or the commit is unconfirmed.
    output.error('Turso probe did not pass. Verify the dedicated host/token, empty database and network. The database may retain synthetic data; do not retry against it or activate the ERP. No services were deployed.');
    return 1;
  } finally { await db?.close(); }
}

if (require.main === module) main().then(code => { process.exitCode = code; });
module.exports = { main };
