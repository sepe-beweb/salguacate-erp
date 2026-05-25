import { Send, FileQuestion } from 'lucide-react';
import { useState } from 'react';

export default function Requests() {
  const [type, setType] = useState('vacaciones');
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nueva Petición</h2>
      
      <form className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors" onSubmit={(e) => e.preventDefault()}>
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

        {type === 'vacaciones' && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Desde</label>
              <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Hasta</label>
              <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500 transition-colors" />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Comentarios (Opcional)</label>
          <textarea 
            rows={3} 
            placeholder="Detalla tu petición..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-3 focus:outline-none focus:border-brand-500 transition-colors resize-none"
          />
        </div>

        <button className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-colors mt-2">
          <Send size={18} />
          Enviar Petición
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">Mis Peticiones Anteriores</h3>
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Cambio de turno</p>
            <p className="text-xs text-slate-500">Para el día 15 de Mayo</p>
          </div>
          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-1 rounded font-medium">Pendiente</span>
        </div>
      </div>
    </div>
  );
}
