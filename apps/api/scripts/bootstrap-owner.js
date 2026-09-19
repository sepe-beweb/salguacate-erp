const path = require('node:path');
const { parseArgs } = require('node:util');
const { readConfig } = require('../config');
const { bootstrapOwner } = require('../bootstrap');

async function readPin(input) {
  if (input.isTTY) throw new Error('PIN input must be piped from a private prompt; do not type it in a visible terminal.');
  let value = '';
  for await (const chunk of input) {
    value += chunk.toString('utf8');
    if (Buffer.byteLength(value) > 10) throw new Error('Invalid PIN input.');
  }
  return value.replace(/\r?\n$/, '');
}

async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, strict: true, allowPositionals: false, options: {
    database: { type: 'string' }, name: { type: 'string' }, 'pin-stdin': { type: 'boolean' }, help: { type: 'boolean' }
  } });
  if (values.help) {
    console.log('New installation: --database NEW_ABSOLUTE_FILE --name OWNER --pin-stdin\nThe parent directory must exist. Existing files are never replaced. Explicit mode does not read .env.\nPipe the PIN from a private prompt, never pass it as a command argument.\nWithout arguments, legacy BOOTSTRAP_OWNER_NAME/PIN environment mode remains available for an empty user table.');
    return;
  }
  if (args.length) {
    if (!values.database || !values.name || !values['pin-stdin']) throw new Error('Use --database, --name and --pin-stdin together. No environment fallback.');
    const pin = await readPin(process.stdin);
    await bootstrapOwner({ filename: values.database, name: values.name, pin, newDatabase: true });
  } else {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    await bootstrapOwner({ filename: readConfig().filename, name: process.env.BOOTSTRAP_OWNER_NAME, pin: process.env.BOOTSTRAP_OWNER_PIN });
  }
  console.log('Owner created. No sample records were inserted.');
}

if (require.main === module) main().catch(error => {
  const message = error.code?.startsWith('ERR_PARSE_ARGS') ? 'Invalid bootstrap arguments. Consult --help; never pass a PIN as an argument.' :
    error.code === 'EEXIST' ? 'Database already exists. Nothing was replaced.' : error.message;
  console.error(message); process.exitCode = 1;
});
module.exports = { main, readPin };
