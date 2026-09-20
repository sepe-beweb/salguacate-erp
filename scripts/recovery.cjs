const { parseArgs } = require('node:util');
const { createBackup, verifyBackup, restoreBackup } = require('../apps/api/recovery');

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options: {
    database: { type: 'string' }, uploads: { type: 'string' }, documents: { type: 'string' }, output: { type: 'string' },
    backup: { type: 'string' }, offline: { type: 'boolean' }, help: { type: 'boolean' }
  } });
  if (values.help) {
    console.log('backup --database ABS --uploads ABS [--documents ABS] --output NUEVO_ABS --offline\nverify --backup ABS\nrestore --backup ABS --output NUEVO_ABS --offline\nIncluye --documents si existen archivos privados. Todas las rutas son explícitas. No se sobrescriben destinos. No se leen variables .env.');
    return;
  }
  const command = positionals[0];
  const allowed = { backup: ['database', 'uploads', 'documents', 'output', 'offline'], verify: ['backup'], restore: ['backup', 'output', 'offline'] }[command];
  if (positionals.length !== 1 || !allowed || Object.keys(values).some(key => !allowed.includes(key)) || allowed.some(key => key !== 'documents' && values[key] === undefined)) throw new Error('Argumentos incompletos o no admitidos. Consulta --help.');
  if (command === 'backup') console.log(JSON.stringify(await createBackup(values), null, 2));
  else if (command === 'verify') { const manifest = verifyBackup(values.backup); console.log(JSON.stringify({ status: 'verified', files: manifest.files.length })); }
  else console.log(JSON.stringify(await restoreBackup({ source: values.backup, output: values.output, offline: values.offline }), null, 2));
}

main().catch(error => { console.error(`Recuperación fallida: ${error.message}\nNo se ha activado ningún destino. Si se creó una carpeta parcial, consérvala para diagnóstico; no contiene una entrega verificada.`); process.exitCode = 1; });
