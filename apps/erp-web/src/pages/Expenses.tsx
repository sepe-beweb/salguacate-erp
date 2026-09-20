import { locationLabel } from '../locations';
import { useLocalScope } from '../hooks/useLocalScope';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApiRead } from '../hooks/useApiLists';
import { useIdempotentCreate } from '../hooks/useIdempotentCreate';
import { emptyExpense, expenseCents, expenseDate, formatExpenseCents, readExpenses, type ExpenseDraft } from '../expenses';
import ExpenseFields from '../components/ExpenseFields';
import RequestError from '../components/RequestError';
import { localDate } from '../localDate';

export default function Expenses() {
  const { data, loading, error, reload } = useApiRead(['/api/gastos'], readExpenses);
  const { payload, locked, inFlight, confirmedId, recoveryError, submit, discard } = useIdempotentCreate<ExpenseDraft>('/api/gastos');
  const [local, setLocal] = useLocalScope();
  const [draft, setDraft] = useState(() => payload ?? { ...emptyExpense(), local: local === 'Todos' ? 'Principal' : local });
  const [success, setSuccess] = useState('');
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!confirmedId) return;
    setSuccess(`Gasto registrado correctamente (n.º ${confirmedId}).`);
    setMonth(payload?.fecha.slice(0, 7) ?? ''); setLocal(payload?.local ?? 'Todos'); setSearch('');
    setDraft({ ...emptyExpense(), local: payload?.local ?? 'Principal' }); discard(); void reload();
  }, [confirmedId, discard, reload]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight) return;
    setSuccess('');
    try { await submit(draft); }
    catch { /* The session retains the outcome, including after navigation. */ }
  };
  const visible = (data ?? []).filter(row => (!month || row.fecha.startsWith(`${month}-`)) && (local === 'Todos' || row.local === local) &&
    `${row.id} ${row.proveedor_nombre} ${row.concepto}`.toLocaleLowerCase('es-ES').includes(search.trim().toLocaleLowerCase('es-ES')))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  const cents = visible.reduce((total, row) => total + expenseCents(row.total), 0);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gastos</h2>
      <Link to="/escaner" className="text-brand-700 dark:text-brand-400 underline">Abrir escáner</Link>
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-300">Registra un gasto sin foto ni IA y consulta los existentes antes de repetir un alta. La lista permite comprobar registros; no acredita conciliación bancaria ni fiscal.</p>
    {success && <p role="status" className="rounded-lg bg-emerald-50 text-emerald-900 p-3">{success}</p>}
    <form onSubmit={save} aria-label="Alta de gasto" className="rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-4">
      <h3 className="font-semibold">{payload ? 'Recuperar gasto de esta sesión' : 'Alta manual de gasto'}</h3>
      <RequestError message={recoveryError} />
      {inFlight && <p role="status">Esperando la respuesta del guardado. No repitas el envío; puedes navegar y volver.</p>}
      {locked && !inFlight && <p role="status">Hay un guardado sin confirmar. Conservamos los datos enviados y la misma clave, también si proceden del escáner. Confirmar no crea otro gasto para este intento. Recargar o cerrar sesión pierde esta recuperación.</p>}
      <ExpenseFields value={draft} onChange={setDraft} disabled={locked || inFlight} />
      <button type="submit" disabled={inFlight} className="w-full rounded-lg bg-brand-600 text-white p-3 disabled:opacity-50">{inFlight ? 'Registrando...' : locked ? 'Confirmar guardado pendiente' : 'Registrar gasto'}</button>
      {payload && <button type="button" disabled={inFlight} className="text-sm underline" onClick={() => {
        if (locked && !window.confirm('El servidor puede haber registrado el gasto. Descartar elimina este intento y su protección frente a duplicados. Comprueba los gastos antes de crear otro. ¿Continuar?')) return;
        discard(); setDraft({ ...emptyExpense(), local: local === 'Todos' ? 'Principal' : local }); setSuccess('');
      }}>Descartar intento pendiente</button>}
      <p className="text-xs text-slate-500">Los borradores sin enviar no se conservan al salir. La recuperación de intentos enviados solo dura esta sesión.</p>
    </form>
    <section aria-labelledby="expenses-list-title" className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 id="expenses-list-title" className="text-xl font-semibold">Gastos registrados</h3>
        <button onClick={reload} disabled={loading} className="rounded-lg border px-3 py-2 disabled:opacity-50">Actualizar lista</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>Mes de consulta<input type="month" value={month} onChange={e => setMonth(e.target.value)} className="block w-full p-2 border rounded-lg bg-white dark:bg-slate-900" /></label>
        <label>Local de consulta<select value={local} onChange={e => setLocal(e.target.value)} className="block w-full p-2 border rounded-lg bg-white dark:bg-slate-900"><option>Todos</option>{[...new Set(['Principal', 'Segundo Local', ...(data ?? []).map(row => row.local)])].map(name => <option key={name} value={name}>{locationLabel(name)}</option>)}</select></label>
        <label>Buscar proveedor, concepto o número<input value={search} onChange={e => setSearch(e.target.value)} className="block w-full p-2 border rounded-lg bg-white dark:bg-slate-900" /></label>
      </div>
      <button className="underline text-sm" onClick={() => { setMonth(''); setLocal('Todos'); setSearch(''); }}>Ver todos los gastos</button>
      {loading ? <p role="status">Cargando gastos...</p> : error ? <RequestError message={error} onRetry={reload} /> : data && <>
        <p aria-label="Resumen de gastos">{visible.length} {visible.length === 1 ? 'registro' : 'registros'} · Total de la selección: {Number.isSafeInteger(cents) ? formatExpenseCents(cents) : 'Importe fuera de rango'}</p>
        {visible.length === 0 ? <p>{data.length === 0 ? 'Todavía no hay gastos registrados.' : 'No hay gastos que coincidan con los filtros.'}</p> :
          <ul className="grid gap-3 sm:grid-cols-2">{visible.map(row => <li key={row.id} className="rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-2 min-w-0 break-words">
            <h4 className="font-semibold">Gasto n.º {row.id} · {row.proveedor_nombre}</h4>
            <p>{expenseDate(row.fecha)} · {locationLabel(row.local)}</p>
            <p className="text-lg font-bold">{formatExpenseCents(expenseCents(row.total))}</p>
            <p className="whitespace-pre-wrap">{row.concepto || 'Sin concepto'}</p>
          </li>)}</ul>}
      </>}
    </section>
  </div>;
}
