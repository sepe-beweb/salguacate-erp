const { asyncRoute } = require('../security');
const { writeAsActor } = require('../authorization');
const { HttpError } = require('../http');
const { LOCALS, validDate, validId, text, requireValid } = require('../validation');
const { decodeDocument, digest } = require('../document-store');
const { registerDocumentPackages } = require('./document-packages');
const TYPES = ['factura_proveedor','ticket','albaran','gasto_extra','contrato','otro'];
function scope(user, local) { if (user.rol !== 'owner' && user.local !== local) throw new HttpError(403, 'No tienes acceso a documentos de este local.'); }
function fields(body) {
  requireValid(body && LOCALS.includes(body.local) && text(body.titulo, 160) && validDate(body.fecha) && TYPES.includes(body.tipo) && text(body.notas ?? '', 2000, true), 'Completa título, local, fecha y tipo válidos.');
  requireValid(Array.isArray(body.etiquetas) && body.etiquetas.length <= 12 && body.etiquetas.every(tag => text(tag, 40)), 'Admite hasta 12 etiquetas de 40 caracteres.');
  requireValid(body.proveedor_id === null || validId(body.proveedor_id), 'Proveedor inválido.');
  return { local: body.local, titulo: body.titulo.trim(), fecha: body.fecha, tipo: body.tipo, etiquetas: [...new Set(body.etiquetas.map(tag => tag.trim().toLocaleLowerCase('es-ES')))].sort(), notas: (body.notas || '').trim(), proveedor_id: body.proveedor_id === null ? null : Number(body.proveedor_id) };
}
async function provider(sql, id) { if (id !== null && !await sql.prepare('SELECT id FROM proveedores WHERE id=?').get(id)) throw new HttpError(400, 'El proveedor ya no existe.'); }
const query = `SELECT d.id,d.local,d.titulo,d.fecha,d.tipo,d.etiquetas_json,d.notas,d.proveedor_id,d.gasto_id,d.nombre_archivo,d.mime,d.bytes,d.autor_id,d.creado_en,d.actualizado_en,d.revision,d.archivado,
 d.revision_estado,d.revision_responsable_id,d.revision_fecha_limite,d.revision_notas,d.revisado_por,d.revisado_en,
 r.nombre revision_responsable_nombre,v.nombre revisado_nombre,u.nombre autor_nombre,p.nombre proveedor_nombre
 FROM documentos d JOIN usuarios u ON u.id=d.autor_id LEFT JOIN proveedores p ON p.id=d.proveedor_id
 LEFT JOIN usuarios r ON r.id=d.revision_responsable_id LEFT JOIN usuarios v ON v.id=d.revisado_por`;
