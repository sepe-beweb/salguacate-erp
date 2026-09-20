import { locationLabel } from '../locations';
import { useLocalScope } from '../hooks/useLocalScope';
import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Loader2, X, AlertTriangle, Send, CheckCircle2, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

import { readJson, errorMessage } from '../apiResponse';
import { useApiRead } from '../hooks/useApiLists';
import { readInventoryWorkspace, stockAlerts, groupStockAlerts, stockAlertText, catalogImageSource, type CatalogItem } from '../catalogData';
import RequestError from '../components/RequestError';
import ModalDialog from '../components/ModalDialog';
import { emptyProduct, readProductForm } from '../catalogForms';
import { useProductImage } from '../hooks/useProductImage';

export default function Inventory() {
  const { fetchWithAuth } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMainTab, setActiveMainTab] = useState<'inventario' | 'alertas'>('inventario');
  const [activeTab, setActiveTab] = useState<'todas' | 'Bebida' | 'Comida'>('todas');
  const [filterLocal, setFilterLocal] = useLocalScope();
  const suffix = filterLocal === 'Todos' ? '' : `?local=${encodeURIComponent(filterLocal)}`;
  const { data, loading, error: loadError, reload: fetchInventory } = useApiRead([
    `/api/inventario${suffix}`, '/api/proveedores'
  ], readInventoryWorkspace);
  const [items, providers] = data ?? [[], []];
  const providerNames = new Map<string, number>();
  providers.forEach(provider => providerNames.set(provider.nombre, (providerNames.get(provider.nombre) ?? 0) + 1));
  const alertas = stockAlerts(items);
  const stockInFlight = useRef(false);
  const clipboardGeneration = useRef(0);
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => { setCopyStatus(''); return () => { clipboardGeneration.current++; }; }, [data]);
  const [error, setError] = useState('');
  const [updatingStock, setUpdatingStock] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState(emptyProduct);
  const [hasDraft, setHasDraft] = useState(false);
  const image = useProductImage();
  const createInFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleAction = () => { void fetchInventory(); };
    window.addEventListener('ai_action_executed', handleAction);
    return () => window.removeEventListener('ai_action_executed', handleAction);
  }, [fetchInventory]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (file && !createInFlight.current) { setHasDraft(true); setError(''); image.read(file); }
  };
  const closeProduct = () => { if (!createInFlight.current) { image.cancel(); setShowAddModal(false); } };
  const discardProduct = () => {
    if (createInFlight.current || !window.confirm('¿Descartar el borrador de producto y su imagen? No se borrarán productos del catálogo.')) return;
    image.clear(); setNewItem(emptyProduct(filterLocal === 'Todos' ? 'Principal' : filterLocal)); setHasDraft(false); setError('');
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.producto.toLowerCase().includes(searchTerm.toLowerCase());
    const itemCat = item.categoria;
    const matchesTab = activeTab === 'todas' || itemCat === activeTab;
    return matchesSearch && matchesTab;
  });

  const updateStock = async (id: number, increment: number) => {
    const item = items.find(value => value.id === id);
    if (stockInFlight.current || isSubmitting || loading || loadError || !item || ![-1, 1].includes(increment) ||
      (increment < 0 && item.stock_actual === 0) || !Number.isSafeInteger(item.stock_actual + increment)) return;
    stockInFlight.current = true;
    setUpdatingStock(true);
    setError('');

    try {
      const res = await fetchWithAuth(`${API_URL}/api/inventario/${id}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increment })
      });
      await readJson(res);
      await fetchInventory();
    } catch (err) {
      setError(`${errorMessage(err)} Comprueba el stock antes de repetir el ajuste.`);
      await fetchInventory();
    } finally {
      stockInFlight.current = false;
      setUpdatingStock(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createInFlight.current || stockInFlight.current || loading || loadError || image.reading) return;
    let payload;
    try { payload = readProductForm(newItem); } catch (cause) { setError(errorMessage(cause)); return; }
    if (payload.proveedor_id !== null && !providers.some(provider => provider.id === payload.proveedor_id)) { setError('El proveedor seleccionado ya no está disponible. Revisa el formulario.'); return; }
    createInFlight.current = true;
    setError('');
    setIsSubmitting(true);
    
    try {
      const res = await fetchWithAuth(`${API_URL}/api/inventario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, imagen_base64: image.value })
      });
      await readJson(res);
      setShowAddModal(false);
      setNewItem(emptyProduct(filterLocal !== 'Todos' ? filterLocal : 'Principal')); image.clear(); setHasDraft(false);
      await fetchInventory();
    } catch (err) {
      setError(`${errorMessage(err)} Revisa el catálogo antes de repetir el alta si se perdió la conexión.`);
    } finally {
      createInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const copiarAlertas = async (proveedorNombre: string, local: string, productos: CatalogItem[]) => {
    const generation = ++clipboardGeneration.current; setCopyStatus(''); setError('');
    try {
      await navigator.clipboard.writeText(stockAlertText(proveedorNombre, local, productos));
      if (generation === clipboardGeneration.current) setCopyStatus('Lista de alertas copiada. No se ha registrado un pedido ni enviado un mensaje.');
    } catch (cause) { if (generation === clipboardGeneration.current) setError(errorMessage(cause)); }
  };

  if (loading && !showAddModal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <Loader2 size={32} className="animate-spin text-brand-500 mb-4" />
        <p>Cargando inventario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inventario</h2>
        <button 
          aria-label="Nuevo producto" disabled={Boolean(loadError) || updatingStock || isSubmitting} onClick={() => { setError(''); if (!hasDraft) { setNewItem(emptyProduct(filterLocal === 'Todos' ? 'Principal' : filterLocal)); image.clear(); } setShowAddModal(true); }}
          className="bg-brand-600 hover:bg-brand-700 dark:hover:bg-brand-500 text-white p-2 rounded-full transition-colors shadow-md dark:shadow-brand-500/20"
        >
          <Plus size={20} />
        </button>
      </div>

      {!showAddModal && <RequestError message={error} />}
      {copyStatus && <p role="status" className="text-emerald-700 dark:text-emerald-400">{copyStatus}</p>}
      {/* Filtro por Local */}
      <div className="flex gap-2">
        {['Todos', 'Principal', 'Segundo Local'].map(l => (
          <button key={l} aria-pressed={filterLocal === l} onClick={() => setFilterLocal(l)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${filterLocal === l ? 'bg-brand-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
          >
            <MapPin size={12} />{locationLabel(l)}
          </button>
        ))}
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        <button 
          aria-pressed={activeMainTab === 'inventario'} onClick={() => setActiveMainTab('inventario')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeMainTab === 'inventario' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Catálogo
        </button>
        <button 
          aria-pressed={activeMainTab === 'alertas'} onClick={() => setActiveMainTab('alertas')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeMainTab === 'alertas' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <AlertTriangle size={16} className={alertas.length > 0 ? "text-red-500 animate-pulse" : ""} />
          Alertas de Stock
          {alertas.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{alertas.length}</span>
          )}
        </button>
      </div>

      {showAddModal && (
        <ModalDialog label="Nuevo Producto" busy={isSubmitting} onClose={closeProduct}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nuevo Producto</h3>
              <button aria-label="Cancelar producto" disabled={isSubmitting} onClick={closeProduct} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddItem} onChange={() => setHasDraft(true)} className="space-y-4">
              <RequestError message={error || image.error} />
              <RequestError message={loadError} onRetry={fetchInventory} />
              {loading && <p role="status">Actualizando catálogo...</p>}
              {image.reading && <p role="status">Leyendo imagen...</p>}
              <fieldset disabled={isSubmitting || loading || !!loadError} className="space-y-4">
              <div>
                <label htmlFor="product-producto" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Producto</label>
                <input 
                  type="text" 
                  required maxLength={160} data-autofocus
                  id="product-producto" value={newItem.producto}
                  onChange={e => setNewItem({...newItem, producto: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  placeholder="Ej. Ginebra Tanqueray 70cl"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="product-stock_actual" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Actual</label>
                  <input 
                    type="number" 
                    min="0" max="1000000" step="1" required
                    id="product-stock_actual" value={newItem.stock_actual}
                    onChange={e => setNewItem({...newItem, stock_actual: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="product-stock_minimo" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Mínimo</label>
                  <input 
                    type="number" 
                    min="0" max="1000000" step="1" required
                    id="product-stock_minimo" value={newItem.stock_minimo}
                    onChange={e => setNewItem({...newItem, stock_minimo: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="product-categoria" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                <select 
                  id="product-categoria" value={newItem.categoria}
                  onChange={e => setNewItem({...newItem, categoria: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Bebida">Bebida</option>
                  <option value="Comida">Comida / Tapa</option>
                </select>
              </div>

              <div>
                <label htmlFor="product-local" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local</label>
                <select
                  id="product-local" value={newItem.local}
                  onChange={e => setNewItem({...newItem, local: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Principal">{locationLabel('Principal')}</option>
                  <option value="Segundo Local">{locationLabel('Segundo Local')}</option>
                </select>
              </div>

              <div>
                <label htmlFor="product-proveedor_id" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Proveedor (Opcional)</label>
                <select 
                  id="product-proveedor_id" value={newItem.proveedor_id}
                  onChange={e => setNewItem({...newItem, proveedor_id: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">Sin proveedor</option>
                  {newItem.proveedor_id && !providers.some(provider => String(provider.id) === newItem.proveedor_id) && <option value={newItem.proveedor_id}>Proveedor no disponible (#{newItem.proveedor_id})</option>}
                  {providers.map(prov => (
                    <option key={prov.id} value={prov.id}>{prov.nombre}{providerNames.get(prov.nombre)! > 1 ? ` (#${prov.id})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="product-image" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Imagen (Opcional)</label>
                <input 
                  id="product-image" type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleImageUpload}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
                {image.value && (
                  <img src={image.value} alt="Vista previa del producto" className="mt-2 h-20 w-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                )}
                {(image.value || image.reading) && <button type="button" onClick={image.clear} className="mt-2 text-sm text-red-700 dark:text-red-400">Retirar imagen</button>}
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting || image.reading}
                className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Guardar Producto"}
              </button>
              </fieldset>
              <button type="button" disabled={isSubmitting} onClick={discardProduct} className="w-full text-sm text-red-700 dark:text-red-400">Descartar borrador de producto</button>
              <p className="text-xs text-slate-500">Cerrar conserva el borrador en esta pantalla, pero cancela una imagen aún en lectura. Navegar a otra pantalla o cerrar sesión pierde el borrador.</p>
            </form>
          </div>
        </ModalDialog>
      )}

      {loadError ? !showAddModal && <RequestError message={loadError} onRetry={fetchInventory} /> : activeMainTab === 'inventario' ? (
        <>
          {/* Buscador, Pestañas y Filtros */}
          <div className="space-y-4">
            {/* Pestañas */}
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
          <button 
            aria-pressed={activeTab === 'todas'} onClick={() => setActiveTab('todas')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'todas' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Todas
          </button>
          <button 
            aria-pressed={activeTab === 'Bebida'} onClick={() => setActiveTab('Bebida')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'Bebida' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Bebidas
          </button>
          <button 
            aria-pressed={activeTab === 'Comida'} onClick={() => setActiveTab('Comida')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'Comida' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Comidas
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400 dark:text-slate-500" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar artículos..." 
              aria-label="Buscar artículos"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-brand-500 transition-colors shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Lista de Artículos */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map(item => {
          const isLowStock = item.stock_actual <= item.stock_minimo;
          
          return (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200 [overflow-wrap:anywhere]">
              <div className="mb-4 rounded-xl overflow-hidden bg-stone-50 dark:bg-slate-800">
                {item.imagen_url ? <img src={catalogImageSource(item.imagen_url, API_URL)} referrerPolicy="no-referrer" alt={item.producto} loading="lazy" decoding="async" width={320} height={200} className="w-full h-44 object-contain" />
                  : <div className="h-44 flex items-center justify-center text-slate-500 text-sm">Sin foto</div>}
              </div>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 flex gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col items-start gap-1 mb-1">
                      <h4 className="text-slate-900 dark:text-white font-medium">{item.producto}</h4>
                      <span className={`shrink-0 whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.categoria === 'Comida'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {item.categoria || 'Sin categoría'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{locationLabel(item.local)}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.proveedor_nombre || 'Sin proveedor asignado'}</p>
                  </div>
                </div>
                <div className="shrink-0 pl-3 text-right">
                  <span className={`text-xl font-bold ${isLowStock ? 'text-red-500 dark:text-red-400' : 'text-brand-600 dark:text-brand-400'}`}>
                    {item.stock_actual}
                  </span>
                  <p className="text-[10px] text-slate-500">Mín: {item.stock_minimo}</p>
                </div>
              </div>
              
              {/* Controles rápidos de stock */}
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                <button 
                  aria-label={`Restar stock de ${item.producto}`} disabled={updatingStock || item.stock_actual === 0} onClick={() => updateStock(item.id, -1)}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 w-10 h-8 rounded-lg flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <button 
                  aria-label={`Sumar stock de ${item.producto}`} disabled={updatingStock || item.stock_actual === Number.MAX_SAFE_INTEGER} onClick={() => updateStock(item.id, 1)}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 w-10 h-8 rounded-lg flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            No se encontraron artículos con "{searchTerm}"
          </div>
        )}
      </div>
        </>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
              <p className="text-lg font-medium text-slate-900 dark:text-white">Todo en orden</p>
              <p>Ningún producto está en su stock mínimo o por debajo.</p>
            </div>
          ) : (
            groupStockAlerts(alertas).map(({ key, name: proveedor, local, providerId, items: prodList }) => {
              return (
              <section key={key} aria-label={`Alertas de ${proveedor} · ${locationLabel(local)} · ${providerId ?? 'sin proveedor'}`} className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/30 overflow-hidden shadow-sm [overflow-wrap:anywhere]">
                <div className="bg-red-50 dark:bg-red-900/10 px-4 py-3 border-b border-red-100 dark:border-red-900/20 flex justify-between items-center">
                  <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    {proveedor}
                  </h3>
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">{prodList.length} productos</span>
                </div>
                
                <div className="p-4 space-y-3">
                  <p className="text-sm">{locationLabel(local)} · {providerId === null ? 'Sin proveedor asignado' : `Proveedor #${providerId}`}</p>
                  {prodList.map(p => (
                    <div key={p.id} className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 last:border-0 pb-2 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 dark:bg-slate-800 h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {p.imagen_url ? (
                            <img src={catalogImageSource(p.imagen_url, API_URL)} referrerPolicy="no-referrer" alt={p.producto} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-slate-400 font-bold text-lg">{p.producto.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{p.producto}</p>
                          <p className="text-xs text-slate-500">{p.stock_actual === p.stock_minimo ? 'En el mínimo' : `Hasta el mínimo: ${p.stock_minimo - p.stock_actual}`} (Min: {p.stock_minimo})</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">{p.stock_actual}</span>
                        <span className="text-xs text-slate-500 block">en stock</span>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => copiarAlertas(proveedor, local, prodList)}
                    className="w-full mt-4 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-400 font-medium py-2.5 rounded-lg flex justify-center items-center gap-2 transition-colors border border-brand-200 dark:border-brand-800/50"
                  >
                    <Send size={18} /> Copiar lista de alertas
                  </button>
                </div>
              </section>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
