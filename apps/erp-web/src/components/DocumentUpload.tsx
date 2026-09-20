import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApiRead } from '../hooks/useApiLists';
import { readProviders } from '../catalogData';
import { API_URL } from '../config';
import { readJson, errorMessage } from '../apiResponse';
import { emptyDocument, prepareDocument, validateDocumentFiles, readFileBase64, documentSize, type DocumentFields as Fields } from '../documentData';
import DocumentFields from './DocumentFields';
import { includePendingTag } from '../documentData';
import ModalDialog from './ModalDialog';
import RequestError from './RequestError';
import DocumentImage from './DocumentImage';
const PdfPreview = lazy(() => import('./PdfPreview'));

function PagePreview({ file }: { file: File }) {
  const [url, setUrl] = useState(''); const [open, setOpen] = useState(false);
  useEffect(() => { const value = URL.createObjectURL(file); setUrl(value); return () => URL.revokeObjectURL(value); }, [file]);
  return url ? <details className="mt-2" onToggle={e => setOpen(e.currentTarget.open)}><summary className="cursor-pointer underline">Vista previa de {file.name}</summary>{open && (file.type === 'application/pdf' ? <Suspense fallback={<p role="status">Cargando visor PDF...</p>}><PdfPreview url={url} title={file.name} /></Suspense> : <DocumentImage url={url} title={file.name} />)}</details> : null;
}

export default function DocumentUpload({ initialFile, local, onClose, onSaved }: { initialFile?: File; local: string; onClose: () => void; onSaved: (id: number) => void }) {
  const { user, fetchWithAuth } = useAuth();
  const { data: providers, loading, error: loadError, reload } = useApiRead(['/api/proveedores'], r => readProviders(r[0]));
  const [draft, setDraft] = useState<Fields>(() => ({ ...emptyDocument(local), titulo: initialFile?.name.replace(/\.[^.]+$/, '') ?? '' }));
  const [files, setFiles] = useState<File[]>(initialFile ? [initialFile] : []);
  const [tag, setTag] = useState('');
  const [initialDraft] = useState(draft);
  const dirty = !!files.length || !!tag || JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [pending, setPending] = useState<{ key: string; body: string } | null>(null);
  const active = useRef(true); const sending = useRef(false);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || busy || pending) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty, busy, pending]);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const close = () => { if (sending.current) return; if ((dirty || pending) && !window.confirm(pending ? 'El servidor puede haber guardado el archivo. Comprueba Documentos antes de repetir. ¿Cerrar y descartar este intento?' : '¿Cerrar y descartar el borrador del documento?')) return; onClose(); };
  const select = (selected: File[]) => {
    if (pending || busy || !selected.length) return;
    try { const next = [...files, ...selected]; validateDocumentFiles(next); setFiles(next); if (!draft.titulo) setDraft({ ...draft, titulo: selected[0].name.replace(/\.[^.]+$/, '').slice(0, 160) }); setError(''); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (sending.current || !providers) return;
    sending.current = true; setBusy(true); setError('');
    try {
      let attempt = pending;
      if (!attempt) {
        const classified = includePendingTag(draft, tag); setDraft(classified); setTag('');
        const file = await prepareDocument(files); const base64 = await readFileBase64(file);
        if (!active.current) return;
        attempt = { key: crypto.randomUUID(), body: JSON.stringify({ ...classified, archivo: { nombre: file.name, mime: file.type, base64 } }) }; setPending(attempt);
      }
      const response = await fetchWithAuth(`${API_URL}/api/documentos`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key }, body: attempt.body });
      // Definite validation/conflict failures can be corrected. Unknown outcomes retain the exact request.
      if ([400, 409, 413].includes(response.status) && active.current) setPending(null);
      const result = await readJson<{ id: number }>(response);
      if (!Number.isSafeInteger(result.id) || result.id <= 0) throw new Error('Guardado sin confirmación válida. Revisa el archivo antes de repetir.');
      if (active.current) { setPending(null); onSaved(result.id); }
    } catch (cause) { if (active.current) setError(errorMessage(cause)); }
    finally { sending.current = false; if (active.current) setBusy(false); }
  };
  return <ModalDialog label="Incorporar documento" busy={busy} onClose={close} wide><form onSubmit={save} className="p-5 space-y-5">
    <div className="sticky -top-5 z-10 -mx-5 -mt-5 px-5 py-3 bg-white dark:bg-slate-900 border-b flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Incorporar documento</h2><p className="text-sm text-slate-500">Captura, clasifica y conserva.</p></div><button type="button" disabled={busy} onClick={close} className="border rounded-lg p-2">Cerrar</button></div>
    <p className="text-sm">PDF o fotos, hasta 10 MB por archivo final. Varias fotos se unirán en un PDF en el orden indicado. No se envían a servicios de IA.</p>
    <fieldset disabled={busy || !!pending} className="space-y-3 min-w-0">
      <label className="block rounded-xl border border-dashed border-brand-400 p-4">Seleccionar PDF o imágenes<input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full mt-2 text-sm" onChange={e => { select(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
      <label className="block">Fotografiar otra página<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="block w-full text-sm mt-1" onChange={e => { select(Array.from(e.target.files ?? [])); e.target.value = ''; }} /></label>
      <ol className="space-y-2">{files.map((file, index) => <li key={`${index}:${file.name}`} className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-sm break-words"><p>{index + 1}. {file.name} · {documentSize(file.size)}</p><PagePreview file={file} /><div className="flex gap-3 mt-1"><button type="button" disabled={index === 0} className="underline disabled:opacity-40" onClick={() => setFiles(rows => { const next = [...rows]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>Subir página {index + 1}</button><button type="button" className="underline" onClick={() => setFiles(rows => rows.filter((_, i) => i !== index))}>Quitar página {index + 1}</button></div></li>)}</ol>
    </fieldset>
    {loading ? <p role="status">Cargando proveedores...</p> : loadError ? <RequestError message={loadError} onRetry={reload} /> : providers && <DocumentFields value={draft} onChange={setDraft} tag={tag} setTag={setTag} providers={providers} locals={user?.role === 'owner' ? ['Principal', 'Segundo Local'] : [user?.location ?? 'Principal']} disabled={busy || !!pending} />}
    <RequestError message={error} />
    {pending && !busy && <p className="text-sm text-amber-800 dark:text-amber-300">El guardado no está confirmado. Reintentar usa exactamente la misma clave y no crea otro documento. No recargues; si sales, comprueba el archivo antes de repetir.</p>}
    <button type="submit" disabled={busy || !providers || (!files.length && !pending)} className="w-full bg-brand-600 rounded-xl p-3 text-white font-semibold disabled:opacity-50">{busy ? 'Preparando y guardando...' : pending ? 'Confirmar guardado pendiente' : 'Guardar en Documentos'}</button>
    <p className="text-xs text-slate-500">Guardar no registra ningún gasto. La clasificación se conserva en base de datos; el archivo queda en almacenamiento privado.</p>
  </form></ModalDialog>;
}
