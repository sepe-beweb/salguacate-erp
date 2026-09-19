const { parseArgs } = require('node:util');
const { bootstrapRemoteOwner } = require('../bootstrap-remote');

async function readSecrets(input) {
  if (input.isTTY) throw new Error('Use a private input source, not a visible terminal.');
  let text = '';
  for await (const chunk of input) {
    text += chunk.toString('utf8');
    if (Buffer.byteLength(text) > 16384) throw new Error('Invalid private input.');
  }
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('Invalid private input.'); }
  text = '';
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'pin,token' || typeof value.pin !== 'string' || typeof value.token !== 'string') throw new Error('Invalid private input.');
  return value;
}

async function main(args = process.argv.slice(2), input = process.stdin, output = console, bootstrap = bootstrapRemoteOwner) {
  let secrets;
  try {
    const { values } = parseArgs({ args, strict: true, allowPositionals: false, options: {
      'database-url': { type: 'string' }, 'confirm-host': { type: 'string' }, name: { type: 'string' }, 'secrets-stdin': { type: 'boolean' }, help: { type: 'boolean' },
    } });
    if (values.help) {
      output.log('New EMPTY remote database only: --database-url URL --confirm-host EXACT_HOST --name OWNER --secrets-stdin\nPrivate stdin JSON must contain only token and pin. Never put these values in arguments, files, shell history or chat. No .env is loaded. An existing schema is never replaced. An uncertain COMMIT must be reconciled, not replayed.');
      return 0;
    }
    if (!values['database-url'] || !values['confirm-host'] || !values.name || !values['secrets-stdin']) throw new Error('Explicit options required.');
    secrets = await readSecrets(input);
    const result = await bootstrap({ url: values['database-url'], host: values['confirm-host'], name: values.name, ...secrets });
    output.log(JSON.stringify(result)); return 0;
  } catch (error) {
    const code = ['COMMIT_UNCONFIRMED', 'BOOTSTRAP_VERIFICATION_UNCONFIRMED', 'DATABASE_NOT_EMPTY', 'FOREIGN_KEYS_DISABLED', 'INVALID_FRESH_SCHEMA', 'INVALID_BOOTSTRAP_INPUT'].includes(error.code) ? error.code : 'BOOTSTRAP_FAILED';
    output.error(JSON.stringify({ status: 'failed', code, automaticRetry: false })); return 1;
  } finally { if (secrets) { secrets.token = ''; secrets.pin = ''; } }
}

if (require.main === module) main().then(code => { process.exitCode = code; });
module.exports = { main, readSecrets };
