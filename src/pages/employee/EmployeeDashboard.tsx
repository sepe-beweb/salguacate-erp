import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CalendarDays, Bell, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

interface Tarea {
  id: number;
  titulo: string;
  descripcion: string | null;
  asignado_a: number | null;
  asignado_nombre: string | null;
  fecha: string;
  prioridad: string;
  completada: boolean;
  local: string | null;
}

interface Turno {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  local: string;
  compañeros: string;
}

export default function EmployeeDashboard() {
  const { user, fetchWithAuth } = useAuth();
  const navigate = useNavigate();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [turnoHoy, setTurnoHoy] = useState<Turno | null>(null);
  const [loading, setLoading] = useState(true);

  const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const today = new Date().toISOString().split('T')[0];

  const fetchDashboardData = () => {
    if (!user) return;
    setLoading(true);
    
    Promise.all([
      fetchWithAuth(`${API_URL}/api/tareas`).then(r => r.json()),
      fetchWithAuth(`${API_URL}/api/turnos?usuario_id=${user.id}`).then(r => r.json())
    ])
    .then(([tareasData, turnosData]) => {
      const tareasList = Array.isArray(tareasData) ? tareasData : [];
      const turnosList = Array.isArray(turnosData) ? turnosData : [];
      // Filtrar tareas de hoy, del local del empleado (o grupal/ambos) y asignadas a él (o grupales)
      const filtradas = tareasList.filter((t: Tarea) => {
        const matchesDate = t.fecha === today;
        const matchesEmployee = t.asignado_a === null || String(t.asignado_a) === String(user.id);
        const matchesLocal = !t.local || t.local === '' || t.local === 'Ambos' || t.local === user.location;
        return matchesDate && matchesEmployee && matchesLocal;
      });
      setTareas(filtradas);

      // Buscar turno programado para hoy
      const turnoDeHoy = turnosList.find((t: Turno) => t.fecha === today);
      setTurnoHoy(turnoDeHoy || null);

      setLoading(false);
    })
    .catch(err => {
      console.error("Error al cargar datos del dashboard del empleado", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleToggleTarea = async (tarea: Tarea) => {
    const nextCompleted = !tarea.completada;
    // Actualización optimista de UI
    setTareas(prev => prev.map(t => t.id === tarea.id ? { ...t, completada: nextCompleted } : t));
    
    try {
      const res = await fetchWithAuth(`${API_URL}/api/tareas/${tarea.id}/completada`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completada: nextCompleted })
      });
      if (!res.ok) throw new Error('No se pudo actualizar la tarea');
    } catch (err) {
      console.error("Error al marcar la tarea", err);
      fetchDashboardData(); // Revertir en caso de error
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Saludo */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Hola, {user?.name.split(' ')[0]} 👋</h2>
          <p className="text-slate-500 dark:text-slate-400 capitalize">{dateStr}</p>
        </div>
        <div className="bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-3 py-1 rounded-full text-xs font-semibold">
          {user?.location}
        </div>
      </div>

      {/* Tarjeta de Próximo Turno (Dinámica) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Clock size={100} className="text-slate-900 dark:text-white" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Tu Turno de Hoy</h3>
        
        {turnoHoy ? (
          <>
            <p className="text-3xl font-black text-brand-600 dark:text-brand-400 mb-2">
              {turnoHoy.hora_inicio} - {turnoHoy.hora_fin}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CalendarDays size={16} className="text-brand-500" />
              Hoy en <strong>{turnoHoy.local}</strong>
            </p>
            {turnoHoy.compañeros && (
              <p className="text-xs text-slate-400 mt-1">Con: {turnoHoy.compañeros}</p>
            )}
            
            <button 
              onClick={() => navigate('/fichaje')}
              className="mt-5 w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-xl shadow-lg shadow-brand-500/20 transition-colors flex justify-center items-center gap-2"
            >
              <Clock size={20} />
              Control de Horario / Fichar
            </button>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
              ¡Hoy libras! 🎉
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No tienes ningún turno programado para hoy en el cuadrante.
            </p>
            
            <button 
              onClick={() => navigate('/calendario')}
              className="mt-5 w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2 border border-slate-200 dark:border-slate-700"
            >
              <CalendarDays size={20} />
              Ver Calendario Completo
            </button>
          </>
        )}
      </div>

      {/* Lista de Tareas Pendientes (Dinámica de SQLite) */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell size={18} className="text-amber-500" /> 
          Checklist de Hoy
        </h3>

        {loading ? (
          <div className="flex justify-center py-6 text-brand-500">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : tareas.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-500">
            <CheckCircle2 className="text-emerald-500 mx-auto mb-2" size={32} />
            <p className="font-medium text-slate-800 dark:text-slate-300">¡Todo limpio por hoy!</p>
            <p className="text-xs mt-0.5">No tienes tareas asignadas pendientes en {user?.location}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tareas.map(tarea => (
              <button
                key={tarea.id}
                onClick={() => handleToggleTarea(tarea)}
                className={`w-full bg-white dark:bg-slate-900 p-4 rounded-xl border transition-all flex items-start gap-3 text-left shadow-sm ${
                  tarea.completada 
                    ? 'border-emerald-200 dark:border-emerald-900/30 opacity-60' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 transition-colors ${tarea.completada ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>
                  {tarea.completada ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm text-slate-900 dark:text-white ${tarea.completada ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                    {tarea.titulo}
                  </p>
                  {tarea.descripcion && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{tarea.descripcion}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tarea.prioridad === 'alta' 
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                        : tarea.prioridad === 'baja'
                          ? 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                    }`}>
                      {tarea.prioridad === 'alta' ? 'Alta' : tarea.prioridad === 'baja' ? 'Baja' : 'Normal'}
                    </span>
                    {tarea.asignado_a === null && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full">
                        Grupal
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
