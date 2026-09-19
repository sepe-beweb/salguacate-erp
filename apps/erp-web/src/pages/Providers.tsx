import { useState, useRef } from 'react';
import { Truck, Plus, Phone, Mail, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

import { readJson, errorMessage } from '../apiResponse';
import { useApiRead } from '../hooks/useApiLists';
import { readProviders } from '../catalogData';
import RequestError from '../components/RequestError';
import ModalDialog from '../components/ModalDialog';
import { emptyProvider, readProviderForm } from '../catalogForms';

export default function Providers() {
  const { fetchWithAuth } = useAuth();
  const { data, loading, error: loadError, reload: fetchProviders } = useApiRead(['/api/proveedores'], responses => readProviders(responses[0]));
  const providers = data ?? [];
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProvider, setNewProvider] = useState(emptyProvider);
  const inFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || loading || loadError) return;
    let payload;
    try { payload = readProviderForm(newProvider); } catch (cause) { setError(errorMessage(cause)); return; }
    inFlight.current = true;
    setError('');
    setIsSubmitting(true);
    
    try {
      const res = await fetchWithAuth(`${API_URL}/api/proveedores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await readJson(res);
      setShowAddModal(false);
      setNewProvider(emptyProvider());
      await fetchProviders();
    } catch (err) {
      setError(`${errorMessage(err)} Revisa la lista antes de repetir el alta si se perdió la conexión.`);
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  if (loading && !showAddModal) {
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
          aria-label="Nuevo proveedor" disabled={!!loadError || isSubmitting} onClick={() => { setError(''); setShowAddModal(true); }}
          className="bg-brand-600 hover:bg-brand-700 dark:hover:bg-brand-500 text-white p-2 rounded-full transition-colors shadow-md dark:shadow-brand-500/20"
        >
          <Plus size={20} />
        </button>
      </div>

      {showAddModal && (
        <ModalDialog label="Nuevo Proveedor" busy={isSubmitting} onClose={() => { if (!inFlight.current) setShowAddModal(false); }}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nuevo Proveedor</h3>
              <button aria-label="Cancelar proveedor" disabled={isSubmitting} onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProvider} className="space-y-4">
              <RequestError message={error} />
              <RequestError message={loadError} onRetry={fetchProviders} />
              {loading && <p role="status">Actualizando proveedores...</p>}
              <fieldset disabled={isSubmitting || loading || !!loadError} className="space-y-4">
              <div>
                <label htmlFor="provider-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre / Empresa</label>
                <input 
                  type="text" 
                  required maxLength={160} data-autofocus
                  id="provider-nombre" value={newProvider.nombre}
                  onChange={e => setNewProvider({...newProvider, nombre: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  placeholder="Ej. Distribuciones Norte"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="provider-telefono" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input 
                    type="tel" maxLength={40}
                    id="provider-telefono" value={newProvider.telefono}
                    onChange={e => setNewProvider({...newProvider, telefono: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="provider-categoria" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                  <select 
                    id="provider-categoria" value={newProvider.categoria}
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
                <label htmlFor="provider-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email (Opcional)</label>
                <input 
                  type="email" maxLength={254}
                  id="provider-email" value={newProvider.email}
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
              </fieldset>
              <button type="button" disabled={isSubmitting} onClick={() => { if (!inFlight.current && window.confirm('¿Descartar el borrador de proveedor? No se borrarán proveedores registrados.')) { setNewProvider(emptyProvider()); setError(''); } }} className="w-full text-sm text-red-700 dark:text-red-400">Descartar borrador de proveedor</button>
              <p className="text-xs text-slate-500">Cerrar conserva este borrador. Navegar a otra pantalla o cerrar sesión lo pierde.</p>
            </form>
          </div>
        </ModalDialog>
      )}

      {/* Lista de Proveedores */}
      <div className="grid gap-4 sm:grid-cols-2">
        {loadError ? !showAddModal && <RequestError message={loadError} onRetry={fetchProviders} /> : providers.length === 0 ? (
          <p className="text-slate-500 text-center py-8 col-span-full">No hay proveedores registrados.</p>
        ) : (
          providers.map(provider => (
            <div key={provider.id} className="min-w-0 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors duration-200 [overflow-wrap:anywhere]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-slate-900 dark:text-white font-bold">{provider.nombre}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 mt-1 inline-block">
                    {provider.categoria || 'Sin categoría'}
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
