import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApiRead } from '../hooks/useApiLists';
import { useLocalScope } from '../hooks/useLocalScope';
import { readHandoverSummary } from '../handoverData';
import { locationLabel } from '../locations';
import { localDate } from '../localDate';

export default function HandoverSummary() {
  const { user } = useAuth(); const [scope, setScope] = useLocalScope(); const fecha = localDate();
  const local = user?.role === 'employee' ? user.location ?? '' : scope;
  const { data, loading, error, reload } = useApiRead([`/api/relevos/resumen?${new URLSearchParams({ local, fecha })}`], readHandoverSummary);
  const verified = data?.fecha === fecha && (local === 'Todos' ? data.locales.length === 2 : data?.locales.length === 1 && data.locales[0].local === local);
  return <section aria-label="Continuidad del servicio" className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="text-lg font-semibold">Continuidad del servicio</h3><button className="text-sm underline" disabled={loading} onClick={reload}>Actualizar relevo</button></div>
    {loading ? <p role="status">Cargando relevo…</p> : error || !verified ? <p role="status" className="text-sm text-amber-700 dark:text-amber-400">No se ha podido verificar el relevo. Actualiza este apartado para consultar los pendientes.</p> : <div className="grid gap-3 sm:grid-cols-2">{data!.locales.map(l => <div key={l.local} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 space-y-2">
      <h4 className="font-semibold">{locationLabel(l.local)}</h4>
      <p className="text-sm">{l.pendientes} avisos pendientes · {l.sin_leer} sin leer</p>
      <p className="text-sm">Rutinas de hoy: {l.pasos ? `${l.completados} de ${l.pasos} pasos completados` : 'sin preparar'}</p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline font-medium" to="/turno?avisos=mios" onClick={() => setScope(l.local)}>Mis pendientes ({l.asignados})</Link>
        <Link className="underline" to="/turno?avisos=sin_responsable" onClick={() => setScope(l.local)}>Sin responsable disponible ({l.sin_responsable})</Link>
      </div>
    </div>)}</div>}
    <p className="text-xs text-slate-500">Última consulta del relevo. Leer un aviso no lo resuelve; las tareas se preparan explícitamente.</p>
  </section>;
}
