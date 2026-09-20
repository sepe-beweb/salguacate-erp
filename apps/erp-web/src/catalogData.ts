import { locationLabel } from './locations';
import { readList } from './apiResponse';
import { readStock, type StockItem } from './stockData';

export interface CatalogItem extends StockItem { imagen_url: string | null; }
export interface Provider { id: number; nombre: string; telefono: string | null; email: string | null; categoria: string | null; }
const nullableText = (value: unknown) => value === null || typeof value === 'string';
export function validCatalogImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() !== value) return false;
  if (/^\/uploads\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g)$/i.test(value)) return true;
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  if (typeof cloud !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(cloud)) return false;
  return new RegExp(`^https://res\\.cloudinary\\.com/${cloud}/image/upload/v[1-9]\\d*/salguacate/inventory/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\\.(png|jpe?g)$`).test(value);
}
export function catalogImageSource(value: string, apiUrl: string): string {
  if (!validCatalogImageUrl(value)) throw new Error('Referencia de imagen no permitida.');
  return value.startsWith('/uploads/') ? `${apiUrl}${value}` : value;
}
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
    if (item.imagen_url !== null && !validCatalogImageUrl(item.imagen_url)) throw new Error('El catálogo contiene una ruta de imagen inválida. Solo se permite almacenamiento local o la cuenta Cloudinary configurada.');
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
  return `Alertas de stock — Salguacate — ${locationLabel(local)}\nProveedor: ${name}\n\n` + items.map(item =>
    `• ${item.producto}: ${item.stock_actual} en stock; mínimo ${item.stock_minimo}; hasta el mínimo: ${Math.max(0, item.stock_minimo - item.stock_actual)}.`
  ).join('\n') + '\n\nLista informativa. No registra un pedido ni confirma un envío.';
}
