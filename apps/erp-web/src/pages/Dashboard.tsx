import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocalScope } from '../hooks/useLocalScope';
import { useApiRead } from '../hooks/useApiLists';
import RequestError from '../components/RequestError';
import LocalFilter from '../components/LocalFilter';
import { localDate } from '../localDate';
import { dashboardFinancialSummary, readDashboardLists, selectDashboardLocation } from '../dashboardData';
import { formatCivilDate, formatEuroCents, toCents } from '../financialValues';
import { formatPresenceTimestamp, presenceTimestamp } from '../presenceData';
import { LOCATIONS, locationLabel } from '../locations';

const panel = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3';
const action = 'block rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-medium hover:border-brand-500 focus-visible:outline-brand-500';

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedLocal, setSelectedLocal] = useLocalScope();
  const { data, loading, error, reload } = useApiRead([
    '/api/cierres', '/api/gastos', '/api/tareas', '/api/eventos', '/api/inventario', '/api/usuarios', '/api/fichajes/presencia', '/api/turnos', '/api/pedidos'
  ], readDashboardLists);
  if (loading) return <p role="status" className="p-8 text-center">Cargando resumen...</p>;
  if (error || !data) return <RequestError message={error || 'No se pudo cargar el resumen.'} onRetry={reload} />;
  const [cierres, gastos, tareas, eventos, productos, usuarios, presencia, turnos, pedidos] = selectDashboardLocation(data, selectedLocal);
  const today = localDate();
  const financial = dashboardFinancialSummary([cierres, gastos], today);
  const pendingTasks = tareas.filter(task => !task.completada);
  const dueTasks = pendingTasks.filter(task => task.fecha <= today).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const todayTasks = dueTasks.filter(task => task.fecha === today);
  const overdue = dueTasks.filter(task => task.fecha < today);
  const lowStock = productos.filter(product => product.stock_actual <= product.stock_minimo);
  const pendingOrders = pedidos.filter(order => order.estado === 'pendiente');
  const todayShifts = turnos.filter(shift => shift.fecha === today);
  const nextEvents = eventos.filter(event => event.fecha >= today).slice(0, 3);
  const missingClosings = LOCATIONS.filter(location => (selectedLocal === 'Todos' || location.value === selectedLocal) && !cierres.some(row => row.local === location.value && row.fecha === today));
  const staffNames = new Map(data[5].map(person => [person.id, person.nombre]));

  return <div className="space-y-6 [overflow-wrap:anywhere]">
    <header className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">Hola, {user?.name?.split(' ')[0] || 'equipo'} 👋</p>
      <h2 className="text-2xl font-bold">{selectedLocal === 'Todos' ? 'Hoy en tus locales' : `Hoy en ${locationLabel(selectedLocal)}`}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <LocalFilter value={selectedLocal} onChange={setSelectedLocal} />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={reload} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">Actualizar resumen</button>
        <p className="text-xs text-slate-500 dark:text-slate-400">Datos de la última carga. No se actualizan automáticamente.</p>
      </div>
    </header>

    <section aria-label="Necesita atención" className={panel}>
      <h3 className="font-semibold text-lg">Necesita atención</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {overdue.length > 0 && <Link to="/tareas" className={`${action} text-red-700 dark:text-red-400`}>{overdue.length} tarea{overdue.length === 1 ? '' : 's'} atrasada{overdue.length === 1 ? '' : 's'} →</Link>}
        {todayTasks.length > 0 && <Link to="/tareas" className={action}>{todayTasks.length} tarea{todayTasks.length === 1 ? '' : 's'} para hoy</Link>}
        {lowStock.length > 0 && <Link to="/inventario" className={`${action} text-amber-700 dark:text-amber-400`}>{lowStock.length} producto{lowStock.length === 1 ? '' : 's'} con stock bajo</Link>}
        {pendingOrders.length > 0 && <Link to="/control-stock" className={action}>{pendingOrders.length} pedido{pendingOrders.length === 1 ? '' : 's'} pendiente{pendingOrders.length === 1 ? '' : 's'} de recepción →</Link>}
      </div>
      {dueTasks.length === 0 && lowStock.length === 0 && pendingOrders.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Sin tareas vencidas o de hoy, alertas de stock ni pedidos pendientes.</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">Los pedidos muestran lo pendiente; todavía no tienen una fecha prevista de entrega.</p>
    </section>

    <nav aria-label="Acciones del día" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Link to="/turno" className={action}>Relevo y rutinas</Link>
      <Link to="/tareas" className={action}>Organizar tareas</Link>
      <Link to="/control-stock" className={action}>Revisar pedidos</Link>
      <Link to="/gastos" className={action}>Registrar gasto</Link>
      <Link to="/ventas" className={action}>Registrar cierre</Link>
    </nav>

    <div className="grid lg:grid-cols-2 gap-5">
      <section aria-label="Tareas del día" className={panel}>
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-lg">Tareas del día</h3><Link className="text-sm underline" to="/tareas">Ver todas ({pendingTasks.length} pendientes)</Link></div>
        {dueTasks.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No hay tareas pendientes para hoy ni atrasadas.</p> : <ul className="space-y-2">
          {dueTasks.slice(0, 5).map(task => <li key={task.id} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
            <Link to="/tareas" className="font-medium text-sm underline">{task.titulo}</Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{task.fecha < today ? `Atrasada · ${formatCivilDate(task.fecha)}` : 'Hoy'} · {locationLabel(task.local, 'Ambos')} · {task.asignado_nombre || 'Equipo'}</p>
          </li>)}
        </ul>}
      </section>
      <section aria-label="Turnos de hoy" className={panel}>
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-lg">Turnos de hoy</h3><Link className="text-sm underline" to="/rrhh">Personal y turnos</Link></div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Turnos que comienzan hoy. El horario programado no confirma presencia.</p>
        {todayShifts.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No hay turnos programados para hoy.</p> : <ul className="space-y-2">
          {todayShifts.map(shift => <li key={shift.id} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm">
            <p className="font-medium">{staffNames.get(shift.usuario_id) || `Persona #${shift.usuario_id}`}</p>
            <p>{shift.hora_inicio}–{shift.hora_fin}{shift.hora_fin < shift.hora_inicio ? ' (termina mañana)' : ''} · {locationLabel(shift.local)}</p>
          </li>)}
        </ul>}
        <p className="text-xs text-slate-500 dark:text-slate-400"><span>Plantilla activa</span>: {usuarios.length}</p>
      </section>
    </div>

    <section aria-label="Cierre de hoy" className={panel}>
      <h3 className="font-semibold text-lg">Cierre de hoy</h3>
      <p className="text-sm">{missingClosings.length ? `Sin registrar: ${missingClosings.map(location => location.label).join(' y ')}.` : 'El cierre de hoy está registrado en los locales seleccionados.'}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Es un estado de registro, no un aviso de retraso. No hay horarios de cierre configurados.</p>
      <Link to="/ventas" className="inline-block text-sm underline">Ver cierres de caja</Link>
    </section>

    <section aria-label="Presencia registrada" className={panel}>
      <h3 className="font-semibold text-lg">Presencia registrada</h3>
      {presencia.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No hay información de turnos disponible.</p> : <ul className="grid gap-2 sm:grid-cols-2">
        {presencia.map(person => {
          const outside = person.estado_presencia === 'fuera';
          const timestamp = outside ? person.ultimo_fichaje_salida : person.ultimo_fichaje_entrada;
          return <li key={person.usuario_id} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm">
            <p className="font-semibold">{person.usuario_nombre}</p>
            <p><span>{locationLabel(person.usuario_local)}</span> · <span>{outside ? 'Fuera' : person.estado_presencia === 'descanso' ? 'Descanso' : 'Trabajando'}</span></p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{timestamp ? <>{outside ? 'Salida' : 'Entrada'}: <time dateTime={presenceTimestamp(timestamp).toISOString()}>{formatPresenceTimestamp(timestamp)}</time></> : 'Sin fichajes registrados'}</p>
          </li>;
        })}
      </ul>}
    </section>

    <section aria-label="Próximos eventos" className={panel}>
      <h3 className="font-semibold text-lg">Próximos eventos</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">Agenda común: los eventos aún no tienen local asignado.</p>
      {nextEvents.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No hay próximos eventos registrados.</p>}
      {nextEvents.map(event => <Link key={event.id} to="/agenda" className={action}>{event.titulo} · {formatCivilDate(event.fecha)} · {event.hora}</Link>)}
      <Link to="/agenda" className="text-sm underline">Agenda</Link>
    </section>

    <section aria-label="Resumen financiero mensual" className={panel}>
      <h3 className="font-semibold text-lg">Resumen económico · {new Date().toLocaleDateString('es-ES', { month: 'long' })}</h3>
      {financial.inconsistentHistory && <p role="alert" className="text-amber-700 dark:text-amber-400">Hay cierres cuyo total no coincide con efectivo más tarjeta. Se conservan los totales registrados; revisa el historial.</p>}
      <dl className="grid gap-4 sm:grid-cols-3">
        <div><dt className="text-sm text-slate-500 dark:text-slate-400">Ingresos</dt><dd className="text-xl font-bold">{formatEuroCents(financial.income)}</dd></div>
        <div><dt className="text-sm text-slate-500 dark:text-slate-400">Gastos</dt><dd className="text-xl font-bold">{formatEuroCents(financial.expenses)}</dd></div>
        <div><dt className="text-sm text-slate-500 dark:text-slate-400">Saldo ingresos − gastos</dt><dd className="text-xl font-bold">{formatEuroCents(financial.balance)}</dd></div>
      </dl>
      <p className="text-xs text-slate-500 dark:text-slate-400">Cierres: {financial.closingCount} · Último cierre: {financial.latest ? `${formatEuroCents(toCents(financial.latest.total))} · ${formatCivilDate(financial.latest.fecha)} · ${locationLabel(financial.latest.local)}` : 'Sin cierres'}</p>
      <div className="flex flex-wrap gap-4 text-sm underline"><Link to="/analiticas">Evolución económica</Link><Link to="/informes">Informe mensual</Link></div>
    </section>
  </div>;
}
