import { useState, useEffect } from 'react';
import { Calendar, Euro, CreditCard, Gift, AlertCircle, Save, TrendingUp, Loader2, MapPin } from 'lucide-react';

interface Cierre {
  id: number;
  fecha: string;
  local: string;
  efectivo: number;
  tarjeta: number;
  invitaciones: number;
  descuadre: number;
  total: number;
}

export default function Sales() {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterLocal, setFilterLocal] = useState('Todos');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newCierre, setNewCierre] = useState({
    fecha: new Date().toISOString().split('T')[0],
    local: 'Principal',
    efectivo: '',
    tarjeta: '',
    invitaciones: '',
    descuadre: ''
  });

  const fetchCierres = () => {
    setLoading(true);
    fetch('http://localhost:3001/api/cierres')
      .then(res => res.json())
      .then(data => {
        setCierres(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching cierres", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchCierres();
    }
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:3001/api/cierres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCierre)
      });
      if (res.ok) {
        setNewCierre({
          fecha: new Date().toISOString().split('T')[0],
          local: 'Principal',
          efectivo: '',
          tarjeta: '',
          invitaciones: '',
          descuadre: ''
        });
        alert('Cierre registrado correctamente');
        setActiveTab('history');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ventas y Cierre</h2>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-lg">
        <button 
          onClick={() => setActiveTab('form')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'form' ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
        >
          Nuevo Cierre (Z)
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'history' ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
        >
          Historial
        </button>
      </div>

      {activeTab === 'form' ? (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors duration-200">
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha del Cierre</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={18} className="text-slate-400" />
                </div>
                <input 
                  type="date" 
                  required
                  value={newCierre.fecha}
                  onChange={e => setNewCierre({...newCierre, fecha: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-brand-500 transition-colors" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Local</label>
              <select 
                value={newCierre.local}
                onChange={e => setNewCierre({...newCierre, local: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-500 transition-colors"
              >
                <option value="Principal">Local Principal</option>
                <option value="Segundo Local">Segundo Local</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Efectivo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Euro size={18} className="text-slate-400" />
                  </div>
                  <input 
                    type="number" 
                    step="0.01" 
                    required
                    value={newCierre.efectivo}
                    onChange={e => setNewCierre({...newCierre, efectivo: e.target.value})}
                    placeholder="0.00" 
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-brand-500 transition-colors" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Tarjeta</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CreditCard size={18} className="text-slate-400" />
                  </div>
                  <input 
                    type="number" 
                    step="0.01" 
                    required
                    value={newCierre.tarjeta}
                    onChange={e => setNewCierre({...newCierre, tarjeta: e.target.value})}
                    placeholder="0.00" 
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-brand-500 transition-colors" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Invitaciones (Valor)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Gift size={18} className="text-slate-400" />
                </div>
                <input 
                  type="number" 
                  step="0.01" 
                  value={newCierre.invitaciones}
                  onChange={e => setNewCierre({...newCierre, invitaciones: e.target.value})}
                  placeholder="0.00" 
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-brand-500 transition-colors" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descuadre de Caja</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AlertCircle size={18} className="text-slate-400" />
                </div>
                <input 
                  type="number" 
                  step="0.01" 
                  value={newCierre.descuadre}
                  onChange={e => setNewCierre({...newCierre, descuadre: e.target.value})}
                  placeholder="0.00" 
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-brand-500 transition-colors" 
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Introduce valor negativo si falta dinero (ej. -5.00).</p>
            </div>
            
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Guardar Cierre</>}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Filtro por local */}
          <div className="flex gap-2">
            {['Todos', 'Principal', 'Segundo Local'].map(l => (
              <button key={l} onClick={() => setFilterLocal(l)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${filterLocal === l ? 'bg-brand-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
              >
                <MapPin size={12} />{l}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex justify-center p-8 text-brand-500">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : cierres.length === 0 ? (
            <div className="text-center py-10 text-slate-500">No hay cierres registrados aún.</div>
          ) : (
            cierres.filter(c => filterLocal === 'Todos' || c.local === filterLocal).map(item => (
              <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors duration-200">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-100 dark:bg-brand-900/30 p-2 rounded-lg text-brand-600 dark:text-brand-400">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{new Date(item.fecha).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-500">{item.local}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 dark:text-white">€{item.total.toFixed(2)}</p>
                  {item.descuadre !== 0 && (
                    <p className={`text-[10px] font-medium ${item.descuadre < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      Descuadre: {item.descuadre > 0 ? '+' : ''}{item.descuadre.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
