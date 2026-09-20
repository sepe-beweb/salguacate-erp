import { locationLabel } from '../../locations';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CalendarDays, Bell, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

import { useApiRead } from '../../hooks/useApiLists';
import { readJson, errorMessage } from '../../apiResponse';
import { localDate } from '../../localDate';
import RequestError from '../../components/RequestError';
import HandoverSummary from '../../components/HandoverSummary';

import { type PlannedTask as Tarea } from '../../planningData';
import { readEmployeePlanning } from '../../shiftData';

export default function EmployeeDashboard() {
  const { user, fetchWithAuth } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error: loadError, reload: fetchDashboardData } = useApiRead(['/api/tareas', '/api/turnos'], readEmployeePlanning);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = localDate();
  const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const tareas = (data?.[0] ?? []).filter(t => t.fecha === today && (t.asignado_a === null || String(t.asignado_a) === user?.id) && (!t.local || t.local === 'Ambos' || t.local === user?.location));
  const turnosHoy = (data?.[1] ?? []).filter(t => t.fecha === today);

  const handleToggleTarea = async (tarea: Tarea) => {
    if (busy || loading || loadError) return;
    setBusy(true); setError('');
    const nextCompleted = !tarea.completada;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/tareas/${tarea.id}/completada`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completada: nextCompleted })
      });
      await readJson(res);
      await fetchDashboardData();
    } catch (err) {
      setError(`${errorMessage(err)} Comprueba el estado antes de repetir el cambio.`);
      await fetchDashboardData();
    } finally { setBusy(false); }
  };

  if (loading) return <p role="status" className="p-8 text-center">Cargando turnos y tareas...</p>;
  if (loadError) return <RequestError message={loadError} onRetry={fetchDashboardData} />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <RequestError message={error} />
      <HandoverSummary />
      <button className="rounded-xl border border-brand-300 px-4 py-3 text-sm font-medium" onClick={() => navigate('/turno')}>Relevo y rutinas del local</button>
      {/* Saludo */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Hola, {user?.name.split(' ')[0]} 👋</h2>
          <p className="text-slate-500 dark:text-slate-400 capitalize">{dateStr}</p>
        </div>
        <div className="bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-3 py-1 rounded-full text-xs font-semibold">
          {locationLabel(user?.location)}
        </div>
      </div>

      {/* Tarjeta de Próximo Turno (Dinámica) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Clock size={100} className="text-slate-900 dark:text-white" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{turnosHoy.length > 1 ? 'Tus Turnos de Hoy' : 'Tu Turno de Hoy'}</h3>
        
        {turnosHoy.length > 0 ? (
          <>
            {turnosHoy.map(turnoHoy => <div key={turnoHoy.id} className="py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-3xl font-black text-brand-600 dark:text-brand-400 mb-2">
              {turnoHoy.hora_inicio} - {turnoHoy.hora_fin}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CalendarDays size={16} className="text-brand-500" />
              Hoy en <strong>{locationLabel(turnoHoy.local, 'Local no indicado')}</strong>
            </p>
            {turnoHoy.compañeros && (
              <p className="text-xs text-slate-400 mt-1">Con: {turnoHoy.compañeros}</p>
            )}
            </div>)}
            
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
              Sin turno registrado hoy
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

        {tareas.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-500">
            <CheckCircle2 className="text-emerald-500 mx-auto mb-2" size={32} />
            <p className="font-medium text-slate-800 dark:text-slate-300">Sin tareas para hoy</p>
            <p className="text-xs mt-0.5">No tienes tareas asignadas pendientes en {locationLabel(user?.location)}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tareas.map(tarea => (
              <button
                key={tarea.id}
                disabled={busy} aria-pressed={Boolean(tarea.completada)} onClick={() => handleToggleTarea(tarea)}
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
