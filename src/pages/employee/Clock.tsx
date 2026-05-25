import { useState, useEffect } from 'react';
import { Play, Square, Coffee, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

export default function Clock() {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [status, setStatus] = useState<'out' | 'working' | 'break'>('out');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFichaje = async (tipo: 'entrada' | 'salida') => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/fichar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: user.id, tipo })
      });
      
      if (res.ok) {
        if (tipo === 'entrada') setStatus('working');
        if (tipo === 'salida') setStatus('out');
      } else {
        console.error("Error en servidor");
      }
    } catch (error) {
      console.error("Error de conexión al fichar", error);
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

      <div className="w-full max-w-sm space-y-4">
        {status === 'out' ? (
          <button 
            onClick={() => handleFichaje('entrada')}
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-6 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-brand-500/30 transition-all active:scale-95 disabled:opacity-70"
          >
            {loading ? <Loader2 size={32} className="animate-spin" /> : <Play size={32} />}
            <span className="text-xl">{loading ? 'Conectando...' : 'Fichar Entrada'}</span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-4 text-center">
              <span className="inline-block w-3 h-3 bg-brand-500 rounded-full animate-pulse mr-2"></span>
              <span className="text-brand-700 dark:text-brand-400 font-medium">
                {status === 'working' ? 'Turno Activo' : 'En Descanso'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setStatus(status === 'working' ? 'break' : 'working')}
                className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 font-semibold py-4 rounded-2xl flex flex-col items-center gap-2 transition-colors"
              >
                <Coffee size={24} />
                {status === 'working' ? 'Descanso' : 'Volver'}
              </button>
              
              <button 
                onClick={() => handleFichaje('salida')}
                disabled={loading}
                className="bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-semibold py-4 rounded-2xl flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={24} className="animate-spin" /> : <Square size={24} />}
                Finalizar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
