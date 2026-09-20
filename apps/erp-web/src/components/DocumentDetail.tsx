import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApiRead } from '../hooks/useApiLists';
import { API_URL } from '../config';
import { errorMessage, readJson } from '../apiResponse';
import { readProviders, type Provider } from '../catalogData';
import { readExpenses, formatExpenseCents, expenseCents, type Expense } from '../expenses';
import { readDocumentDetail, documentTypes, documentSize, documentInput, type DocumentDetail as Detail } from '../documentData';
import { locationLabel } from '../locations';
import ModalDialog from './ModalDialog';
import RequestError from './RequestError';
import DocumentFields from './DocumentFields';
import { includePendingTag } from '../documentData';
import DocumentImage from './DocumentImage';
import DocumentReviewFields from './DocumentReviewFields';
import { reviewDraft, reviewStates } from '../documentReviewData';
const PdfPreview = lazy(() => import('./PdfPreview'));
type Section = 'archivo' | 'clasificacion' | 'gasto' | 'historial' | 'revision';

function DocumentFile({ doc }: { doc: Detail }) {
  const { fetchWithAuth } = useAuth(); const [url, setUrl] = useState(''); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true; let objectUrl = ''; const controller = new AbortController(); setUrl(''); setError('');
    void (async () => {
      try {
        const response = await fetchWithAuth(`${API_URL}/api/documentos/${doc.id}/archivo`, { signal: controller.signal });
        if (!response.ok) { await readJson(response); return; }
        const blob = await response.blob(); if (blob.type !== doc.mime || blob.size !== doc.bytes) throw new Error('El archivo recibido no coincide con la ficha.');
        if (!current) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
      } catch (cause) { if (current) setError(errorMessage(cause)); }
    })();
    return () => { current = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id, doc.mime, doc.bytes, fetchWithAuth, retry]);
  return <section className="space-y-3" aria-label="Archivo privado">
    <RequestError message={error} onRetry={() => setRetry(n => n + 1)} />
    {!url && !error && <p role="status">Recuperando archivo privado...</p>}
    {url && <><a href={url} download={doc.nombre_archivo} className="inline-block rounded-lg bg-brand-600 text-white px-4 py-2">Descargar original</a>
      {doc.mime === 'application/pdf' ? <Suspense fallback={<p role="status">Cargando visor PDF...</p>}><PdfPreview url={url} title={doc.titulo} /></Suspense> : <DocumentImage url={url} title={doc.titulo} />}</>}
  </section>;
}

