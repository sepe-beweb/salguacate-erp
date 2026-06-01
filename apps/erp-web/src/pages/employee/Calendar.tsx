import { useState, useEffect } from 'react';
import { Users, Loader2, CalendarX2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

interface Turno {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  local: string;
  compañeros: string;
}

export default function Calendar() {
  const { user, fetchWithAuth } = useAuth();
  const [shifts, setShifts] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWithAuth(`${API_URL}/api/turnos?usuario_id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setShifts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error cargando turnos", err);
          setLoading(false);
        });
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <Loader2 size={32} className="animate-spin text-brand-500 mb-4" />
        <p>Cargando calendario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Mis Turnos</h2>
      
      {shifts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center text-center">
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
            <CalendarX2 size={32} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Sin turnos asignados</h3>
          <p className="text-slate-500 text-sm max-w-xs">No tienes turnos programados próximamente. Disfruta de tu tiempo libre.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shifts.map((shift) => {
            const dateObj = new Date(shift.fecha);
            const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' });
            const dayNum = dateObj.toLocaleDateString('es-ES', { day: '2-digit' });
            
            return (
              <div key={shift.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-4 transition-colors">
                <div className="flex flex-col items-center justify-center w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-lg shrink-0">
                  <span className="text-xs text-slate-500 capitalize">{dayName}</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{dayNum}</span>
                </div>
                
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {shift.hora_inicio} - {shift.hora_fin}
                  </p>
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-medium mb-1">
                    {shift.local}
                  </p>
                  
                  {shift.compañeros && (
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1">
                      <Users size={14} className="shrink-0 mt-0.5" />
                      <span>Compañeros: {shift.compañeros}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
