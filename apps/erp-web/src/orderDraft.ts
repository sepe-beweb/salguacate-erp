import type { StockItem } from './stockData';

export interface OrderLine {
  producto_id: number; nombre: string; cantidad: number;
  proveedor_id: number | null; proveedor_nombre: string; proveedor_telefono: string | null;
}
export interface OrderDraft { local: string; fecha: string; lines: OrderLine[]; }
export const providerKey = (line: OrderLine) => line.proveedor_id === null ? 'none' : `provider:${line.proveedor_id}`;
export const validOrderQuantity = (value: number) => Number.isSafeInteger(value) && value >= 1 && value <= 1000000;
export function createOrderDraft(items: StockItem[], selected: Set<number>, local: string, fecha: string): OrderDraft {
  const lines = items.filter(item => selected.has(item.id)).map(item => ({
    producto_id: item.id, nombre: item.producto, cantidad: Math.max(1, item.stock_minimo - item.stock_actual),
    proveedor_id: item.proveedor_id, proveedor_nombre: item.proveedor_nombre || 'Sin proveedor', proveedor_telefono: item.proveedor_telefono
  }));
  if (!lines.length || lines.some(line => !validOrderQuantity(line.cantidad))) throw new Error('Selecciona productos con una reposición entre 1 y 1000000 unidades por línea.');
  if (items.some(item => selected.has(item.id) && item.local !== local)) throw new Error('El inventario no corresponde al local seleccionado. Vuelve a cargarlo.');
  if (groupOrderLines(lines).some(group => group.lines.length > 500)) throw new Error('Cada pedido admite como máximo 500 líneas. Reduce la selección.');
  return { local, fecha, lines };
}
export function groupOrderLines(lines: OrderLine[]) {
  const groups = new Map<string, { key: string; name: string; lines: OrderLine[] }>();
  for (const line of lines) {
    const key = providerKey(line);
    let group = groups.get(key);
    if (!group) { group = { key, name: line.proveedor_nombre, lines: [] }; groups.set(key, group); }
    group.lines.push(line);
  }
  return [...groups.values()];
}
