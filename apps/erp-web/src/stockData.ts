import { readList } from './apiResponse';
import { isCivilDate } from './financialValues';

export interface StockItem {
  id: number; producto: string; stock_actual: number; stock_minimo: number; local: string;
  categoria: string | null; proveedor_id: number | null; proveedor_nombre: string | null; proveedor_telefono: string | null;
}
export interface OrderedProduct { producto_id: number; nombre: string; cantidad: number; }
export interface StockOrder {
  id: number; fecha: string; local: string; proveedor_id: number | null; proveedor_nombre: string;
  productos: OrderedProduct[]; estado: 'pendiente' | 'recibido';
}
const positiveId = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const local = (value: unknown) => value === 'Principal' || value === 'Segundo Local';

export async function readStock(response: Response): Promise<StockItem[]> {
  const items = await readList<StockItem>(response);
  const ids = new Set<number>();
  for (const item of items) {
    if (!item || !positiveId(item.id) || ids.has(item.id) || !text(item.producto) || !count(item.stock_actual) || !count(item.stock_minimo) ||
      !local(item.local) || !nullableText(item.categoria) || (item.proveedor_id !== null && !positiveId(item.proveedor_id)) ||
      !nullableText(item.proveedor_nombre) || !nullableText(item.proveedor_telefono)) throw new Error('El stock contiene datos inválidos. No se muestra una lista parcial.');
    ids.add(item.id);
  }
  return items;
}

export async function readOrders(response: Response): Promise<StockOrder[]> {
  const orders = await readList<Omit<StockOrder, 'productos'> & { productos: unknown }>(response);
  const ids = new Set<number>();
  const invalid = () => new Error('El historial contiene pedidos inválidos. No se muestran recepciones ni líneas parciales.');
  const result = orders.map(order => {
    if (!order || !positiveId(order.id) || ids.has(order.id) || !isCivilDate(order.fecha) || !local(order.local) ||
      (order.proveedor_id !== null && !positiveId(order.proveedor_id)) || !text(order.proveedor_nombre) ||
      (order.estado !== 'pendiente' && order.estado !== 'recibido') || typeof order.productos !== 'string') throw invalid();
    ids.add(order.id);
    let lines: unknown;
    try { lines = JSON.parse(order.productos); } catch { throw invalid(); }
    if (!Array.isArray(lines) || lines.length === 0 || lines.length > 500) throw invalid();
    for (const line of lines) {
      if (!line || !positiveId(line.producto_id) || !text(line.nombre) || !positiveId(line.cantidad) || line.cantidad > 1000000) throw invalid();
    }
    // Repeated product IDs remain separate: the API permits and receives each stored line.
    return { ...order, productos: lines as OrderedProduct[] };
  });
  return result.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
}

export async function readStockWorkspace(responses: Response[]): Promise<[StockItem[], StockOrder[]]> {
  return Promise.all([readStock(responses[0]), readOrders(responses[1])]);
}
