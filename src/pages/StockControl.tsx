import { useState, useEffect } from 'react';
import { ClipboardCheck, Loader2, Send, Copy, CheckCircle2, Package, MapPin, ShoppingCart, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

interface StockItem {
  id: number;
  producto: string;
  stock_actual: number;
  stock_minimo: number;
  local: string;
  categoria: string;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  proveedor_telefono: string | null;
}

interface OrderLine {
  producto_id: number;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
  cantidad: number;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  proveedor_telefono: string | null;
}

interface Pedido {
  id: number;
  fecha: string;
  local: string;
  proveedor_nombre: string;
  proveedor_telefono: string | null;
  productos: string;
  estado: string;
}

const LOCALES = ['Principal', 'Segundo Local'];

export default function StockControl() {
  const { fetchWithAuth } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocal, setSelectedLocal] = useState(LOCALES[0]);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [showOrder, setShowOrder] = useState(false);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedProv, setCopiedProv] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetchWithAuth(`${API_URL}/api/inventario?local=${selectedLocal}`).then(r => r.json()),
      fetchWithAuth(`${API_URL}/api/pedidos`).then(r => r.json()),
    ])
    .then(([inv, ped]) => { setItems(inv); setPedidos(ped); setLoading(false); })
    .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); setCheckedIds(new Set()); }, [selectedLocal]);

  const toggleItem = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllLow = () => {
    const lowIds = items.filter(i => i.stock_actual <= i.stock_minimo).map(i => i.id);
    setCheckedIds(new Set(lowIds));
  };

  const generateOrder = () => {
    const lines: OrderLine[] = items
      .filter(i => checkedIds.has(i.id))
      .map(i => ({
        producto_id: i.id,
        nombre: i.producto,
        stock_actual: i.stock_actual,
        stock_minimo: i.stock_minimo,
        cantidad: Math.max(1, i.stock_minimo - i.stock_actual),
        proveedor_id: i.proveedor_id,
        proveedor_nombre: i.proveedor_nombre || 'Sin proveedor',
        proveedor_telefono: i.proveedor_telefono || null
      }));
    setOrderLines(lines);
    setShowOrder(true);
  };

  const updateQty = (idx: number, qty: number) => {
    setOrderLines(prev => prev.map((l, i) => i === idx ? {...l, cantidad: Math.max(1, qty)} : l));
  };

  // Group by provider
  const grouped = orderLines.reduce<Record<string, OrderLine[]>>((acc, line) => {
    const key = line.proveedor_nombre || 'Sin proveedor';
    if (!acc[key]) acc[key] = [];
    acc[key].push(line);
    return acc;
  }, {});

  const generateWhatsAppText = (provName: string, lines: OrderLine[]) => {
    const header = `📦 *Pedido Salguacate — ${selectedLocal}*\n📅 ${new Date().toLocaleDateString('es-ES')}\n\nHola ${provName}, necesitamos:\n`;
    const body = lines.map(l => `• ${l.nombre} — *${l.cantidad} uds*`).join('\n');
    return header + body + '\n\n¡Gracias!';
  };

  const registrarPedido = (provName: string, lines: OrderLine[]) => {
    const provId = lines[0]?.proveedor_id;
    fetchWithAuth(`${API_URL}/api/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha: new Date().toISOString().split('T')[0],
        local: selectedLocal,
        proveedor_id: provId,
        proveedor_nombre: provName,
        productos: lines.map(l => ({ 
          producto_id: l.producto_id, 
          nombre: l.nombre, 
          cantidad: l.cantidad 
        }))
      })
    }).then(() => {
      fetchData();
      alert(`Pedido de ${provName} registrado en historial.`);
    });
  };

  const sendWhatsApp = (provName: string, lines: OrderLine[], phone?: string | null) => {
    const text = generateWhatsAppText(provName, lines);
    const cleanPhone = phone?.replace(/\s+/g, '').replace(/^\+/, '') || '';
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');

    setTimeout(() => {
      if (window.confirm(`¿Has enviado correctamente el pedido a ${provName}?\n¿Deseas registrarlo en el historial de pedidos?`)) {
        registrarPedido(provName, lines);
      }
    }, 1000);
  };

  const copyText = (provName: string, lines: OrderLine[]) => {
    navigator.clipboard.writeText(generateWhatsAppText(provName, lines));
    setCopiedProv(provName);
    setTimeout(() => setCopiedProv(null), 2000);
  };

  const markReceived = async (p: Pedido) => {
    if (window.confirm(`¿Marcar el pedido de ${p.proveedor_nombre} como recibido?`)) {
      const sumToInventory = window.confirm(`¿Deseas sumar automáticamente las cantidades recibidas al stock de ${p.local}?\n\nNota: Solo se sumarán aquellos productos que sigan existiendo en el catálogo.`);
      
      await fetchWithAuth(`${API_URL}/api/pedidos/${p.id}/recibido`, { method: 'PATCH' });
      
      if (sumToInventory) {
        let prods = [];
        try { 
          prods = JSON.parse(p.productos || '[]'); 
        } catch(e) {
          console.error("Error parseando", e);
        }
        for (const prod of prods) {
          if (prod.producto_id) {
            await fetchWithAuth(`${API_URL}/api/inventario/${prod.producto_id}/stock`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ increment: prod.cantidad })
            }).catch(console.error);
          }
        }
        alert("Cantidades sumadas al stock.");
        window.dispatchEvent(new Event('ai_action_executed'));
      }
      fetchData();
    }
  };

  const getStockColor = (item: StockItem) => {
    if (item.stock_actual <= 0) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    if (item.stock_actual <= item.stock_minimo) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
    return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ClipboardCheck className="text-brand-500" />
          Control de Stock
        </h2>
        <button onClick={() => setShowHistory(!showHistory)} className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${showHistory ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
          <History size={14} className="inline mr-1" /> Historial
        </button>
      </div>

      {/* Local selector */}
      <div className="flex gap-2">
        {LOCALES.map(l => (
          <button key={l} onClick={() => setSelectedLocal(l)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${selectedLocal === l ? 'bg-brand-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>
            <MapPin size={14} /> {l}
          </button>
        ))}
      </div>

      {/* History view */}
      {showHistory && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pedidos recientes</h3>
          {pedidos.length === 0 ? (
            <p className="text-slate-400 text-center py-4 text-sm">Sin pedidos registrados.</p>
          ) : pedidos.slice(0, 10).map(p => {
            let prods = [];
            try {
              prods = JSON.parse(p.productos || '[]');
            } catch (e) {
              console.error("Error parseando productos de pedido", e);
            }
            return (
              <div key={p.id} className={`bg-white dark:bg-slate-900 p-3 rounded-xl border shadow-sm ${p.estado === 'recibido' ? 'border-emerald-200 dark:border-emerald-800 opacity-60' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{p.proveedor_nombre}</p>
                    <p className="text-xs text-slate-400">{p.local} · {new Date(p.fecha).toLocaleDateString('es-ES')}</p>
                  </div>
                  {p.estado === 'pendiente' ? (
                    <button onClick={() => markReceived(p)} className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full font-semibold hover:bg-emerald-200 transition-colors">
                      ✓ Recibir
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-500 font-semibold">✓ Recibido</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {prods.map((pr: any, i: number) => (
                    <span key={i} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">{pr.nombre} ×{pr.cantidad}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stock review list */}
      {!showHistory && (
        <>
          {loading ? (
            <div className="flex justify-center py-12 text-brand-500"><Loader2 className="animate-spin" size={32} /></div>
          ) : items.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
              <Package size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No hay productos en <strong>{selectedLocal}</strong></p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">{items.length} productos · {checkedIds.size} seleccionados</p>
                <button onClick={selectAllLow} className="text-xs text-brand-600 font-semibold hover:underline">Seleccionar stock bajo</button>
              </div>

              <div className="space-y-1.5">
                {items.map(item => {
                  const isLow = item.stock_actual <= item.stock_minimo;
                  const isChecked = checkedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        isChecked 
                          ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 shadow-sm' 
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isChecked ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {isChecked && <CheckCircle2 size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${isLow ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{item.producto}</p>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{item.categoria}</span>
                          {item.proveedor_nombre && <span className="text-xs text-slate-400">· {item.proveedor_nombre}</span>}
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getStockColor(item)}`}>
                        {item.stock_actual}/{item.stock_minimo}
                      </div>
                    </button>
                  );
                })}
              </div>

              {checkedIds.size > 0 && (
                <button
                  onClick={generateOrder}
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md sticky bottom-20 z-10"
                >
                  <ShoppingCart size={20} />
                  Generar Pedido ({checkedIds.size} producto{checkedIds.size > 1 ? 's' : ''})
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* Order modal */}
      {showOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">📦 Pedido — {selectedLocal}</h3>
              <button onClick={() => setShowOrder(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {Object.entries(grouped).map(([provName, lines]) => {
              return (
                <div key={provName} className="mb-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-3">{provName}</h4>
                  <div className="space-y-2">
                    {lines.map((line, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{line.nombre}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(orderLines.indexOf(line), line.cantidad - 1)} className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">-</button>
                          <span className="w-8 text-center font-bold text-sm text-slate-900 dark:text-white">{line.cantidad}</span>
                          <button onClick={() => updateQty(orderLines.indexOf(line), line.cantidad + 1)} className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button 
                      onClick={() => sendWhatsApp(provName, lines, lines[0]?.proveedor_telefono)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-sm transition-colors"
                    >
                      <Send size={14} /> WhatsApp
                    </button>
                    <button
                      onClick={() => copyText(provName, lines)}
                      className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                    >
                      {copiedProv === provName ? <><CheckCircle2 size={14} className="text-emerald-500" /> Copiado</> : <><Copy size={14} /> Copiar</>}
                    </button>
                  </div>
                </div>
              );
            })}

            <button onClick={() => setShowOrder(false)} className="w-full mt-2 py-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