function Editor({ doc, providers, expenses, onSaved, onBusy, onDirty, tab, setTab }: { doc: Detail; providers: Provider[]; expenses: Expense[]; onSaved: (message: string) => Promise<void>; onBusy: (busy: boolean) => void; onDirty: (dirty: boolean) => void; tab: Section; setTab: (tab: Section) => void }) {
  const { user, fetchWithAuth } = useAuth(); const [draft, setDraft] = useState(doc); const [busy, setBusy] = useState(false); const guard = useRef(false);
  const [error, setError] = useState(''); const [tag, setTag] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [expenseId, setExpenseId] = useState(''); const [expenseSearch, setExpenseSearch] = useState('');
  const [expense, setExpense] = useState({ fecha: doc.fecha, proveedor_nombre: doc.proveedor_nombre ?? '', concepto: doc.titulo, total: '' });
  const [originalExpense] = useState(expense);
  const [review, setReview] = useState(() => reviewDraft(doc));
  const reviewDirty = JSON.stringify(review) !== JSON.stringify(reviewDraft(doc));
  const classificationDirty = !!tag || JSON.stringify(draft) !== JSON.stringify(doc);
  const expenseFormDirty = JSON.stringify(expense) !== JSON.stringify(originalExpense);
  const expenseDirty = !!expenseId || expenseFormDirty;
  const dirty = classificationDirty || expenseDirty || reviewDirty;
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  const linked = expenses.find(e => e.id === doc.gasto_id);
  const available = expenses.filter(e => e.local === doc.local && `${e.id} ${e.proveedor_nombre} ${e.concepto}`.toLocaleLowerCase('es-ES').includes(expenseSearch.toLocaleLowerCase('es-ES')));
  const mutate = async (suffix: string, method: string, body: unknown) => {
    if (guard.current) return;
    if (suffix === '/revision' && (classificationDirty || expenseDirty)) { setError('Guarda o descarta los borradores de clasificación y gasto antes de guardar la revisión.'); return; }
    if (suffix !== '/revision' && reviewDirty) { setError('Guarda primero la revisión pendiente antes de modificar la ficha o el gasto.'); return; }
    if (suffix === '/gasto' && classificationDirty) { setError('Guarda primero la clasificación pendiente antes de modificar el gasto.'); return; }
    if (!suffix && expenseDirty && !window.confirm('Hay un borrador de gasto sin guardar. ¿Descartarlo y guardar la clasificación?')) return;
    if (suffix && ((method === 'PUT' && expenseFormDirty) || (method === 'POST' && !!expenseId)) && !window.confirm('Hay otro borrador de gasto en esta sección. ¿Descartarlo y continuar con esta operación?')) return;
    guard.current = true; setBusy(true); onBusy(true); setError('');
    try {
      const result = await readJson<{ mensaje?: string; id?: number }>(await fetchWithAuth(`${API_URL}/api/documentos/${doc.id}${suffix}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      if (!result || (typeof result.mensaje !== 'string' && (!Number.isSafeInteger(result.id) || Number(result.id) <= 0))) throw new Error('Respuesta de guardado no válida. Actualiza la ficha antes de repetir.');
      if (active.current) await onSaved(result.mensaje ?? `Gasto n.º ${result.id} creado y vinculado.`);
    } catch (cause) { if (active.current) setError(errorMessage(cause) + ' Conservamos tus datos. Si no conoces el resultado, actualiza la ficha antes de repetir.'); }
    finally { guard.current = false; if (active.current) setBusy(false); onBusy(false); }
  };
  const save = (e: FormEvent) => { e.preventDefault(); try { const classified = includePendingTag(draft, tag); setDraft(classified); setTag(''); void mutate('', 'PUT', { ...classified, revision: doc.revision }); } catch (cause) { setError(errorMessage(cause)); } };
  return <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" aria-label="Secciones de la ficha">{([['archivo', 'Archivo'], ['clasificacion', 'Clasificación'], ['revision', 'Revisión'], ['gasto', 'Gasto vinculado'], ['historial', 'Historial']] as const).map(([id, title]) => <button key={id} disabled={busy} type="button" aria-pressed={tab === id} onClick={() => setTab(id)} className={`rounded-lg border px-2 py-3 text-sm ${tab === id ? 'bg-brand-600 text-white' : ''}`}>{title}</button>)}</div>
    <RequestError message={error} />{dirty && <p role="status" className="rounded-lg bg-amber-50 text-amber-900 p-3 text-sm">Tienes cambios sin guardar{classificationDirty ? ' en la clasificación' : reviewDirty ? ' en la revisión' : ' en el borrador de gasto'}. Cambiar de sección los conserva.</p>}
    {dirty && ['clasificacion', 'revision', 'gasto'].includes(tab) && <button disabled={busy} type="button" className="underline text-sm py-2" onClick={() => { if (!window.confirm('¿Descartar el borrador de esta sección? Las otras secciones se conservan.')) return; if (tab === 'clasificacion') { setDraft(doc); setTag(''); } else if (tab === 'revision') setReview(reviewDraft(doc)); else { setExpense(originalExpense); setExpenseId(''); setExpenseSearch(''); } }}>Descartar borrador de esta sección</button>}
    {tab === 'revision' && <form onSubmit={e => { e.preventDefault(); if (review.estado !== 'revisado' || window.confirm('¿Confirmar que has comprobado el documento y su clasificación? No se registrará ningún pago.')) void mutate('/revision', 'PUT', { ...review, revision: doc.revision }); }}><DocumentReviewFields local={doc.local} value={review} onChange={setReview} busy={busy} archived={doc.archivado === 1} /></form>}
    {tab === 'archivo' && <DocumentFile doc={doc} />}
    {tab === 'clasificacion' && <form onSubmit={save} className="space-y-4">
      <DocumentFields value={draft} onChange={v => setDraft({ ...draft, ...v })} tag={tag} setTag={setTag} providers={providers} locals={user?.role === 'owner' ? ['Principal', 'Segundo Local'] : [user?.location ?? 'Principal']} disabled={busy} />
      <label className="flex gap-2 items-start"><input type="checkbox" checked={draft.archivado === 1} disabled={busy} onChange={e => setDraft({ ...draft, archivado: e.target.checked ? 1 : 0 })} />Ocultar de la vista activa (conservar en Archivados)</label>
      <button disabled={busy} className="rounded-lg bg-brand-600 text-white px-4 py-3">Guardar clasificación</button>
      <p className="text-xs text-slate-500">El original nunca se sobrescribe. Archivar no borra el documento ni su gasto.</p>
    </form>}
    {tab === 'gasto' && <section className="space-y-4">
      <p className="text-sm">Conservar una factura no registra su importe. Vincula un gasto existente o crea uno expresamente; ambos deben pertenecer a {locationLabel(doc.local)}.</p>
      {doc.gasto_id ? <div className="rounded-xl border p-4 space-y-3">
        <p className="font-semibold">Gasto n.º {doc.gasto_id}{linked ? ` · ${formatExpenseCents(expenseCents(linked.total))}` : ''}</p>
        {linked && <p>{linked.proveedor_nombre} · {linked.concepto}</p>}
        <Link to={`/gastos?gasto=${doc.gasto_id}&local=${encodeURIComponent(doc.local)}`} onClick={event => { if (busy || (dirty && !window.confirm('¿Descartar los cambios sin guardar y abrir el gasto?'))) event.preventDefault(); }} className="underline">Ver gasto</Link>
        <button type="button" disabled={busy} className="block underline" onClick={() => { if (window.confirm('¿Desvincular el gasto? El gasto y el documento se conservarán.')) void mutate('/gasto', 'PUT', { gasto_id: null, revision: doc.revision }); }}>Desvincular gasto</button>
      </div> : <>
        <form className="border rounded-xl p-4 space-y-3" onSubmit={e => { e.preventDefault(); void mutate('/gasto', 'PUT', { gasto_id: Number(expenseId), revision: doc.revision }); }}>
          <h3 className="font-semibold">Vincular un gasto existente</h3><label className="block">Buscar gasto<input value={expenseSearch} onChange={e => { setExpenseSearch(e.target.value); setExpenseId(''); }} disabled={busy} className={documentInput} /></label>
          <label className="block">Gasto del local<select required value={expenseId} disabled={busy} onChange={e => setExpenseId(e.target.value)} className={documentInput}><option value="">Selecciona un gasto</option>{available.map(e => <option key={e.id} value={e.id}>#{e.id} · {e.fecha} · {e.proveedor_nombre} · {formatExpenseCents(expenseCents(e.total))}</option>)}</select></label>
          <button disabled={busy || !expenseId} className="rounded-lg border p-2 disabled:opacity-50">Vincular gasto seleccionado</button>
        </form>
        <form className="border rounded-xl p-4 space-y-3" onSubmit={e => { e.preventDefault(); if (window.confirm('¿Crear un nuevo gasto y vincularlo a este documento? Comprueba antes que no esté registrado.')) void mutate('/gasto', 'POST', { ...expense, total: Number(expense.total), revision: doc.revision }); }}>
          <h3 className="font-semibold">Crear gasto desde el documento</h3><p className="text-xs">Introduce el importe real. No se interpreta automáticamente el archivo.</p>
          <fieldset disabled={busy || doc.archivado === 1} className="space-y-3">
            <label className="block">Fecha del gasto<input type="date" required value={expense.fecha} onChange={e => setExpense({ ...expense, fecha: e.target.value })} className={documentInput} /></label>
            <label className="block">Nombre del proveedor<input required maxLength={160} value={expense.proveedor_nombre} onChange={e => setExpense({ ...expense, proveedor_nombre: e.target.value })} className={documentInput} /></label>
            <label className="block">Concepto del gasto<input required maxLength={500} value={expense.concepto} onChange={e => setExpense({ ...expense, concepto: e.target.value })} className={documentInput} /></label>
            <label className="block">Importe total (€)<input required type="number" min="0.01" max="1000000" step="0.01" value={expense.total} onChange={e => setExpense({ ...expense, total: e.target.value })} className={documentInput} /></label>
            <button className="rounded-lg bg-brand-600 text-white p-3">Crear y vincular gasto</button>
          </fieldset>{doc.archivado === 1 && <p>Reactiva el documento antes de crear un gasto.</p>}
        </form>
      </>}
    </section>}
    {tab === 'historial' && <ol className="space-y-3">{doc.cambios.map(c => <li key={c.id} className="border-l-2 border-brand-300 pl-3 text-sm"><p className="font-semibold">{c.detalle}</p><p className="text-slate-500">{c.actor_nombre} · {c.creado_en} UTC</p></li>)}</ol>}
  </div>;
}

export default function DocumentDetail({ id, onClose, onChanged, startReview = false }: { id: number; onClose: () => void; onChanged: () => void; startReview?: boolean }) {
  const { data, loading, error, reload } = useApiRead<[Detail, Provider[], Expense[]]>([`/api/documentos/${id}`, '/api/proveedores', '/api/gastos'], async r => Promise.all([readDocumentDetail(r[0]), readProviders(r[1]), readExpenses([r[2]])]));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false); const [message, setMessage] = useState(''); const [tab, setTab] = useState<Section>(startReview ? 'revision' : 'archivo');
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty, busy]);
  const discard = () => !dirty || window.confirm('¿Descartar los cambios sin guardar de esta ficha?');
  const close = () => { if (!busy && discard()) onClose(); };
  return <ModalDialog label="Ficha del documento" onClose={close} busy={busy} extraWide><div className="p-5 space-y-4 break-words">
    <div className="sticky -top-5 z-10 -mx-5 -mt-5 px-5 py-3 bg-white dark:bg-slate-900 border-b flex justify-between items-start gap-3"><h2 className="text-xl font-bold">Ficha del documento</h2><button disabled={busy} onClick={close} className="border rounded-lg p-2">Cerrar ficha</button></div>
    {message && <p role="status" className="rounded-lg bg-emerald-50 text-emerald-900 p-3">{message} El servidor ha confirmado el cambio.</p>}
    {loading ? <p role="status">Cargando ficha...</p> : error ? <RequestError message={error} onRetry={reload} /> : data && <>
      <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 space-y-1"><h3 className="font-bold text-lg">{data[0].titulo}</h3><p>{locationLabel(data[0].local)} · {data[0].fecha} · {documentTypes[data[0].tipo]}</p><p className="text-sm">{data[0].archivado ? 'Archivado · ' : ''}{data[0].nombre_archivo} · {documentSize(data[0].bytes)}</p><p className="text-xs text-slate-500">Incorporado por {data[0].autor_nombre} · {data[0].creado_en} UTC · Revisión {data[0].revision}</p><div className="flex flex-wrap gap-1">{data[0].etiquetas.map(t => <span key={t} className="rounded-full border px-2 text-xs">{t}</span>)}</div></div>
      <p className="rounded-lg border p-3 text-sm">{reviewStates[data[0].revision_estado]} · {data[0].revision_responsable_nombre ?? 'Sin responsable'}{data[0].revision_fecha_limite ? ` · Límite ${data[0].revision_fecha_limite}` : ''}{data[0].revisado_en ? ` · Revisado por ${data[0].revisado_nombre} el ${data[0].revisado_en} UTC` : ''}</p>
      <Editor key={`${id}:${data[0].revision}`} doc={data[0]} providers={data[1]} expenses={data[2]} tab={tab} setTab={setTab} onDirty={setDirty} onBusy={value => { setBusy(value); if (value) setMessage(''); }} onSaved={async message => { setMessage(message); setDirty(false); onChanged(); await reload(); }} />
    </>}
    <button disabled={busy || loading} className="underline text-sm" onClick={() => { if (discard()) { setDirty(false); void reload(); } }}>Actualizar ficha desde el servidor</button>
    <p className="text-xs text-slate-500">Los fallos de envío conservan el formulario mientras permanezcas aquí. Cerrar o actualizar una ficha con cambios pide confirmación.</p>
  </div></ModalDialog>;
}
