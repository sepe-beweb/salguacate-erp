import { locationLabel } from '../locations';
import { useLocalScope } from '../hooks/useLocalScope';
import LocalFilter from '../components/LocalFilter';
import { useState, useEffect, useRef } from 'react';
import { ClipboardCheck, Send, Copy, CheckCircle2, Package, MapPin, ShoppingCart, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

import { readJson, errorMessage } from '../apiResponse';
import { useApiRead } from '../hooks/useApiLists';
import { readStockWorkspace, type StockItem, type StockOrder as Pedido } from '../stockData';
import { formatCivilDate } from '../financialValues';
import RequestError from '../components/RequestError';
import { localDate } from '../localDate';
import ModalDialog from '../components/ModalDialog';
import { createOrderDraft, groupOrderLines, providerKey, validOrderQuantity, type OrderDraft, type OrderLine } from '../orderDraft';

const LOCALES = ['Principal', 'Segundo Local'];

export default function StockControl() {
  const { fetchWithAuth } = useAuth();
  const [localScope, setSelectedLocal] = useLocalScope('Todos');
  const selectedLocal = localScope === 'Todos' ? LOCALES[0] : localScope;
  const { data, loading, error: loadError, reload: fetchData } = useApiRead([
    `/api/inventario?local=${encodeURIComponent(selectedLocal)}`, '/api/pedidos'
  ], readStockWorkspace);
  const [items, allOrders] = data ?? [[], []];
  const pedidos = allOrders.filter(order => localScope === 'Todos' || order.local === selectedLocal);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState<Pedido | null>(null);
  const inFlight = useRef(false);
  const clipboardGeneration = useRef(0);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [showOrder, setShowOrder] = useState(false);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [visibleOrders, setVisibleOrders] = useState(10);
  const [copiedProv, setCopiedProv] = useState<string | null>(null);

  useEffect(() => { setCheckedIds(new Set()); }, [selectedLocal]);
  useEffect(() => () => { clipboardGeneration.current++; }, []);

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
    if (inFlight.current || loading || loadError) return;
    if (draft && !window.confirm('¿Sustituir el borrador de pedido anterior? Los pedidos ya registrados no se borran. Consulta el historial antes de repetirlos.')) return;
    try {
      const next = createOrderDraft(items, checkedIds, selectedLocal, localDate());
      clipboardGeneration.current++;
      setDraft(next); setError(''); setSuccess(''); setRegistered(new Set()); setCopiedProv(null); setShowOrder(true);
    } catch (cause) { setError(errorMessage(cause)); }
  };

  const updateQty = (line: OrderLine, qty: number) => {
    if (inFlight.current || registered.has(providerKey(line)) || !validOrderQuantity(qty)) return;
    clipboardGeneration.current++; setCopiedProv(null);
    setDraft(prev => prev && ({ ...prev, lines: prev.lines.map(item => item.producto_id === line.producto_id ? { ...item, cantidad: qty } : item) }));
  };

  const grouped = groupOrderLines(draft?.lines ?? []);
  const closeOrder = () => { if (!inFlight.current) { clipboardGeneration.current++; setCopiedProv(null); setShowOrder(false); } };
  const discardOrder = () => {
    if (inFlight.current || !window.confirm('¿Descartar este borrador? No se eliminarán los pedidos registrados. Comprueba el historial antes de repetir un registro sin confirmar.')) return;
    clipboardGeneration.current++;
    setDraft(null); setShowOrder(false); setRegistered(new Set()); setCopiedProv(null); setError(''); setSuccess('');
  };

  const generateWhatsAppText = (provName: string, lines: OrderLine[]) => {
    const header = `📦 *Pedido Salguacate — ${locationLabel(draft!.local)}*\n📅 ${formatCivilDate(draft!.fecha)}\n\nHola ${provName}, necesitamos:\n`;
    const body = lines.map(l => `• ${l.nombre} — *${l.cantidad} uds*`).join('\n');
    return header + body + '\n\n¡Gracias!';
  };

  const registrarPedido = async (key: string, provName: string, lines: OrderLine[]) => {
    if (inFlight.current || registered.has(key) || !draft || loading || loadError) return;
    if (!lines.length || lines.length > 500 || lines.some(line => !validOrderQuantity(line.cantidad))) { setError('Revisa las cantidades y las líneas del pedido.'); return; }
    inFlight.current = true;
    setBusy(true); setError(''); setSuccess('');
    try {
      await readJson(await fetchWithAuth(`${API_URL}/api/pedidos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: draft.fecha, local: draft.local,
          proveedor_id: lines[0]?.proveedor_id, proveedor_nombre: provName,
          productos: lines.map(l => ({ producto_id: l.producto_id, nombre: l.nombre, cantidad: l.cantidad })) })
      }));
      setRegistered(prev => new Set(prev).add(key));
      setSuccess(`Pedido de ${provName} registrado. El registro no envía mensajes al proveedor.`);
      await fetchData();
    } catch (cause) {
      setError(`${errorMessage(cause)} Comprueba el historial antes de repetir el registro.`);
    } finally { inFlight.current = false; setBusy(false); }
  };

  const sendWhatsApp = (provName: string, lines: OrderLine[], phone?: string | null) => {
    const text = generateWhatsAppText(provName, lines);
    const cleanPhone = phone?.replace(/\s+/g, '').replace(/^\+/, '') || '';
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyText = async (key: string, provName: string, lines: OrderLine[]) => {
    const generation = ++clipboardGeneration.current;
    setCopiedProv(null);
    try {
      await navigator.clipboard.writeText(generateWhatsAppText(provName, lines));
      if (generation === clipboardGeneration.current) setCopiedProv(key);
    } catch (cause) { if (generation === clipboardGeneration.current) setError(errorMessage(cause)); }
  };

  const markReceived = async (sumar_stock: boolean) => {
    if (!receiving || inFlight.current || loading || loadError) return;
    inFlight.current = true;
    setBusy(true); setError(''); setSuccess('');
    try {
      await readJson(await fetchWithAuth(`${API_URL}/api/pedidos/${receiving.id}/recibido`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sumar_stock })
      }));
      setSuccess(sumar_stock ? 'Pedido recibido y stock actualizado.' : 'Pedido recibido sin modificar el stock.');
      setReceiving(null);
      await fetchData();
      window.dispatchEvent(new Event('ai_action_executed'));
    } catch (cause) {
      setError(`${errorMessage(cause)} Comprueba el historial antes de repetir la recepción.`);
    } finally { inFlight.current = false; setBusy(false); }
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
          Pedidos
        </h2>
        <button onClick={() => setShowHistory(!showHistory)} className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${showHistory ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
          <History size={14} className="inline mr-1" /> Historial
        </button>
      </div>

      {!showOrder && !receiving && <RequestError message={error} />}
      {!showOrder && success && <p role="status" className="text-emerald-700 dark:text-emerald-400">{success}</p>}
      {!showOrder && loadError && <RequestError message={loadError} onRetry={fetchData} />}
      {loading && <p role="status">Cargando stock y pedidos...</p>}
      {!showOrder && draft && <button disabled={busy} onClick={() => { setCopiedProv(null); setShowOrder(true); }} className="rounded-lg border p-3 text-sm">Retomar pedido de {locationLabel(draft.local)}</button>}
      {receiving && <ModalDialog label={`Recibir pedido de ${receiving.proveedor_nombre}`} busy={busy} onClose={() => { setReceiving(null); setError(''); }}>
        <div className="space-y-4 p-6 [overflow-wrap:anywhere]">
          <h3 id="receipt-title" className="text-lg font-bold">Recibir pedido de {receiving.proveedor_nombre}</h3>
          <p>Local: {locationLabel(receiving.local)}. Elige si esta recepción debe modificar el inventario. Solo se puede recibir una vez.</p>
          <RequestError message={error} />
          <button data-autofocus disabled={busy} onClick={() => { setReceiving(null); setError(''); }} className="block w-full rounded-lg border p-3">Cancelar</button>
          <button disabled={busy} onClick={() => markReceived(true)} className="block w-full rounded-lg bg-brand-600 p-3 text-white">Recibir y sumar stock</button>
          <button disabled={busy} onClick={() => markReceived(false)} className="block w-full rounded-lg border p-3">Recibir sin cambiar stock</button>
        </div>
      </ModalDialog>}
      {/* Local selector */}
      {showHistory ? <LocalFilter value={localScope} onChange={setSelectedLocal} /> : <div className="flex gap-2">
        {LOCALES.map(l => (
          <button key={l} aria-pressed={selectedLocal === l} onClick={() => setSelectedLocal(l)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${selectedLocal === l ? 'bg-brand-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>
            <MapPin size={14} /> {locationLabel(l)}
          </button>
        ))}
      </div>}
      {!showHistory && localScope === 'Todos' && <p className="text-xs text-slate-500">Preparando pedido para {locationLabel(selectedLocal)}. El historial muestra ambos locales hasta que selecciones uno.</p>}

      {/* History view */}
      {showHistory && !loading && !loadError && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pedidos recientes · {localScope === 'Todos' ? 'todos los locales' : locationLabel(localScope)}</h3>
          {pedidos.length === 0 ? (
            <p className="text-slate-400 text-center py-4 text-sm">Sin pedidos registrados.</p>
          ) : pedidos.slice(0, visibleOrders).map(p => {
            return (
              <div key={p.id} role="group" aria-label={`Pedido ${p.id} de ${p.proveedor_nombre}`} className={`bg-white dark:bg-slate-900 p-3 rounded-xl border shadow-sm ${p.estado === 'recibido' ? 'border-emerald-200 dark:border-emerald-800 opacity-60' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{p.proveedor_nombre}</p>
                    <p className="text-xs text-slate-400">{locationLabel(p.local)} · {formatCivilDate(p.fecha)}</p>
                  </div>
                  {p.estado === 'pendiente' ? (
                    <button disabled={busy} onClick={() => { setError(''); setReceiving(p); }} className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full font-semibold hover:bg-emerald-200 transition-colors">
                      ✓ Recibir
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-500 font-semibold">✓ Recibido</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.productos.map((pr, i) => (
                    <span key={i} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">{pr.nombre} ×{pr.cantidad}</span>
                  ))}
                </div>
              </div>
            );
          })}
          {pedidos.length > 0 && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Mostrando {Math.min(visibleOrders, pedidos.length)} de {pedidos.length} pedidos.</p>}
          {visibleOrders < pedidos.length && <button type="button" onClick={() => setVisibleOrders(count => count + 10)} className="w-full rounded-xl border border-slate-300 dark:border-slate-600 p-3 font-medium">Mostrar más pedidos</button>}
        </div>
      )}

      {/* Stock review list */}
      {!showHistory && !loading && !loadError && (
        <>
          {items.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
              <Package size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No hay productos en <strong>{locationLabel(selectedLocal)}</strong></p>
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
                      aria-pressed={isChecked}
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
                          <span className="text-xs text-slate-400">{item.categoria || 'Sin categoría'}</span>
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
      {showOrder && draft && (
        <ModalDialog label={`Pedido de ${locationLabel(draft.local)}`} busy={busy} onClose={closeOrder} wide>
          <div className="p-6 [overflow-wrap:anywhere]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">📦 Pedido — {locationLabel(draft.local)}</h3>
              <button data-autofocus aria-label="Cerrar pedido" disabled={busy} onClick={closeOrder} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <RequestError message={error} />
            <RequestError message={loadError} onRetry={fetchData} />
            <p className="mb-3 text-sm">Fecha del pedido: {formatCivilDate(draft.fecha)}</p>
            {success && <p role="status" className="my-3 text-emerald-700 dark:text-emerald-400">{success}</p>}
            <p className="mb-4 text-sm text-slate-500">Abrir WhatsApp o copiar el texto no registra ni confirma el envío. Registra el pedido cuando corresponda.</p>
            {grouped.map(({ key, name: provName, lines }) => {
              return (
                <section key={key} aria-label={`${provName} · ${lines[0].proveedor_id === null ? 'sin proveedor asignado' : `proveedor ${lines[0].proveedor_id}`}`} className="mb-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-3">{provName}</h4>
                  <p className="mb-3 text-xs">{lines[0].proveedor_id === null ? 'Sin proveedor asignado' : `Proveedor #${lines[0].proveedor_id}`}</p>
                  <div className="space-y-2">
                    {lines.map((line, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{line.nombre}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button aria-label={`Restar unidades de ${line.nombre}`} disabled={busy || registered.has(key) || line.cantidad <= 1} onClick={() => updateQty(line, line.cantidad - 1)} className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">-</button>
                          <span className="min-w-8 text-center font-bold text-sm text-slate-900 dark:text-white">{line.cantidad}</span>
                          <button aria-label={`Sumar unidades de ${line.nombre}`} disabled={busy || registered.has(key) || line.cantidad >= 1000000} onClick={() => updateQty(line, line.cantidad + 1)} className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button disabled={busy || loading || !!loadError || registered.has(key)} onClick={() => registrarPedido(key, provName, lines)} className="mt-3 w-full rounded-lg bg-brand-600 p-3 text-white disabled:opacity-50">
                    {registered.has(key) ? 'Pedido registrado' : 'Registrar pedido en historial'}
                  </button>
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button disabled={busy}
                      onClick={() => sendWhatsApp(provName, lines, lines[0]?.proveedor_telefono)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-sm transition-colors"
                    >
                      <Send size={14} /> WhatsApp
                    </button>
                    <button disabled={busy}
                      onClick={() => copyText(key, provName, lines)}
                      className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                    >
                      {copiedProv === key ? <><CheckCircle2 size={14} className="text-emerald-500" /> Copiado</> : <><Copy size={14} /> Copiar</>}
                    </button>
                  </div>
                </section>
              );
            })}

            <button disabled={busy} onClick={closeOrder} className="w-full mt-2 py-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cerrar
            </button>
            <button disabled={busy} onClick={discardOrder} className="w-full mt-2 py-3 text-sm text-red-700 dark:text-red-400">Descartar borrador de pedido</button>
            <p className="mt-3 text-xs text-slate-500">Cerrar conserva el borrador mientras permanezcas en esta pantalla. Navegar a otra pantalla o cerrar sesión lo pierde.</p>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
