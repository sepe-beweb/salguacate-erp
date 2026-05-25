import { useState, useEffect } from 'react';
import { Truck, Plus, Phone, Mail, Loader2, X } from 'lucide-react';

interface Provider {
  id: number;
  nombre: string;
  telefono: string;
  email: string;
  categoria: string;
}

export default function Providers() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProvider, setNewProvider] = useState({ nombre: '', telefono: '', email: '', categoria: 'General' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProviders = () => {
    fetch('http://localhost:3001/api/proveedores')
      .then(res => res.json())
      .then(data => {
        setProviders(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error cargando proveedores", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvider.nombre) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch('http://localhost:3001/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProvider)
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewProvider({ nombre: '', telefono: '', email: '', categoria: 'General' });
        fetchProviders();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <Loader2 size={32} className="animate-spin text-brand-500 mb-4" />
        <p>Cargando agenda...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Truck className="text-brand-500" />
          Proveedores
        </h2>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-brand-600 hover:bg-brand-700 dark:hover:bg-brand-500 text-white p-2 rounded-full transition-colors shadow-md dark:shadow-brand-500/20"
        >
          <Plus size={20} />
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nuevo Proveedor</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProvider} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre / Empresa</label>
                <input 
                  type="text" 
                  required
                  value={newProvider.nombre}
                  onChange={e => setNewProvider({...newProvider, nombre: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  placeholder="Ej. Distribuciones Norte"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input 
                    type="tel" 
                    value={newProvider.telefono}
                    onChange={e => setNewProvider({...newProvider, telefono: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                  <select 
                    value={newProvider.categoria}
                    onChange={e => setNewProvider({...newProvider, categoria: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  >
                    <option value="General">General</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Alimentación">Alimentación</option>
                    <option value="Suministros">Suministros</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email (Opcional)</label>
                <input 
                  type="email" 
                  value={newProvider.email}
                  onChange={e => setNewProvider({...newProvider, email: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Guardar Proveedor"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lista de Proveedores */}
      <div className="grid gap-4 sm:grid-cols-2">
        {providers.length === 0 ? (
          <p className="text-slate-500 text-center py-8 col-span-full">No hay proveedores registrados.</p>
        ) : (
          providers.map(provider => (
            <div key={provider.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors duration-200">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-slate-900 dark:text-white font-bold">{provider.nombre}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 mt-1 inline-block">
                    {provider.categoria}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2 mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                {provider.telefono && (
                  <a href={`tel:${provider.telefono}`} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-brand-500 transition-colors">
                    <Phone size={16} />
                    {provider.telefono}
                  </a>
                )}
                {provider.email && (
                  <a href={`mailto:${provider.email}`} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-brand-500 transition-colors">
                    <Mail size={16} />
                    {provider.email}
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
