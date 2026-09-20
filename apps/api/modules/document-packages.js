const { zipSync } = require('fflate');
const { asyncRoute } = require('../security');
const { writeAsActor } = require('../authorization');
const { HttpError } = require('../http');
const { LOCALS, validDate, requireValid } = require('../validation');
const { digest } = require('../document-store');
const LIMIT = 50 * 1024 * 1024;
const label = local => local === 'Principal' ? 'Aguacate' : 'Salmon';
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);

function registerDocumentPackages(app, { db, access, available, documentStore, query, expose, scope }) {
  let exporting = false;
  function filters(input, user) {
    const { local, mes, incluir_pendientes = false } = input;
    requireValid([...LOCALS,'Todos'].includes(local) && typeof mes==='string' && /^\d{4}-\d{2}$/.test(mes) && validDate(mes+'-01') && typeof incluir_pendientes==='boolean','Selecciona local, mes y alcance válidos.');
    if(user.rol!=='owner') scope(user,local);
    return { local, mes, incluir_pendientes };
  }
  async function snapshot(sql, f) {
    const args=[f.mes+'-01',f.mes+'-31'];
    const where=` WHERE d.archivado=0 AND d.fecha BETWEEN ? AND ?${f.local==='Todos'?'':' AND d.local=?'}${f.incluir_pendientes?'':" AND d.revision_estado='revisado'"}`;
    if(f.local!=='Todos') args.push(f.local);
    const total=await sql.prepare('SELECT count(*) n,COALESCE(sum(bytes),0) bytes FROM documentos d'+where).get(...args);
    if(total.n>100 || total.bytes>LIMIT) throw new HttpError(413,'El paquete supera 100 documentos o 50 MB. Selecciona un solo local o un alcance menor.');
    return (await sql.prepare(query.replace('SELECT d.id','SELECT d.sha256,d.id')+where+' ORDER BY d.local,d.fecha,d.id').all(...args)).map(expose);
  }
  const fingerprint = (f, rows) => digest(JSON.stringify([f,rows]));
  const filename = (doc, f) => `${label(doc.local)}/${f.mes}/${doc.tipo}/documento-${String(doc.id).padStart(6,'0')}.${({ 'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp' })[doc.mime]}`;
  const entry = (doc, f) => ({ id:doc.id,local:label(doc.local),titulo:doc.titulo,fecha:doc.fecha,tipo:doc.tipo,proveedor:doc.proveedor_nombre,gasto_id:doc.gasto_id,revision_estado:doc.revision_estado,responsable:doc.revision_responsable_nombre,fecha_limite:doc.revision_fecha_limite,etiquetas:doc.etiquetas,archivo:filename(doc,f),nombre_original:doc.nombre_archivo,bytes:doc.bytes,sha256:doc.sha256 });
  app.get('/api/documentos/paquete', ...access, available, asyncRoute(async (req,res) => {
    requireValid(req.query.incluir_pendientes===undefined || ['','1'].includes(req.query.incluir_pendientes),'Alcance inválido.');
    const f=filters({ ...req.query,incluir_pendientes:req.query.incluir_pendientes==='1' },req.user);
    const rows=await writeAsActor(db,req,sql=>snapshot(sql,f));
    res.set('Cache-Control','private, no-store').json({ ...f,huella:fingerprint(f,rows),total:rows.length,bytes:rows.reduce((sum,d)=>sum+d.bytes,0),documentos:rows.map(d=>entry(d,f)) });
  }));
  app.post('/api/documentos/paquete', ...access, available, asyncRoute(async (req,res) => {
    const f=filters(req.body,req.user);
    requireValid(typeof req.body.huella==='string' && /^[a-f0-9]{64}$/.test(req.body.huella),'Consulta primero la vista previa del paquete.');
    if(exporting) throw new HttpError(429,'Hay un paquete preparándose. Espera a que termine antes de intentarlo de nuevo.');
    exporting=true;
    try {
      const rows=await writeAsActor(db,req,sql=>snapshot(sql,f));
      if(!rows.length || fingerprint(f,rows)!==req.body.huella) throw new HttpError(409,'La selección ha cambiado o está vacía. Actualiza la vista previa antes de descargar.');
      const files={};
      for(const doc of rows) {
        let bytes; try { bytes=await documentStore.read(doc.sha256); } catch { throw new HttpError(503,'No se pudo verificar uno de los originales. No se genera un paquete incompleto.'); }
        if(bytes.length!==doc.bytes) throw new HttpError(503,'Un original no coincide con su ficha. No se genera un paquete incompleto.');
        files[filename(doc,f)]=bytes;
      }
      const entries=rows.map(d=>entry(d,f));
      files['indice.json']=Buffer.from(JSON.stringify({ formato:1,mes:f.mes,local:f.local,incluir_pendientes:f.incluir_pendientes,documentos:entries },null,2));
      files['LEEME.txt']=Buffer.from('Paquete documental de Salguacate. Extrae el ZIP completo y abre indice.html.\nIncluye documentos activos según su fecha documental; no por fecha del gasto. No registra pagos ni concilia importes. Puede haber varios justificantes de un mismo gasto.\nEl paquete NO está cifrado. Guarda y comparte su contenido únicamente por un canal autorizado. Descargar no lo envía a la gestoría.\nindice.json incluye SHA-256 de cada original.\n');
      files['indice.html']=Buffer.from(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Archivo documental ${html(f.mes)}</title><style>body{font:16px system-ui;margin:2rem;color:#172b22}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:.6rem;text-align:left}h1{color:#347a43}</style><h1>Archivo documental · ${html(f.mes)}</h1><p>${entries.length} documentos activos. ${f.incluir_pendientes?'Incluye documentos pendientes de revisión.':'Solo revisados.'} Sin conciliación contable. El ZIP no está cifrado.</p><table><thead><tr><th>Local</th><th>Fecha</th><th>Documento</th><th>Proveedor</th><th>Revisión</th><th>Gasto</th></tr></thead><tbody>${entries.map(e=>`<tr><td>${html(e.local)}</td><td>${html(e.fecha)}</td><td><a href="${html(e.archivo)}">${html(e.titulo)}</a></td><td>${html(e.proveedor)}</td><td>${html(e.revision_estado)}</td><td>${html(e.gasto_id ?? 'Sin vínculo')}</td></tr>`).join('')}</tbody></table></html>`);
      const zip=Buffer.from(zipSync(files,{ level:0 }));
      // No filesystem I/O or compression in a transaction. Recheck authorization and the full selection before sending.
      const current=await writeAsActor(db,req,sql=>snapshot(sql,f));
      if(fingerprint(f,current)!==req.body.huella) throw new HttpError(409,'Los documentos cambiaron mientras se preparaba el paquete. Actualiza su vista previa.');
      res.set({ 'Content-Type':'application/zip','Content-Disposition':`attachment; filename="salguacate-${f.mes}-${f.local==='Todos'?'ambos-locales':label(f.local)}.zip"`,'Cache-Control':'private, no-store' }).send(zip);
    } finally { exporting=false; }
  }));
}
module.exports={ registerDocumentPackages };
