import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FolderLock, Upload, Receipt, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocalScope } from '../hooks/useLocalScope';
import { useApiRead } from '../hooks/useApiLists';
import { readProviders, type Provider } from '../catalogData';
import { readDocumentPage, documentTypes, documentSize, documentInput, type DocumentPage } from '../documentData';
import { locationLabel } from '../locations';
import DocumentUpload from '../components/DocumentUpload';
import DocumentDetail from '../components/DocumentDetail';
import RequestError from '../components/RequestError';
import DocumentThumbnail from '../components/DocumentThumbnail';
import DocumentPackage from '../components/DocumentPackage';
import { reviewStates } from '../documentReviewData';
import { localDate } from '../localDate';

export default function Documents() {
  const { user } = useAuth(); const [scope] = useLocalScope(); const [params, setParams] = useSearchParams();
  const defaults = { local: user?.role === 'owner' ? scope : user?.location ?? 'Principal', q: '', desde: '', hasta: '', tipo: '', etiqueta: '', proveedor: '', estado: 'activos', gasto: '', vinculo: '', revision_estado: '', responsable: '', vencidos: '' };
  const applied = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value])) as typeof defaults;
  if (!['Todos', 'Principal', 'Segundo Local'].includes(applied.local)) applied.local = defaults.local;
  if (user?.role !== 'owner') applied.local = defaults.local;
  if (applied.gasto && (!/^[1-9]\d*$/.test(applied.gasto) || !Number.isSafeInteger(Number(applied.gasto)))) applied.gasto = '';
  const page = Math.max(1, Math.min(100000, Number(params.get('pagina')) || 1));
  const [filters, setFilters] = useState(applied);
  const appliedKey = JSON.stringify(applied);
  useEffect(() => { setFilters(JSON.parse(appliedKey) as typeof defaults); }, [appliedKey]);
  const apply = (value: typeof defaults) => setParams({ ...value, pagina: '1' });
  const setPage = (value: number) => setParams({ ...applied, pagina: String(value) });
  const [upload, setUpload] = useState(false); const [detail, setDetail] = useState<{ id: number; review?: boolean } | null>(null); const [success, setSuccess] = useState(''); const [exporting, setExporting] = useState(false);
  const today = localDate();
  const query = new URLSearchParams({ ...applied, pagina: String(page), hoy: today });
  const { data, loading, error, reload } = useApiRead<[DocumentPage, Provider[]]>([`/api/documentos?${query}`, '/api/proveedores'], async r => Promise.all([readDocumentPage(r[0]), readProviders(r[1])]));
  const reset = () => apply({ ...defaults, local: user?.role === 'owner' ? 'Todos' : user?.location ?? 'Principal' });
  const quickReview = (value: Partial<typeof defaults>) => { if (JSON.stringify(filters) !== appliedKey && !window.confirm('¿Descartar los filtros sin aplicar y abrir esta vista de revisión?')) return; apply({ ...defaults, local: applied.local, ...value }); };
  return <div className="space-y-6">
    <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-4 sm:p-7 text-white space-y-4">
      <div className="flex flex-wrap justify-between items-start gap-4"><div className="space-y-2"><p className="text-xs uppercase tracking-widest text-brand-200 flex gap-2 items-center"><FolderLock size={16} /> Archivo privado</p><h2 className="text-2xl sm:text-3xl font-bold">Documentos</h2><p className="text-sm text-slate-200 max-w-xl">Cada factura, ticket y justificante en su local. Clasificados, disponibles y conectados con tus gastos.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => setUpload(true)} className="flex items-center gap-2 bg-white text-slate-900 rounded-xl px-4 py-3 font-semibold"><Upload size={18} /> Incorporar documento</button><button onClick={() => setExporting(true)} className="rounded-xl border border-white/50 px-4 py-3">Paquete para gestoría</button></div></div>
      <div className="hidden sm:flex flex-wrap gap-4 text-xs text-slate-200"><span>01 · Captura o sube</span><span>02 · Clasifica por local y etiquetas</span><span>03 · Recupera y descarga</span></div>
    </header>
    {success && <p role="status" className="bg-emerald-50 text-emerald-900 rounded-xl p-3">{success}</p>}
    <details className="rounded-2xl border bg-white dark:bg-slate-900 p-4" open={!!(applied.revision_estado || applied.responsable || applied.vencidos)}>
      <summary className="cursor-pointer font-semibold py-2">Bandeja de revisión · {locationLabel(applied.local)}</summary>
      <p className="text-xs text-slate-500 my-3">Todos los documentos activos del local, sin otros filtros. Estas vistas limpian los filtros anteriores. La fecha límite es documental, no de pago.</p>
      {data && !loading && !error ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{([
        ['Pendientes', data[0].resumen.pendientes, { revision_estado: 'pendiente' }],
        ['En revisión', data[0].resumen.en_revision, { revision_estado: 'en_revision' }],
        ['Revisados', data[0].resumen.revisados, { revision_estado: 'revisado' }],
        ['Fuera de plazo', data[0].resumen.vencidos, { vencidos: '1' }],
        ['Sin responsable', data[0].resumen.sin_asignar, { responsable: 'sin_asignar', revision_estado: 'abiertos' }],
      ] as const).map(([title, count, value]) => <button key={title} onClick={() => quickReview(value)} className="rounded-xl border p-3 text-left hover:bg-brand-50 dark:hover:bg-slate-800"><span className="block text-2xl font-bold">{count}</span><span className="text-sm">{title}</span></button>)}<button onClick={() => quickReview({ responsable: 'mios', revision_estado: 'abiertos' })} className="rounded-xl border p-3 text-left font-semibold">Mis pendientes →</button></div> : <p className="text-sm">{error ? 'El resumen no está disponible. Reintenta la consulta del archivo.' : 'Cargando revisión...'}</p>}
    </details>
    <form aria-label="Filtros del archivo" onSubmit={e => { e.preventDefault(); apply(filters); }} className="rounded-2xl border bg-white dark:bg-slate-900 p-4 space-y-4">
      <div className="flex flex-wrap justify-between gap-3 items-center"><h3 className="font-semibold flex gap-2 items-center"><Search size={18} /> Encuentra tu documento</h3><Link to="/escaner" className="text-sm underline">Ir al escáner</Link></div>
      <label className="block">Buscar título, archivo, proveedor o notas<input value={filters.q} maxLength={160} onChange={e => setFilters({ ...filters, q: e.target.value })} className={documentInput} placeholder="Ej.: cafetera, pedido de pan..." /></label>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label>Local del archivo<select value={filters.local} onChange={e => setFilters({ ...filters, local: e.target.value })} className={documentInput}>{user?.role === 'owner' && <option value="Todos">Ambos locales</option>}{(user?.role === 'owner' ? ['Principal', 'Segundo Local'] : [user?.location ?? 'Principal']).map(l => <option key={l} value={l}>{locationLabel(l)}</option>)}</select></label>
        <label>Tipo<select value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })} className={documentInput}><option value="">Todos los tipos</option>{Object.entries(documentTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <details className="text-sm"><summary className="cursor-pointer font-medium py-2">Más filtros: fechas, proveedor, etiquetas y archivo</summary><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
        <label>Desde<input type="date" value={filters.desde} onChange={e => setFilters({ ...filters, desde: e.target.value })} className={documentInput} /></label>
        <label>Hasta<input type="date" min={filters.desde} value={filters.hasta} onChange={e => setFilters({ ...filters, hasta: e.target.value })} className={documentInput} /></label>
        <label>Proveedor del archivo<select value={filters.proveedor} onChange={e => setFilters({ ...filters, proveedor: e.target.value })} className={documentInput}><option value="">Todos los proveedores</option>{data?.[1].map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        <label>Etiqueta exacta<input value={filters.etiqueta} maxLength={40} onChange={e => setFilters({ ...filters, etiqueta: e.target.value })} className={documentInput} placeholder="Ej.: pendiente de pago" /></label>
        <label>Estado<select value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value })} className={documentInput}><option value="activos">Activos</option><option value="archivados">Archivados</option><option value="todos">Todos</option></select></label>
        <label>Vínculo contable<select value={filters.vinculo} onChange={e => setFilters({ ...filters, vinculo: e.target.value })} className={documentInput}><option value="">Con y sin gasto</option><option value="sin_gasto">Sin gasto vinculado</option><option value="con_gasto">Con gasto vinculado</option></select></label>
        <label>Revisión documental<select value={filters.revision_estado} onChange={e => setFilters({ ...filters, revision_estado: e.target.value })} className={documentInput}><option value="">Todos los estados</option><option value="abiertos">Pendientes y en revisión</option>{Object.entries(reviewStates).map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select></label>
        <label>Asignación de revisión<select value={filters.responsable} onChange={e => setFilters({ ...filters, responsable: e.target.value })} className={documentInput}><option value="">Cualquier responsable</option><option value="mios">Asignados a mí</option><option value="sin_asignar">Sin responsable</option>{filters.responsable && !['mios', 'sin_asignar'].includes(filters.responsable) && <option value={filters.responsable}>Responsable #{filters.responsable}</option>}</select></label>
        <label className="flex gap-2 items-center"><input type="checkbox" checked={filters.vencidos === '1'} onChange={e => setFilters({ ...filters, vencidos: e.target.checked ? '1' : '' })} />Solo fuera de plazo</label>
      </div></details>
      <div className="flex flex-wrap gap-3 items-center"><button className="bg-brand-600 text-white px-4 py-2.5 rounded-lg">Aplicar filtros</button><button type="button" className="underline py-2.5" onClick={reset}>Limpiar</button><p className="text-xs text-slate-500">{applied.estado === 'activos' ? 'Solo activos' : applied.estado === 'archivados' ? 'Solo archivados' : 'Activos y archivados'}{applied.etiqueta ? ` · Etiqueta: ${applied.etiqueta}` : ''}{applied.desde ? ` · Desde ${applied.desde}` : ''}{applied.hasta ? ` · Hasta ${applied.hasta}` : ''}{applied.proveedor ? ' · Proveedor filtrado' : ''}</p></div>
      {applied.gasto && <p className="text-sm rounded-lg bg-brand-50 text-brand-900 p-2">Justificantes del gasto n.º {applied.gasto} · <button type="button" className="underline" onClick={reset}>Quitar filtro de gasto</button></p>}
      {JSON.stringify(filters) !== appliedKey && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">Filtros modificados: pulsa Aplicar filtros para actualizar los resultados.</p>}
      <p className="text-sm">Viendo: {locationLabel(applied.local)}{applied.tipo ? ` · ${documentTypes[applied.tipo as keyof typeof documentTypes] ?? applied.tipo}` : ''}{applied.q ? ` · Búsqueda: ${applied.q}` : ''}{applied.vinculo ? ` · ${applied.vinculo === 'sin_gasto' ? 'Sin' : 'Con'} gasto vinculado` : ''}</p>
      {(applied.revision_estado || applied.responsable || applied.vencidos) && <p className="text-sm text-brand-700 dark:text-brand-300">Revisión: {applied.revision_estado === 'abiertos' ? 'Pendientes y en revisión' : reviewStates[applied.revision_estado as keyof typeof reviewStates] ?? 'Todos los estados'}{applied.responsable ? ` · ${applied.responsable === 'mios' ? 'Asignados a mí' : applied.responsable === 'sin_asignar' ? 'Sin responsable' : 'Responsable #' + applied.responsable}` : ''}{applied.vencidos ? ' · Fuera de plazo' : ''} · Orden por fecha límite</p>}
    </form>
    <section aria-label="Resultados del archivo" className="space-y-4">
      <div className="flex justify-between items-center gap-3"><h3 className="text-lg font-semibold">Archivo del local</h3><button onClick={reload} disabled={loading} className="text-sm underline disabled:opacity-50">Actualizar documentos</button></div>
      {loading ? <p role="status">Cargando documentos...</p> : error ? <RequestError message={error} onRetry={reload} /> : data && <>
        <p className="text-sm text-slate-500">{data[0].total} {data[0].total === 1 ? 'documento encontrado' : 'documentos encontrados'} · Página {data[0].pagina} de {Math.max(1, Math.ceil(data[0].total / 24))}</p>
        {data[0].items.length === 0 ? <div className="border border-dashed rounded-2xl p-8 text-center space-y-3"><FolderLock className="mx-auto text-slate-400" size={36} /><h4 className="font-semibold">No hay documentos en esta selección</h4><p className="text-sm text-slate-500">Prueba otros filtros o incorpora el primer documento del local.</p><button onClick={() => setUpload(true)} className="underline">Subir un documento</button></div> : <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{data[0].items.map(d => <li key={d.id} className="rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden min-w-0">
          <div className={d.local === 'Principal' ? 'bg-brand-50 text-brand-900' : 'bg-orange-50 text-orange-900'}><DocumentThumbnail doc={d} /><p className="px-4 py-2 text-xs font-semibold border-t border-black/5">{locationLabel(d.local)} · {d.mime === 'application/pdf' ? 'PDF' : 'IMAGEN'}</p></div>
          <div className="p-4 space-y-3 break-words"><div><p className="text-xs text-slate-500">{documentTypes[d.tipo]} · {d.fecha}{d.archivado ? ' · Archivado' : ''}</p><h4 className="font-bold mt-1">{d.titulo}</h4><p className="text-sm text-slate-500">{d.proveedor_nombre || 'Sin proveedor'} · {documentSize(d.bytes)}</p></div>
            <div className="flex flex-wrap gap-1">{d.etiquetas.map(t => <button key={t} aria-label={`Filtrar por etiqueta ${t}`} onClick={() => { if (JSON.stringify(filters) === appliedKey || window.confirm('¿Descartar los filtros sin aplicar y filtrar esta selección por la etiqueta?')) apply({ ...applied, etiqueta: t }); }} className="text-xs rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-2">{t}</button>)}</div>
            <p className="text-xs text-slate-500 flex gap-1 items-center"><Receipt size={14} />{d.gasto_id ? `Vinculado al gasto #${d.gasto_id}` : 'Sin gasto vinculado'}</p>
            <div className={`rounded-lg p-3 text-sm ${d.revision_estado === 'revisado' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}><p className="font-semibold">{reviewStates[d.revision_estado]}{!d.archivado && d.revision_estado !== 'revisado' && d.revision_fecha_limite && d.revision_fecha_limite < today ? ' · Fuera de plazo' : ''}</p><p>{d.revision_responsable_nombre ?? 'Sin responsable'}{d.revision_fecha_limite ? ` · Límite ${d.revision_fecha_limite}` : ''}</p></div>
            <button onClick={() => setDetail({ id: d.id })} className="w-full rounded-lg border border-brand-300 text-brand-700 dark:text-brand-300 py-2 font-semibold">Abrir {d.titulo}</button>
            {!d.archivado && <button onClick={() => setDetail({ id: d.id, review: true })} className="w-full rounded-lg bg-brand-600 text-white py-2.5" aria-label={`Revisar ${d.titulo}`}>Gestionar revisión</button>}
          </div>
        </li>)}</ul>}
        <div className="flex justify-between gap-3"><button disabled={data[0].pagina <= 1} onClick={() => setPage(data[0].pagina - 1)} className="border rounded-lg px-4 py-2 disabled:opacity-40">Anterior</button><button disabled={data[0].pagina * 24 >= data[0].total} onClick={() => setPage(data[0].pagina + 1)} className="border rounded-lg px-4 py-2 disabled:opacity-40">Siguiente</button></div>
      </>}
    </section>
    <p className="text-xs text-slate-500">Acceso restringido por usuario y local. Las etiquetas son organizativas, no estados contables. Los documentos archivados se conservan y pueden recuperarse.</p>
    {upload && <DocumentUpload local={filters.local} onClose={() => setUpload(false)} onSaved={id => { setUpload(false); setSuccess(`Documento n.º ${id} guardado. Puedes revisar su ficha y vincular un gasto.`); setDetail({ id }); void reload(); }} />}
    {detail !== null && <DocumentDetail id={detail.id} startReview={detail.review} onClose={() => setDetail(null)} onChanged={() => { void reload(); }} />}
    {exporting && <DocumentPackage local={applied.local} onClose={() => setExporting(false)} />}
  </div>;
}
