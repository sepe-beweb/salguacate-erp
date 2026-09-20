import { locationLabel, matchesLocation } from '../locations';
import { useLocalScope } from '../hooks/useLocalScope';
import LocalFilter from '../components/LocalFilter';
import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Loader2, X, CheckCircle2, Circle, User, CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { readJson, errorMessage } from '../apiResponse';
import { useApiRead } from '../hooks/useApiLists';
import { emptyTask, formatCivilDate, readTaskWorkspace, type PlannedTask as Tarea } from '../planningData';
import { localDate } from '../localDate';
import { isCivilDate } from '../financialValues';
import RequestError from '../components/RequestError';
import ModalDialog from '../components/ModalDialog';

export default function Tasks() {
  const { fetchWithAuth } = useAuth();
  const { data, loading, error: loadError, reload: fetchData } = useApiRead(['/api/tareas', '/api/usuarios'], readTaskWorkspace);
  const [selectedLocal, setSelectedLocal] = useLocalScope();
  const [allTasks, employees] = data ?? [[], []];
  const tareas = allTasks.filter(task => matchesLocation(task.local, selectedLocal, true));
  const today = localDate();
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [form, setForm] = useState(emptyTask);
  const [hasDraft, setHasDraft] = useState(false);
  const assignee = employees.find(employee => String(employee.id) === form.asignado_a);
  const incompatibleLocal = !!assignee && assignee.rol === 'employee' && !!form.local && form.local !== 'Ambos' && assignee.local !== form.local;

  useEffect(() => {
    const handleAiAction = () => fetchData();
    window.addEventListener('ai_action_executed', handleAiAction);
    return () => window.removeEventListener('ai_action_executed', handleAiAction);
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || busy || loading || loadError) return;
    if (!form.titulo.trim() || !isCivilDate(form.fecha)) { setError('Revisa el título y la fecha de la tarea.'); return; }
    if (incompatibleLocal) { setError('El empleado no pertenece al local de la tarea. Elige su local o Ambos.'); return; }
    setIsSubmitting(true); setError('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/tareas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          asignado_a: form.asignado_a ? parseInt(form.asignado_a) : null
        })
      });
      await readJson(res);
      setShowModal(false);
      setForm(emptyTask());
      setHasDraft(false);
      fetchData();
    } catch (err) { setError(`${errorMessage(err)} Consulta la lista antes de repetir el alta si se perdió la conexión.`); }
    finally { setIsSubmitting(false); }
  };

  const handleToggle = async (tarea: Tarea) => {
    if (busy || isSubmitting || loading || loadError) return;
    setBusy(true); setError('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/tareas/${tarea.id}/completada`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completada: !tarea.completada })
      });
      await readJson(res);
      await fetchData();
    } catch (err) { setError(`${errorMessage(err)} Comprueba el estado antes de repetir el cambio.`); await fetchData(); }
    finally { setBusy(false); }
  };

  const handleDelete = async (tarea: Tarea) => {
    if (busy || isSubmitting || loading || loadError || !window.confirm(`¿Eliminar la tarea «${tarea.titulo}»? Esta acción no se puede deshacer.`)) return;
    setBusy(true); setError('');
    try {
      await readJson(await fetchWithAuth(`${API_URL}/api/tareas/${tarea.id}`, { method: 'DELETE' }));
      await fetchData();
    } catch (err) { setError(`${errorMessage(err)} Comprueba la lista antes de repetir la eliminación.`); await fetchData(); }
    finally { setBusy(false); }
  };

  const filtered = tareas.filter(t => {
    if (filter === 'pending') return !t.completada;
    if (filter === 'done') return t.completada;
    return true;
  });

  const pendingCount = tareas.filter(t => !t.completada).length;
  const doneCount = tareas.filter(t => t.completada).length;

  const getPrioStyle = (prio: string) => {
    switch(prio) {
      case 'alta': return { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Alta' };
      case 'baja': return { dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800/50', label: 'Baja' };
      default: return { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Normal' };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!showModal && <RequestError message={error} />}
      <RequestError message={loadError} onRetry={fetchData} />
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ClipboardList className="text-brand-500" />
          Tareas
        </h2>
        <button 
          disabled={loading || !!loadError || busy || isSubmitting}
          onClick={() => { setError(''); if (!hasDraft) setForm({ ...emptyTask(), local: selectedLocal === 'Todos' ? '' : selectedLocal }); setShowModal(true); }}
          className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-full transition-colors shadow-md flex items-center gap-1 px-4"
        >
          <Plus size={18} /> <span className="font-semibold text-sm">Nueva</span>
        </button>
      </div>

      {/* Counters + Filters */}
      <LocalFilter value={selectedLocal} onChange={setSelectedLocal} />
      {!loading && !loadError && <div className="flex gap-2">
        <button onClick={() => setFilter('pending')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${filter === 'pending' ? 'bg-brand-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>
          Pendientes <span className="ml-1 bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-xs">{pendingCount}</span>
        </button>
        <button onClick={() => setFilter('done')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${filter === 'done' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>
          Hechas <span className="ml-1 bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-xs">{doneCount}</span>
        </button>
        <button onClick={() => setFilter('all')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${filter === 'all' ? 'bg-slate-700 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>
          Todo
        </button>
      </div>}

      {/* Modal: Nueva Tarea */}
      {showModal && (
        <ModalDialog label="Nueva Tarea" busy={isSubmitting} onClose={() => setShowModal(false)}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nueva Tarea</h3>
              <button aria-label="Cerrar tarea" disabled={isSubmitting} onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} onChange={() => setHasDraft(true)} className="space-y-4">
              {error && <p role="alert" className="text-red-700">{error}</p>}
              <fieldset disabled={isSubmitting || loading || !!loadError} className="space-y-4">
              <div>
                <label htmlFor="task-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tarea</label>
                <input 
                  id="task-title" type="text" required data-autofocus
                  value={form.titulo}
                  onChange={e => setForm({...form, titulo: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  placeholder="Ej. Limpiar cámara frigorífica"
                />
              </div>
              <div>
                <label htmlFor="task-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Detalles (Opcional)</label>
                <textarea 
                  id="task-description" rows={2}
                  value={form.descripcion}
                  onChange={e => setForm({...form, descripcion: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white resize-none"
                  placeholder="Instrucciones adicionales..."
                ></textarea>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="task-assignee" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asignar a</label>
                  <select 
                    id="task-assignee" value={form.asignado_a}
                    onChange={e => setForm({...form, asignado_a: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="">Todos</option>
                    {employees.filter(e => e.rol === 'employee').map(emp => (
                      <option key={emp.id} value={emp.id} disabled={!!form.local && form.local !== 'Ambos' && emp.local !== form.local}>{emp.nombre} · {locationLabel(emp.local, 'Sin local')}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor="task-priority" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prioridad</label>
                  <select 
                    id="task-priority" value={form.prioridad}
                    onChange={e => setForm({...form, prioridad: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="baja">🟢 Baja</option>
                    <option value="normal">🟡 Normal</option>
                    <option value="alta">🔴 Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="task-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label>
                <input 
                  id="task-date" type="date" required
                  value={form.fecha}
                  onChange={e => setForm({...form, fecha: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="task-local" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local</label>
                <select 
                  id="task-local" value={form.local}
                  onChange={e => setForm({...form, local: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                >
                  <option value="">Ambos</option>
                  <option value="Principal">{locationLabel('Principal')}</option>
                  <option value="Segundo Local">{locationLabel('Segundo Local')}</option>
                </select>
              </div>
              <button 
                type="submit" disabled={isSubmitting || incompatibleLocal}
                className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Crear Tarea"}
              </button>
              {incompatibleLocal && <p role="alert" className="text-sm text-red-700 dark:text-red-400">El empleado no pertenece al local de la tarea. Elige su local o Ambos. La asignación se conserva para que puedas corregirla.</p>}
              </fieldset>
              {hasDraft && <button type="button" disabled={isSubmitting} onClick={() => {
                if (window.confirm('¿Descartar el borrador de esta tarea?')) { setForm(emptyTask()); setHasDraft(false); setError(''); }
              }} className="text-sm text-slate-500 underline">Descartar borrador</button>}
            </form>
          </div>
        </ModalDialog>
      )}

      {/* Lista de tareas */}
      {loading ? (
        <div role="status" aria-label="Cargando tareas" className="flex justify-center py-12 text-brand-500">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : loadError ? null : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
          <div className="bg-brand-100 dark:bg-brand-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={32} className="text-brand-500" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {filter === 'done' ? 'Sin tareas completadas' : 'Sin tareas pendientes'}
          </p>
          <p className="text-slate-500 mt-1">
            {filter === 'done' ? 'Las tareas completadas aparecerán aquí.' : '¡Todo limpio! Pulsa "+ Nueva" para crear tareas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tarea) => {
            const prio = getPrioStyle(tarea.prioridad);
            const isOverdue = !tarea.completada && tarea.fecha < today;
            
            return (
              <div 
                key={tarea.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border ${isOverdue ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-800'} shadow-sm p-3.5 flex gap-3 items-start transition-all ${tarea.completada ? 'opacity-50' : ''}`}
              >
                {/* Checkbox */}
                <button 
                  disabled={busy || isSubmitting} aria-label={`${tarea.completada ? 'Marcar pendiente' : 'Completar'}: ${tarea.titulo}`} onClick={() => handleToggle(tarea)}
                  className={`mt-0.5 flex-shrink-0 transition-colors ${tarea.completada ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600 hover:text-brand-500'}`}
                >
                  {tarea.completada ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-slate-900 dark:text-white ${tarea.completada ? 'line-through' : ''}`}>
                    {tarea.titulo}
                  </p>
                  {tarea.descripcion && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{tarea.descripcion}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs text-slate-500">{locationLabel(tarea.local, 'Ambos')}</span>
                    {/* Priority badge */}
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${prio.text} ${prio.bg} px-2 py-0.5 rounded-full`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`}></span>
                      {prio.label}
                    </span>
                    {/* Assigned to */}
                    {tarea.asignado_nombre && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        <User size={10} /> {tarea.asignado_nombre}
                      </span>
                    )}
                    {/* Date */}
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isOverdue ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 font-semibold' : 'text-slate-400 bg-slate-50 dark:bg-slate-800'}`}>
                      <CalendarDays size={10} />
                      {isOverdue ? '⚠ Atrasada — ' : ''}
                      {formatCivilDate(tarea.fecha)}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                {!tarea.rutina_ejecucion_id && <button
                  disabled={busy || isSubmitting} aria-label={`Eliminar tarea: ${tarea.titulo}`} onClick={() => handleDelete(tarea)}
                  className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
