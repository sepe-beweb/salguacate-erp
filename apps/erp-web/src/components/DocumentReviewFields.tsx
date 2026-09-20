import { useApiRead } from '../hooks/useApiLists';
import { readReviewers, reviewStates, type ReviewFields } from '../documentReviewData';
import { documentInput } from '../documentData';
import RequestError from './RequestError';

export default function DocumentReviewFields({ local, value, onChange, busy, archived }: { local: string; value: ReviewFields; onChange: (value: ReviewFields) => void; busy: boolean; archived: boolean }) {
  const { data, loading, error, reload } = useApiRead(['/api/documentos/responsables'], r => readReviewers(r[0]));
  const eligible = data?.filter(r => r.rol === 'owner' || r.local === local);
  const unavailable = value.responsable_id !== null && eligible && !eligible.some(r => r.id === value.responsable_id);
  return <div className="space-y-4">
    <p className="text-sm">Revisar significa comprobar el documento, su clasificación y su vínculo. No significa pagarlo ni registrar un gasto.</p>
    {loading && <p role="status">Cargando responsables...</p>}<RequestError message={error} onRetry={reload} />
    <fieldset disabled={busy || loading || !!error || archived} className="space-y-4">
      <label className="block">Estado de revisión<select value={value.estado} onChange={e => onChange({ ...value, estado: e.target.value as ReviewFields['estado'] })} className={documentInput}>{Object.entries(reviewStates).map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select></label>
      <label className="block">Responsable de revisión<select value={value.responsable_id ?? ''} onChange={e => onChange({ ...value, responsable_id: e.target.value ? Number(e.target.value) : null })} className={documentInput}><option value="">Sin asignar</option>{unavailable && <option value={value.responsable_id!}>Responsable ya no disponible: cambia la asignación</option>}{eligible?.map(r => <option value={r.id} key={r.id}>{r.nombre}</option>)}</select></label>
      <label className="block">Fecha límite de revisión<input type="date" value={value.fecha_limite ?? ''} onChange={e => onChange({ ...value, fecha_limite: e.target.value || null })} className={documentInput} /></label>
      <label className="block">Observaciones de revisión<textarea rows={3} maxLength={1000} value={value.observaciones} onChange={e => onChange({ ...value, observaciones: e.target.value })} className={documentInput} /></label>
      <button disabled={!!unavailable} className="rounded-lg bg-brand-600 text-white px-4 py-3 disabled:opacity-50">Guardar revisión</button>
    </fieldset>
    {archived && <p className="text-sm">Reactiva el documento antes de modificar su revisión.</p>}
    <p className="text-xs text-slate-500">Cambiar la clasificación o el gasto de un documento revisado lo devuelve a pendiente. Cada decisión conserva autor y fecha en el historial.</p>
  </div>;
}
