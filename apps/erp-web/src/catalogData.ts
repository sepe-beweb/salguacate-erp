import { readList } from './apiResponse';
import { readStock, type StockItem } from './stockData';

export interface CatalogItem extends StockItem { imagen_url: string | null; }
export interface Provider { id: number; nombre: string; telefono: string | null; email: string | null; categoria: string | null; }
const nullableText = (value: unknown) => value === null || typeof value === 'string';
export async function readProviders(response: Response): Promise<Provider[]> {
  const providers = await readList<Provider>(response); const ids = new Set<number>();
  for (const provider of providers) {
    if (!provider || !Number.isSafeInteger(provider.id) || provider.id < 1 || ids.has(provider.id) || typeof provider.nombre !== 'string' || !provider.nombre.trim() ||
      !nullableText(provider.telefono) || !nullableText(provider.email) || !nullableText(provider.categoria)) throw new Error('La lista de proveedores contiene datos inválidos. No se muestra una agenda parcial.');
    ids.add(provider.id);
  }
  return providers;
}
export async function readCatalog(response: Response): Promise<CatalogItem[]> {
  const items = await readStock(response) as CatalogItem[];
  for (const item of items) {
    if (item.imagen_url !== null && (typeof item.imagen_url !== 'string' || item.imagen_url.trim() !== item.imagen_url || !/^\/uploads\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g)$/i.test(item.imagen_url))) throw new Error('El catálogo contiene una ruta de imagen inválida. No se cargan imágenes externas ni una lista parcial.');
  }
  return items;
}
export async function readInventoryWorkspace(responses: Response[]): Promise<[CatalogItem[], Provider[]]> {
  return Promise.all([readCatalog(responses[0]), readProviders(responses[1])]);
}
export function stockAlerts(items: CatalogItem[]) { return items.filter(item => item.stock_actual <= item.stock_minimo); }
export function groupStockAlerts(items: CatalogItem[]) {
  const groups = new Map<string, { key: string; name: string; local: string; providerId: number | null; items: CatalogItem[] }>();
  for (const item of items) {
    const key = JSON.stringify([item.proveedor_id, item.local]);
    let group = groups.get(key);
    if (!group) { group = { key, name: item.proveedor_nombre || 'Sin proveedor asignado', local: item.local, providerId: item.proveedor_id, items: [] }; groups.set(key, group); }
    group.items.push(item);
  }
  return [...groups.values()];
}
export function stockAlertText(name: string, local: string, items: CatalogItem[]) {
  return `Alertas de stock — Salguacate — ${local}\nProveedor: ${name}\n\n` + items.map(item =>
    `• ${item.producto}: ${item.stock_actual} en stock; mínimo ${item.stock_minimo}; hasta el mínimo: ${Math.max(0, item.stock_minimo - item.stock_actual)}.`
  ).join('\n') + '\n\nLista informativa. No registra un pedido ni confirma un envío.';
}
