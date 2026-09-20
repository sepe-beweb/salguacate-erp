import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApiRead } from '../hooks/useApiLists';
import { API_URL } from '../config';
import { errorMessage, readJson } from '../apiResponse';
import { documentInput, documentSize } from '../documentData';
import { readDocumentPackage, type PackageScope } from '../documentPackageData';
import { reviewStates } from '../documentReviewData';
import { localDate } from '../localDate';
import { locationLabel } from '../locations';
import ModalDialog from './ModalDialog';
import RequestError from './RequestError';

function Selection({ scope, onBusy }: { scope: PackageScope; onBusy: (busy: boolean) => void }) {
  const { fetchWithAuth } = useAuth();
  const query = new URLSearchParams({ local: scope.local, mes: scope.mes, incluir_pendientes: scope.incluir_pendientes ? '1' : '' });
  const { data, loading, error, reload } = useApiRead([`/api/documentos/paquete?${query}`], r => readDocumentPackage(r[0], scope));
  const [url, setUrl] = useState(''); const [failure, setFailure] = useState(''); const [busy, setBusy] = useState(false);
  const active = useRef(true); const guard = useRef(false); const objectUrl = useRef('');
  useEffect(() => { active.current = true; return () => { active.current = false; if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }; }, []);
  const prepare = async () => {
    if (!data || !data.total || guard.current) return; guard.current = true; setBusy(true); onBusy(true); setFailure('');
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = ''; setUrl('');
    try {
      const response = await fetchWithAuth(`${API_URL}/api/documentos/paquete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...scope, huella: data.huella }) });
      if (!response.ok) { await readJson(response); return; }
      const blob = await response.blob();
      if (blob.type !== 'application/zip' || blob.size < 22 || blob.size > 52 * 1024 * 1024) throw new Error('El servidor no devolvió un ZIP válido.');
      if (!active.current) return;
      objectUrl.current = URL.createObjectURL(blob); setUrl(objectUrl.current);
    } catch (cause) { if (active.current) setFailure(errorMessage(cause)); }
    finally { guard.current = false; if (active.current) { setBusy(false); onBusy(false); } }
  };
  const refresh = () => { if (guard.current) return; if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = ''; setUrl(''); setFailure(''); void reload(); };
  return <section aria-label="Vista previa del paquete" className="space-y-3">
    {loading ? <p role="status">Comprobando documentos del mes...</p> : error ? <RequestError message={error} onRetry={refresh} /> : data && <>
      <p className="font-semibold">{data.total} documentos · {documentSize(data.bytes)}</p>
      <p className="text-sm">{data.local === 'Todos' ? 'Ambos locales' : locationLabel(data.local)} · {data.mes} · {data.incluir_pendientes ? 'Incluye pendientes y en revisión' : 'Solo revisados'}. Siempre excluye archivados.</p>
      {data.total ? <ul className="max-h-60 overflow-auto divide-y border rounded-lg p-3 text-sm">{data.documentos.map(d => <li key={d.id} className="py-2 break-words">{d.fecha} · {d.local === 'Salmon' ? 'Salmón' : d.local} · {d.titulo} <span className="text-slate-500">({reviewStates[d.revision_estado as keyof typeof reviewStates]})</span></li>)}</ul> : <p>No hay documentos con este alcance. Cambia el mes, el local o incluye pendientes.</p>}
      <button type="button" disabled={busy || !data.total} onClick={() => { void prepare(); }} className="rounded-lg bg-brand-600 text-white px-4 py-3 disabled:opacity-50">{busy ? 'Verificando originales...' : 'Preparar ZIP'}</button>
      {url && <div role="status" className="rounded-lg bg-emerald-50 text-emerald-900 p-3 space-y-2"><p>Paquete listo. No se ha enviado a terceros.</p><a href={url} download={`salguacate-${scope.mes}-${scope.local === 'Todos' ? 'ambos-locales' : scope.local === 'Principal' ? 'Aguacate' : 'Salmon'}.zip`} className="inline-block underline font-semibold py-2">Descargar ZIP</a></div>}
    </>}
    <RequestError message={failure} />
    <button type="button" disabled={busy || loading} onClick={refresh} className="block underline text-sm py-2">Actualizar vista previa</button>
  </section>;
}

export default function DocumentPackage({ local, onClose }: { local: string; onClose: () => void }) {
  const { user } = useAuth();
  const [scope, setScope] = useState<PackageScope>({ local: user?.role === 'owner' ? local : user?.location ?? 'Principal', mes: localDate().slice(0, 7), incluir_pendientes: false });
  const [applied, setApplied] = useState<PackageScope | null>(null); const [busy, setBusy] = useState(false);
  const change = (next: PackageScope) => { setScope(next); setApplied(null); };
  return <ModalDialog label="Paquete mensual para gestoría" wide busy={busy} onClose={() => { if (!busy) onClose(); }}><div className="p-5 space-y-4">
    <div className="sticky -top-5 z-10 -mx-5 -mt-5 border-b bg-white dark:bg-slate-900 p-5 flex items-start justify-between gap-3"><h2 className="text-xl font-bold">Paquete mensual para gestoría</h2><button disabled={busy} onClick={onClose} className="border rounded-lg p-2">Cerrar paquete</button></div>
    <p className="text-sm">Originales organizados por local, mes y tipo, con índice navegable HTML y manifiesto JSON. Selección por fecha del documento, no por fecha del gasto.</p>
    <p className="text-sm rounded-lg bg-amber-50 text-amber-900 p-3">El ZIP no está cifrado. Descárgalo en un equipo de confianza y compártelo solo por un canal autorizado. No se envía automáticamente a la gestoría.</p>
    <form onSubmit={e => { e.preventDefault(); setApplied({ ...scope }); }}>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block">Local del paquete<select value={scope.local} onChange={e => change({ ...scope, local: e.target.value })} className={documentInput}>{user?.role === 'owner' && <option value="Todos">Ambos locales</option>}{(user?.role === 'owner' ? ['Principal', 'Segundo Local'] : [user?.location ?? 'Principal']).map(l => <option value={l} key={l}>{locationLabel(l)}</option>)}</select></label>
        <label className="block">Mes documental<input type="month" required value={scope.mes} onChange={e => change({ ...scope, mes: e.target.value })} className={documentInput} /></label>
        <label className="flex gap-2 items-start"><input type="checkbox" checked={scope.incluir_pendientes} onChange={e => change({ ...scope, incluir_pendientes: e.target.checked })} />Incluir también pendientes y en revisión</label>
        <button className="border rounded-lg px-4 py-3">Consultar selección</button>
      </fieldset>
    </form>
    {applied && <Selection key={JSON.stringify(applied)} scope={applied} onBusy={setBusy} />}
    <p className="text-xs text-slate-500">Máximo 100 documentos y 50 MB. La descarga no archiva ni cambia estados, pagos o importes. Un original ausente o alterado bloquea el paquete completo.</p>
  </div></ModalDialog>;
}
