import { useState, useEffect } from 'react';
import { Send, FileQuestion, Loader2, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

interface Peticion {
  id: number;
  tipo: string;
  fecha_inicio: string;
  fecha_fin?: string;
  comentarios?: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  creado_en: string;
}

export default function Requests() {
  const { fetchWithAuth } = useAuth();
  
  const [type, setType] = useState('vacaciones');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [comentarios, setComentarios] = useState('');
  
  const [peticiones, setPeticiones] = useState<Peticion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadPeticiones = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/peticiones`);
      if (res.ok) {
        const data = await res.json();
        setPeticiones(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeticiones();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaInicio) {
      setErrorMsg('Debes especificar al menos la fecha de inicio.');
      return;
    }
    
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const res = await fetchWithAuth(`${API_URL}/api/peticiones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: type,
          fecha_inicio: fechaInicio,
          fecha_fin: type === 'vacaciones' ? fechaFin : null,
          comentarios
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Petición enviada correctamente. El encargado la revisará.');
        setFechaInicio('');
        setFechaFin('');
        setComentarios('');
        loadPeticiones();
      } else {
        setErrorMsg(data.error || 'Error al enviar la petición.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de red. No se pudo conectar al servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch(type) {
      case 'vacaciones': return 'Vacaciones 🏖️';
      case 'cambio': return 'Cambio de Turno 🔁';
      case 'baja': return 'Baja Médica 🤒';
      default: return 'Asuntos Propios 💼';
    }
  };

  const getStatusBadge = (estado: string) => {
    switch(estado) {
      case 'aprobado': 
        return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full font-semibold border border-emerald-200 dark:border-emerald-900/30">Aprobado</span>;
      case 'rechazado': 
        return <span className="bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 text-xs px-2.5 py-1 rounded-full font-semibold border border-red-200 dark:border-red-900/30">Rechazado</span>;
      default: 
        return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-xs px-2.5 py-1 rounded-full font-semibold border border-amber-200 dark:border-amber-900/30">Pendiente</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nueva Petición</h2>
      
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-xl text-emerald-700 dark:text-emerald-450 text-sm">
          {successMsg}
        </div>
      )}
      
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4 rounded-xl text-red-700 dark:text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      <form className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors animate-in zoom-in-95 duration-200" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de Petición</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FileQuestion size={18} className="text-slate-400" />
            </div>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-brand-500 transition-colors appearance-none"
            >
              <option value="vacaciones">Vacaciones</option>
              <option value="cambio">Cambio de Turno</option>
              <option value="baja">Baja Médica</option>
              <option value="asuntos">Asuntos Propios</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {type === 'vacaciones' ? 'Desde' : 'Fecha'}
            </label>
            <input 
              type="date" required
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-500 transition-colors" 
            />
          </div>
          
          {type === 'vacaciones' ? (
            <div className="space-y-1 animate-in fade-in zoom-in-95 duration-200">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Hasta</label>
              <input 
                type="date" required
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-500 transition-colors" 
              />
            </div>
          ) : (
            <div className="space-y-1 text-slate-400 text-xs flex flex-col justify-center">
              <p className="mt-4 italic">Las bajas o asuntos propios no requieren especificar fecha de finalización por adelantado.</p>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Comentarios (Opcional)</label>
          <textarea 
            rows={3} 
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Especifica los detalles (ej: 'Cambio con María el viernes de noche' o 'Vacaciones solicitadas para el viaje familiar')"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-3 focus:outline-none focus:border-brand-500 transition-colors resize-none"
          />
        </div>

        <button 
          disabled={submitting}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-colors mt-2 disabled:opacity-50"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          Enviar Petición
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">Mis Peticiones Anteriores</h3>
        {loading ? (
          <div className="flex justify-center py-4 text-brand-500">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : peticiones.length === 0 ? (
          <p className="text-xs text-slate-450 dark:text-slate-500 text-center py-2">No has realizado ninguna petición anterior.</p>
        ) : (
          <div className="space-y-2">
            {peticiones.map(p => (
              <div key={p.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors animate-in fade-in duration-200">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{getRequestTypeLabel(p.tipo)}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Calendar size={12} />
                    {new Date(p.fecha_inicio).toLocaleDateString('es-ES')}
                    {p.fecha_fin && ` al ${new Date(p.fecha_fin).toLocaleDateString('es-ES')}`}
                  </p>
                  {p.comentarios && (
                    <p className="text-xs text-slate-400 mt-1 italic">"{p.comentarios}"</p>
                  )}
                </div>
                <div className="flex items-center self-end sm:self-center">
                  {getStatusBadge(p.estado)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
