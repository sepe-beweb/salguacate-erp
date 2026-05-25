import { useState, useEffect } from 'react';
import { Search, Plus, Filter, Loader2, X, AlertTriangle, Send, CheckCircle2, MapPin } from 'lucide-react';

interface Item {
  id: number;
  producto: string;
  stock_actual: number;
  stock_minimo: number;
  local: string;
  categoria?: string;
  imagen_url?: string;
  proveedor_id?: number;
}

interface Provider {
  id: number;
  nombre: string;
}

export default function Inventory() {
  const [items, setItems] = useState<Item[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMainTab, setActiveMainTab] = useState<'inventario' | 'alertas'>('inventario');
  const [activeTab, setActiveTab] = useState<'todas' | 'Bebida' | 'Comida'>('todas');
  const [filterLocal, setFilterLocal] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ producto: '', stock_actual: 0, stock_minimo: 5, categoria: 'Bebida', proveedor_id: '', imagen_base64: '', local: 'Principal' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInventory = () => {
    const url = filterLocal !== 'Todos'
      ? `http://localhost:3001/api/inventario?local=${encodeURIComponent(filterLocal)}`
      : 'http://localhost:3001/api/inventario';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error al cargar inventario", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInventory();
    fetch('http://localhost:3001/api/proveedores')
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(err => console.error(err));
      
    fetch('http://localhost:3001/api/inventario/alertas')
      .then(res => res.json())
      .then(data => setAlertas(data))
      .catch(err => console.error(err));

    // Escuchar si la IA realiza alguna acción (modificar_stock)
    const handleAiAction = () => {
      fetchInventory();
      fetch('http://localhost:3001/api/inventario/alertas')
        .then(res => res.json())
        .then(data => setAlertas(data))
        .catch(err => console.error(err));
    };
    window.addEventListener('ai_action_executed', handleAiAction);
    
    return () => {
      window.removeEventListener('ai_action_executed', handleAiAction);
    };
  }, [filterLocal]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewItem(prev => ({ ...prev, imagen_base64: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.producto.toLowerCase().includes(searchTerm.toLowerCase());
    const itemCat = item.categoria || 'Bebida';
    const matchesTab = activeTab === 'todas' || itemCat === activeTab;
    return matchesSearch && matchesTab;
  });

  const updateStock = async (id: number, increment: number) => {
    // Optimistic UI update
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, stock_actual: Math.max(0, item.stock_actual + increment) };
      }
      return item;
    }));

    try {
      await fetch(`http://localhost:3001/api/inventario/${id}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increment })
      });
    } catch (err) {
      console.error("Error actualizando stock", err);
      fetchInventory(); // Revert on error
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.producto) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch('http://localhost:3001/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewItem({ producto: '', stock_actual: 0, stock_minimo: 5, categoria: 'Bebida', proveedor_id: '', imagen_base64: '', local: filterLocal !== 'Todos' ? filterLocal : 'Principal' });
        fetchInventory();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generarPedido = (proveedorNombre: string, productos: any[]) => {
    const header = `Hola ${proveedorNombre}, este es el pedido para Salguacate:\n\n`;
    const body = productos.map(p => `- ${Math.max(0, p.stock_minimo - p.stock_actual)}x ${p.producto}`).join('\n');
    const footer = `\n\nGracias!`;
    const msg = header + body + footer;
    
    navigator.clipboard.writeText(msg).then(() => {
      alert(`Mensaje copiado al portapapeles. ¡Listo para pegar en WhatsApp o Email!\n\n${msg}`);
    });
  };

  if (loading) {
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
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inventario Crítico</h2>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-brand-600 hover:bg-brand-700 dark:hover:bg-brand-500 text-white p-2 rounded-full transition-colors shadow-md dark:shadow-brand-500/20"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Filtro por Local */}
      <div className="flex gap-2">
        {['Todos', 'Principal', 'Segundo Local'].map(l => (
          <button key={l} onClick={() => setFilterLocal(l)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${filterLocal === l ? 'bg-brand-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
          >
            <MapPin size={12} />{l}
          </button>
        ))}
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        <button 
          onClick={() => setActiveMainTab('inventario')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeMainTab === 'inventario' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Catálogo
        </button>
        <button 
          onClick={() => setActiveMainTab('alertas')}
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nuevo Producto</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Producto</label>
                <input 
                  type="text" 
                  required
                  value={newItem.producto}
                  onChange={e => setNewItem({...newItem, producto: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  placeholder="Ej. Ginebra Tanqueray 70cl"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Actual</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newItem.stock_actual}
                    onChange={e => setNewItem({...newItem, stock_actual: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Mínimo</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newItem.stock_minimo}
                    onChange={e => setNewItem({...newItem, stock_minimo: parseInt(e.target.value) || 0})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                <select 
                  value={newItem.categoria}
                  onChange={e => setNewItem({...newItem, categoria: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Bebida">Bebida</option>
                  <option value="Comida">Comida / Tapa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Local</label>
                <select
                  value={newItem.local}
                  onChange={e => setNewItem({...newItem, local: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Principal">Principal</option>
                  <option value="Segundo Local">Segundo Local</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Proveedor (Opcional)</label>
                <select 
                  value={newItem.proveedor_id}
                  onChange={e => setNewItem({...newItem, proveedor_id: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">Sin proveedor</option>
                  {providers.map(prov => (
                    <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Imagen (Opcional)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
                {newItem.imagen_base64 && (
                  <img src={newItem.imagen_base64} alt="Preview" className="mt-2 h-20 w-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                )}
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Guardar Producto"}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeMainTab === 'inventario' ? (
        <>
          {/* Buscador, Pestañas y Filtros */}
          <div className="space-y-4">
            {/* Pestañas */}
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('todas')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'todas' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Todas
          </button>
          <button 
            onClick={() => setActiveTab('Bebida')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'Bebida' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Bebidas
          </button>
          <button 
            onClick={() => setActiveTab('Comida')}
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-brand-500 transition-colors shadow-sm"
            />
          </div>
          <button className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm transition-colors">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Lista de Artículos */}
      <div className="space-y-3">
        {filteredItems.map(item => {
          const isLowStock = item.stock_actual <= item.stock_minimo;
          
          return (
            <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
              <div className="flex items-start justify-between">
                <div className="flex-1 flex gap-3">
                  {item.imagen_url ? (
                    <img src={`http://localhost:3001${item.imagen_url}`} alt={item.producto} className="w-12 h-12 object-cover rounded-lg bg-slate-100 dark:bg-slate-800" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                      <span className="text-slate-400 text-xs font-medium">No img</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-slate-900 dark:text-white font-medium">{item.producto}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        (item.categoria || 'Bebida') === 'Comida' 
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {item.categoria || 'Bebida'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{item.local}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xl font-bold ${isLowStock ? 'text-red-500 dark:text-red-400' : 'text-brand-600 dark:text-brand-400'}`}>
                    {item.stock_actual}
                  </span>
                  <p className="text-[10px] text-slate-500">Mín: {item.stock_minimo}</p>
                </div>
              </div>
              
              {/* Controles rápidos de stock */}
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                <button 
                  onClick={() => updateStock(item.id, -1)}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 w-10 h-8 rounded-lg flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <button 
                  onClick={() => updateStock(item.id, 1)}
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
              <p>Ningún producto está por debajo de su stock mínimo.</p>
            </div>
          ) : (
            Object.entries(
              alertas.reduce((acc, curr) => {
                const p = curr.proveedor_nombre || 'Sin Proveedor Asignado';
                if (!acc[p]) acc[p] = [];
                acc[p].push(curr);
                return acc;
              }, {} as Record<string, any[]>)
            ).map(([proveedor, productos]) => {
              const prodList = productos as any[];
              return (
              <div key={proveedor} className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/30 overflow-hidden shadow-sm">
                <div className="bg-red-50 dark:bg-red-900/10 px-4 py-3 border-b border-red-100 dark:border-red-900/20 flex justify-between items-center">
                  <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    {proveedor}
                  </h3>
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">{prodList.length} productos</span>
                </div>
                
                <div className="p-4 space-y-3">
                  {prodList.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 last:border-0 pb-2 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 dark:bg-slate-800 h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {p.imagen_url ? (
                            <img src={`http://localhost:3001${p.imagen_url}`} alt={p.producto} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-slate-400 font-bold text-lg">{p.producto.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{p.producto}</p>
                          <p className="text-xs text-slate-500">Necesarios: {Math.max(0, p.stock_minimo - p.stock_actual)} (Min: {p.stock_minimo})</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">{p.stock_actual}</span>
                        <span className="text-xs text-slate-500 block">en stock</span>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => generarPedido(proveedor, prodList)}
                    className="w-full mt-4 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-400 font-medium py-2.5 rounded-lg flex justify-center items-center gap-2 transition-colors border border-brand-200 dark:border-brand-800/50"
                  >
                    <Send size={18} /> Generar Pedido WhatsApp
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
