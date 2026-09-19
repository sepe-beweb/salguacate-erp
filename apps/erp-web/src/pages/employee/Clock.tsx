import { useState, useEffect } from 'react';
import { Play, Square, Coffee, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

import { readJson, errorMessage } from '../../apiResponse';
import { useApiRead } from '../../hooks/useApiLists';
import RequestError from '../../components/RequestError';

type ClockStatus = 'out' | 'working' | 'break';
async function readClock([response]: Response[]): Promise<ClockStatus> {
  const data = await readJson<unknown>(response);
  if (data === null) return 'out';
  if (data && typeof data === 'object' && 'estado' in data) {
    if (data.estado === 'trabajando') return 'working';
    if (data.estado === 'descanso') return 'break';
  }
  throw new Error('El servidor devolvió un estado de fichaje desconocido.');
}

export default function Clock() {
  const { user, fetchWithAuth } = useAuth();
  const [time, setTime] = useState(new Date());
  const { data: status, loading, error: loadError, reload } = useApiRead(['/api/fichajes/activo'], readClock);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFichaje = async (tipo: 'entrada' | 'salida' | 'descanso' | 'volver') => {
    if (!user || busy || loading || !status || loadError) return;
    setBusy(true); setErrorMsg('');
    try {
      await readJson(await fetchWithAuth(`${API_URL}/api/fichar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo })
      }));
    } catch (cause) {
      setErrorMsg(`${errorMessage(cause)} Se consulta el estado antes de permitir otro fichaje; no se repite la operación.`);
    } finally {
      await reload();
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-2 mb-8">
        <p className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-widest text-sm">
          {time.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h2 className="text-6xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
          {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </h2>
      </div>

      <RequestError message={errorMsg} />
      <RequestError message={loadError} onRetry={reload} />

      <div className="w-full max-w-sm space-y-4">
        {loading || busy ? (
          <div className="flex justify-center p-8 text-brand-500">
            <Loader2 className="animate-spin" size={36} />
          </div>
        ) : loadError || !status ? null : status === 'out' ? (
          <button 
            onClick={() => handleFichaje('entrada')}
            disabled={loading || busy}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-6 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-brand-500/30 transition-all active:scale-95 disabled:opacity-70"
          >
            <Play size={32} />
            <span className="text-xl">Fichar Entrada</span>
          </button>
        ) : (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-4 text-center">
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${status === 'working' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <span className="text-brand-700 dark:text-brand-400 font-medium">
                {status === 'working' ? 'Turno Activo' : 'En Descanso'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleFichaje(status === 'working' ? 'descanso' : 'volver')}
                disabled={loading || busy}
                className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 font-semibold py-4 rounded-2xl flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Coffee size={24} />
                {status === 'working' ? 'Descanso' : 'Volver'}
              </button>
              
              <button 
                onClick={() => handleFichaje('salida')}
                disabled={loading || busy}
                className="bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-semibold py-4 rounded-2xl flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Square size={24} />
                Finalizar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
