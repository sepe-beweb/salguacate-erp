import { useState, useEffect } from 'react';
import { Play, Square, Coffee, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

export default function Clock() {
  const { user, fetchWithAuth } = useAuth();
  const [time, setTime] = useState(new Date());
  const [status, setStatus] = useState<'out' | 'working' | 'break'>('out');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar estado inicial del fichaje activo desde el servidor
  useEffect(() => {
    if (!user) return;
    setErrorMsg('');
    setLoading(true);
    fetchWithAuth(`${API_URL}/api/fichajes/activo`)
      .then(async res => {
        if (!res.ok) throw new Error('Error al cargar estado del fichaje');
        const data = await res.json();
        if (data) {
          if (data.estado === 'descanso') {
            setStatus('break');
          } else {
            setStatus('working');
          }
        } else {
          setStatus('out');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setErrorMsg('No se pudo verificar el estado de tu turno actual en el servidor.');
        setLoading(false);
      });
  }, [user]);

  const handleFichaje = async (tipo: 'entrada' | 'salida' | 'descanso' | 'volver') => {
    if (!user) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetchWithAuth(`${API_URL}/api/fichar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: user.id, tipo })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (tipo === 'entrada' || tipo === 'volver') setStatus('working');
        if (tipo === 'descanso') setStatus('break');
        if (tipo === 'salida') setStatus('out');
      } else {
        setErrorMsg(data.error || 'Error al procesar el marcaje.');
      }
    } catch (error) {
      console.error("Error de conexión al fichar", error);
      setErrorMsg('Error de red. No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
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

      {errorMsg && (
        <div className="w-full max-w-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-4 rounded-xl text-red-700 dark:text-red-400 text-xs text-center">
          {errorMsg}
        </div>
      )}

      <div className="w-full max-w-sm space-y-4">
        {loading ? (
          <div className="flex justify-center p-8 text-brand-500">
            <Loader2 className="animate-spin" size={36} />
          </div>
        ) : status === 'out' ? (
          <button 
            onClick={() => handleFichaje('entrada')}
            disabled={loading}
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
                disabled={loading}
                className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 font-semibold py-4 rounded-2xl flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Coffee size={24} />
                {status === 'working' ? 'Descanso' : 'Volver'}
              </button>
              
              <button 
                onClick={() => handleFichaje('salida')}
                disabled={loading}
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
