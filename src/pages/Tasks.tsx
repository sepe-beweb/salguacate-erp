import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Loader2, X, CheckCircle2, Circle, User, CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

interface Tarea {
  id: number;
  titulo: string;
  descripcion: string | null;
  asignado_a: number | null;
  asignado_nombre: string | null;
  fecha: string;
  prioridad: string;
  completada: boolean;
}

interface Employee {
  id: number;
  nombre: string;
  rol: string;
}

const today = new Date().toISOString().split('T')[0];

export default function Tasks() {
  const { fetchWithAuth } = useAuth();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [form, setForm] = useState({ titulo: '', descripcion: '', asignado_a: '', fecha: today, prioridad: 'normal', local: '' });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetchWithAuth(`${API_URL}/api/tareas`).then(r => r.json()),
      fetchWithAuth(`${API_URL}/api/usuarios`).then(r => r.json()),
    ])
    .then(([t, e]) => { setTareas(t); setEmployees(e); setLoading(false); })
    .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const handleAiAction = () => fetchData();
    window.addEventListener('ai_action_executed', handleAiAction);
    return () => window.removeEventListener('ai_action_executed', handleAiAction);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo) return;
    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/tareas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          asignado_a: form.asignado_a ? parseInt(form.asignado_a) : null
        })
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ titulo: '', descripcion: '', asignado_a: '', fecha: today, prioridad: 'normal', local: '' });
        fetchData();
      }
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleToggle = async (id: number) => {
    try {
      await fetchWithAuth(`${API_URL}/api/tareas/${id}/toggle`, { method: 'PATCH' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetchWithAuth(`${API_URL}/api/tareas/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { console.error(err); }
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ClipboardList className="text-brand-500" />
          Tareas
        </h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-full transition-colors shadow-md flex items-center gap-1 px-4"
        >
          <Plus size={18} /> <span className="font-semibold text-sm">Nueva</span>
        </button>
      </div>

      {/* Counters + Filters */}
      <div className="flex gap-2">
        <button onClick={() => setFilter('pending')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${filter === 'pending' ? 'bg-brand-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>
          Pendientes <span className="ml-1 bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-xs">{pendingCount}</span>
        </button>
        <button onClick={() => setFilter('done')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${filter === 'done' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>
          Hechas <span className="ml-1 bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-xs">{doneCount}</span>
        </button>
        <button onClick={() => setFilter('all')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${filter === 'all' ? 'bg-slate-700 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>
          Todo
        </button>
      </div>

      {/* Modal: Nueva Tarea */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nueva Tarea</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tarea</label>
                <input 
                  type="text" required autoFocus
                  value={form.titulo}
                  onChange={e => setForm({...form, titulo: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  placeholder="Ej. Limpiar cámara frigorífica"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Detalles (Opcional)</label>
                <textarea 
                  rows={2}
                  value={form.descripcion}
                  onChange={e => setForm({...form, descripcion: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white resize-none"
                  placeholder="Instrucciones adicionales..."
                ></textarea>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asignar a</label>
                  <select 
                    value={form.asignado_a}
                    onChange={e => setForm({...form, asignado_a: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="">Todos</option>
                    {employees.filter(e => e.rol === 'employee').map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prioridad</label>
                  <select 
                    value={form.prioridad}
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label>
                <input 
                  type="date" required
                  value={form.fecha}
                  onChange={e => setForm({...form, fecha: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local</label>
                <select 
                  value={form.local}
                  onChange={e => setForm({...form, local: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                >
                  <option value="">Ambos</option>
                  <option value="Principal">Principal</option>
                  <option value="Segundo Local">Segundo Local</option>
                </select>
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Crear Tarea"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lista de tareas */}
      {loading ? (
        <div className="flex justify-center py-12 text-brand-500">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : filtered.length === 0 ? (
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
            const isOverdue = !tarea.completada && new Date(tarea.fecha) < new Date(today);
            
            return (
              <div 
                key={tarea.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border ${isOverdue ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-800'} shadow-sm p-3.5 flex gap-3 items-start transition-all ${tarea.completada ? 'opacity-50' : ''}`}
              >
                {/* Checkbox */}
                <button 
                  onClick={() => handleToggle(tarea.id)}
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
                      {new Date(tarea.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                <button 
                  onClick={() => handleDelete(tarea.id)}
                  className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