const expose = row => { const { etiquetas_json, ...doc } = row; return { ...doc, etiquetas: JSON.parse(etiquetas_json) }; };
async function entry(sql, req) { const doc = await sql.prepare('SELECT * FROM documentos WHERE id=?').get(req.params.id); if (!doc) throw new HttpError(404, 'Documento no encontrado.'); scope(req.user, doc.local); return doc; }
async function change(sql, req, id, detail) {
  await sql.prepare('INSERT INTO documento_cambios (documento_id,actor_id,detalle) VALUES (?,?,?)').run(id,req.user.id,detail);
  await sql.prepare("INSERT INTO audit_events (actor_id,action,entity_id) VALUES (?,'document.updated',?)").run(req.user.id,String(id));
}
async function reopenReview(sql, req, doc, reason, clearAssignee = false) {
  if (doc.revision_estado !== 'revisado' && !clearAssignee) return;
  await sql.prepare(`UPDATE documentos SET revision_estado='pendiente',revisado_por=NULL,revisado_en=NULL${clearAssignee ? ',revision_responsable_id=NULL' : ''} WHERE id=?`).run(doc.id);
  await change(sql,req,doc.id,`Revisión pendiente: ${reason}${clearAssignee ? ' · Responsable retirado por cambio de local' : ''}`);
}
function registerDocuments(app, { db, requireAuth, requireRole, documentStore }) {
  const access = [requireAuth, requireRole(['owner','manager'])];
  const available = (req,res,next) => documentStore ? next() : next(new HttpError(503, 'El almacenamiento privado de documentos no está configurado.'));
  registerDocumentPackages(app,{ db,access,available,documentStore,query,expose,scope });
  app.get('/api/documentos/responsables', ...access, available, asyncRoute(async (req,res) => {
    res.json(await writeAsActor(db,req,sql=>sql.prepare(`SELECT id,nombre,rol,local FROM usuarios WHERE active=1 AND rol IN ('owner','manager')${req.user.rol==='owner' ? '' : " AND (rol='owner' OR local=?)"} ORDER BY nombre,id`).all(...(req.user.rol==='owner'?[]:[req.user.local]))));
  }));
  app.get('/api/documentos', ...access, available, asyncRoute(async (req,res) => {
    const { local = req.user.rol === 'owner' ? 'Todos' : req.user.local, desde='', hasta='', tipo='', etiqueta='', proveedor='', gasto='', vinculo='', q='', estado='activos', pagina='1', revision_estado='', responsable='', vencidos='', hoy=new Date().toISOString().slice(0,10) } = req.query;
    requireValid(['','abiertos','pendiente','en_revision','revisado'].includes(revision_estado) && (!responsable || ['mios','sin_asignar'].includes(responsable) || validId(responsable)) && ['','1'].includes(vencidos) && validDate(hoy), 'Filtros de revisión inválidos.');
    requireValid(['','con_gasto','sin_gasto'].includes(vinculo), 'Filtro de vínculo inválido.');
    requireValid([...LOCALS,'Todos'].includes(local) && (!desde || validDate(desde)) && (!hasta || validDate(hasta)) && (!desde || !hasta || desde <= hasta) && (!tipo || TYPES.includes(tipo)) && text(q,160,true) && text(etiqueta,40,true) && (!proveedor || validId(proveedor)) && (!gasto || validId(gasto)) && ['activos','archivados','todos'].includes(estado) && validId(pagina) && Number(pagina) <= 100000, 'Filtros inválidos.');
    if (req.user.rol !== 'owner') scope(req.user,local);
    const result = await writeAsActor(db,req,async sql => {
      const clauses=[]; const args=[]; const add=(clause,value)=>{ clauses.push(clause); args.push(value); };
      if(local!=='Todos') add('d.local=?',local);
      if(desde) add('d.fecha>=?',desde); if(hasta) add('d.fecha<=?',hasta); if(tipo) add('d.tipo=?',tipo);
      if(proveedor) add('d.proveedor_id=?',Number(proveedor)); if(gasto) add('d.gasto_id=?',Number(gasto));
      if(vinculo) clauses.push(vinculo==='con_gasto' ? 'd.gasto_id IS NOT NULL' : 'd.gasto_id IS NULL');
      if(revision_estado==='abiertos') clauses.push("d.revision_estado<>'revisado'"); else if(revision_estado) add('d.revision_estado=?',revision_estado);
      if(responsable==='sin_asignar') clauses.push('d.revision_responsable_id IS NULL'); else if(responsable) add('d.revision_responsable_id=?',responsable==='mios'?req.user.id:Number(responsable));
      if(vencidos) { add('d.revision_fecha_limite<?',hoy); clauses.push("d.revision_estado<>'revisado'"); }
      if(estado!=='todos') add('d.archivado=?',estado==='archivados'?1:0);
      if(q.trim()) { const escaped=q.trim().replace(/[\\%_]/g,'\\$&'); add("(d.titulo || ' ' || d.nombre_archivo || ' ' || d.notas || ' ' || COALESCE(p.nombre,'')) LIKE ? ESCAPE '\\'",'%'+escaped+'%'); }
      if(etiqueta) add('EXISTS (SELECT 1 FROM json_each(d.etiquetas_json) WHERE value=?)',etiqueta.trim().toLocaleLowerCase('es-ES'));
      const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
      const total=(await sql.prepare('SELECT count(*) n FROM documentos d LEFT JOIN proveedores p ON p.id=d.proveedor_id'+where).get(...args)).n;
      const currentPage=Math.min(Number(pagina),Math.max(1,Math.ceil(total/24)));
      const order=revision_estado || responsable || vencidos ? 'd.revision_fecha_limite IS NULL,d.revision_fecha_limite,d.fecha,d.id' : 'd.fecha DESC,d.id DESC';
      const items=(await sql.prepare(query+where+' ORDER BY '+order+' LIMIT 24 OFFSET ?').all(...args,(currentPage-1)*24)).map(expose);
      const resumen=await sql.prepare(`SELECT count(*) activos,
        COALESCE(sum(revision_estado='pendiente'),0) pendientes,COALESCE(sum(revision_estado='en_revision'),0) en_revision,
        COALESCE(sum(revision_estado='revisado'),0) revisados,
        COALESCE(sum(revision_estado<>'revisado' AND revision_fecha_limite<?),0) vencidos,
        COALESCE(sum(revision_estado<>'revisado' AND revision_responsable_id IS NULL),0) sin_asignar
        FROM documentos WHERE archivado=0${local==='Todos'?'':' AND local=?'}`).get(hoy,...(local==='Todos'?[]:[local]));
      return { items,total,pagina:currentPage,por_pagina:24,resumen };
    }); res.json(result);
  }));
  app.post('/api/documentos', ...access, available, asyncRoute(async (req,res) => {
    const data=fields(req.body); scope(req.user,data.local); const file=decodeDocument(req.body.archivo);
    const key=req.get('Idempotency-Key'); requireValid(typeof key==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key),'Falta una clave de guardado válida.');
    const fingerprint=digest(JSON.stringify([data,file.sha256,file.nombre,file.mime]));
    const validateUpload = async sql => {
      const previous=await sql.prepare('SELECT id,request_hash,local FROM documentos WHERE autor_id=? AND request_key=?').get(req.user.id,key.toLowerCase());
      if(previous) { scope(req.user,previous.local); if(previous.request_hash!==fingerprint) throw new HttpError(409,'Esta clave ya se utilizó con otros datos.'); return { id:previous.id,repetido:true }; }
      await provider(sql,data.proveedor_id);
      const duplicate=await sql.prepare('SELECT id FROM documentos WHERE local=? AND sha256=?').get(data.local,file.sha256);
      if(duplicate) throw new HttpError(409,`Este archivo ya está guardado en el local como documento n.º ${duplicate.id}. Consulta también los archivados.`);
      return null;
    };
    // Reject invalid metadata/replays before consuming disk quota, then recheck after I/O for races.
    const previous=await writeAsActor(db,req,validateUpload);
    if(previous) return res.status(201).json(previous);
    // Immutable file is durable before its DB reference. On an uncertain commit keep it, never delete or repeat business writes blindly.
    await documentStore.put(file.sha256,file.bytes);
    const result=await writeAsActor(db,req,async sql=>{
      const replay=await validateUpload(sql); if(replay) return replay;
      const id=Number((await sql.prepare('INSERT INTO documentos (local,titulo,fecha,tipo,etiquetas_json,notas,proveedor_id,nombre_archivo,mime,bytes,sha256,autor_id,request_key,request_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(data.local,data.titulo,data.fecha,data.tipo,JSON.stringify(data.etiquetas),data.notas,data.proveedor_id,file.nombre,file.mime,file.bytes.length,file.sha256,req.user.id,key.toLowerCase(),fingerprint)).lastInsertRowid);
      await change(sql,req,id,'Documento incorporado'); return { id,repetido:false };
    }); res.status(201).json(result);
  }));
  app.get('/api/documentos/:id', ...access, available, asyncRoute(async (req,res) => {
    const result=await writeAsActor(db,req,async sql=>{ await entry(sql,req); return { ...expose(await sql.prepare(query+' WHERE d.id=?').get(req.params.id)), cambios:await sql.prepare('SELECT c.id,c.detalle,c.creado_en,u.nombre actor_nombre FROM documento_cambios c JOIN usuarios u ON u.id=c.actor_id WHERE c.documento_id=? ORDER BY c.id DESC').all(req.params.id) }; }); res.json(result);
  }));
  app.get('/api/documentos/:id/archivo', ...access, available, asyncRoute(async (req,res) => {
    const doc=await writeAsActor(db,req,sql=>entry(sql,req));
    let bytes; try { bytes=await documentStore.read(doc.sha256); } catch { throw new HttpError(503,'El archivo no está disponible o no supera la verificación de integridad.'); }
    await writeAsActor(db,req,sql=>entry(sql,req)); // Revalidate after filesystem I/O.
    res.set({ 'Content-Type':doc.mime,'Content-Disposition':`attachment; filename="documento-${doc.id}.${doc.mime==='application/pdf'?'pdf':doc.mime==='image/jpeg'?'jpg':doc.mime==='image/png'?'png':'webp'}"`, 'Content-Security-Policy':"sandbox; default-src 'none'", 'Cache-Control':'private, no-store' }); res.send(bytes);
  }));
  app.put('/api/documentos/:id', ...access, available, asyncRoute(async (req,res) => {
    const data=fields(req.body); scope(req.user,data.local); requireValid(Number.isSafeInteger(req.body.revision) && req.body.revision>0 && [0,1].includes(req.body.archivado),'Revisión o estado inválidos.');
    await writeAsActor(db,req,async sql=>{
      const doc=await entry(sql,req); if(doc.revision!==req.body.revision) throw new HttpError(409,'El documento ha cambiado. Reabre su ficha antes de editar.');
      await provider(sql,data.proveedor_id);
      if(doc.gasto_id && doc.local!==data.local) throw new HttpError(409,'Desvincula el gasto antes de cambiar de local.');
      const duplicate=await sql.prepare('SELECT id FROM documentos WHERE local=? AND sha256=? AND id<>?').get(data.local,doc.sha256,doc.id);
      if(duplicate) throw new HttpError(409,'El archivo ya existe en ese local.');
      await sql.prepare('UPDATE documentos SET local=?,titulo=?,fecha=?,tipo=?,etiquetas_json=?,notas=?,proveedor_id=?,archivado=?,revision=revision+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=?')
        .run(data.local,data.titulo,data.fecha,data.tipo,JSON.stringify(data.etiquetas),data.notas,data.proveedor_id,req.body.archivado,doc.id);
      const altered=doc.local!==data.local || doc.titulo!==data.titulo || doc.fecha!==data.fecha || doc.tipo!==data.tipo || doc.etiquetas_json!==JSON.stringify(data.etiquetas) || doc.notas!==data.notas || doc.proveedor_id!==data.proveedor_id;
      if(altered) await reopenReview(sql,req,doc,'clasificación modificada',doc.local!==data.local);
      await change(sql,req,doc.id,`${req.body.archivado?'Archivado':'Activo'} · ${data.titulo} · ${data.tipo} · ${data.local} · ${data.etiquetas.join(', ')} · Proveedor: ${data.proveedor_id ?? 'ninguno'} · Notas: ${data.notas || 'sin notas'}`);
    }); res.json({ mensaje:'Clasificación guardada.' });
  }));
  app.put('/api/documentos/:id/revision', ...access, available, asyncRoute(async (req,res) => {
    const { estado, responsable_id, fecha_limite, observaciones, revision }=req.body;
    requireValid(['pendiente','en_revision','revisado'].includes(estado) && (responsable_id===null || validId(responsable_id)) && (fecha_limite===null || validDate(fecha_limite)) && text(observaciones,1000,true) && Number.isSafeInteger(revision) && revision>0,'Revisa estado, responsable, fecha límite y observaciones.');
    await writeAsActor(db,req,async sql=>{
      const doc=await entry(sql,req); if(doc.revision!==revision || doc.archivado) throw new HttpError(409,'La ficha ha cambiado o está archivada. Actualiza o reactiva el documento antes de revisarlo.');
      const target=responsable_id===null?null:Number(responsable_id);
      const assignee=target===null?null:await sql.prepare('SELECT id,nombre,rol,local,active FROM usuarios WHERE id=?').get(target);
      requireValid(target===null || (assignee && assignee.active===1 && (assignee.rol==='owner' || (assignee.rol==='manager' && assignee.local===doc.local))),'El responsable debe ser un propietario o encargado activo con acceso al local.');
      const reviewed=estado==='revisado';
      await sql.prepare(`UPDATE documentos SET revision_estado=?,revision_responsable_id=?,revision_fecha_limite=?,revision_notas=?,revisado_por=?,revisado_en=${reviewed?'CURRENT_TIMESTAMP':'NULL'},revision=revision+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=?`).run(estado,target,fecha_limite,observaciones.trim(),reviewed?req.user.id:null,doc.id);
      await change(sql,req,doc.id,`Revisión: ${estado} · Responsable: ${assignee?.nombre ?? 'sin asignar'} · Límite: ${fecha_limite ?? 'sin fecha'} · ${observaciones.trim() || 'sin observaciones'}`);
    }); res.json({ mensaje:'Revisión documental guardada. No modifica pagos ni importes.' });
  }));
  app.put('/api/documentos/:id/gasto', ...access, available, asyncRoute(async (req,res) => {
    const target=req.body.gasto_id; requireValid(target===null || validId(target),'Gasto inválido.');
    await writeAsActor(db,req,async sql=>{
      const doc=await entry(sql,req); const id=target===null?null:Number(target);
      if(doc.gasto_id===id) return;
      if(doc.revision!==req.body.revision) throw new HttpError(409,'El documento ha cambiado. Reabre su ficha.');
      if(id!==null) { const expense=await sql.prepare('SELECT local FROM gastos WHERE id=?').get(id); requireValid(expense && expense.local===doc.local,'El gasto debe existir y pertenecer al mismo local.'); }
      await sql.prepare('UPDATE documentos SET gasto_id=?,revision=revision+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=?').run(id,doc.id);
      await reopenReview(sql,req,doc,'vínculo contable modificado');
      await change(sql,req,doc.id,id===null?'Gasto desvinculado':`Vinculado al gasto n.º ${id}`);
    }); res.json({ mensaje:'Vínculo guardado.' });
  }));
  app.post('/api/documentos/:id/gasto', ...access, available, asyncRoute(async (req,res) => {
    const { fecha,proveedor_nombre,concepto,total,revision }=req.body;
    const cents=typeof total==='number'?Math.round(total*100):NaN;
    requireValid(validDate(fecha) && text(proveedor_nombre,160) && text(concepto,500) && Number.isSafeInteger(cents) && cents>0 && cents<=100000000 && Math.abs(total*100-cents)<0.000001 && Number.isSafeInteger(revision),'Revisa fecha, proveedor, concepto e importe (máximo 1.000.000 €).');
    const result=await writeAsActor(db,req,async sql=>{
      const doc=await entry(sql,req);
      if(doc.gasto_id) { const old=await sql.prepare('SELECT * FROM gastos WHERE id=?').get(doc.gasto_id); if(old.fecha===fecha && old.proveedor_nombre===proveedor_nombre.trim() && old.concepto===concepto.trim() && Math.round(old.total*100)===cents) return { id:doc.gasto_id }; throw new HttpError(409,'El documento ya tiene un gasto vinculado.'); }
      if(doc.revision!==revision || doc.archivado) throw new HttpError(409,'El documento ha cambiado o está archivado. Revisa su ficha.');
      const id=Number((await sql.prepare('INSERT INTO gastos (fecha,local,proveedor_nombre,total,concepto) VALUES (?,?,?,?,?)').run(fecha,doc.local,proveedor_nombre.trim(),cents/100,concepto.trim())).lastInsertRowid);
      await sql.prepare('UPDATE documentos SET gasto_id=?,revision=revision+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=?').run(id,doc.id);
      await reopenReview(sql,req,doc,'nuevo gasto vinculado');
      await sql.prepare("INSERT INTO audit_events (actor_id,action,entity_id) VALUES (?,'expense.created',?)").run(req.user.id,String(id));
      await change(sql,req,doc.id,`Creado y vinculado gasto n.º ${id}`); return { id };
    }); res.status(201).json(result);
  }));
}
module.exports={ registerDocuments };
