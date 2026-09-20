import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { groupStockAlerts, readCatalog, readProviders, stockAlerts, stockAlertText } from '../../apps/erp-web/src/catalogData';
import Inventory from '../../apps/erp-web/src/pages/Inventory';
import Providers from '../../apps/erp-web/src/pages/Providers';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const product = { id: 1, producto: 'Agua', stock_actual: 2, stock_minimo: 5, local: 'Principal', categoria: null, proveedor_id: null, proveedor_nombre: null, proveedor_telefono: null, imagen_url: null };
const provider = { id: 1, nombre: 'Distribuidor', telefono: null, email: null, categoria: null };
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async url => response(url.includes('/inventario') ? [product] : [provider])); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each([{ id: '1' }, { id: 0 }, { nombre: '' }, { nombre: {} }, { telefono: 42 }, { email: [] }, { categoria: false }])('rejects invalid supplier fields %j', async change => {
  await expect(readProviders(response([{ ...provider, ...change }]))).rejects.toThrow('proveedores contiene datos inválidos');
});
it('accepts nullable contact fields and homonyms but rejects duplicate IDs', async () => {
  expect(await readProviders(response([provider, { ...provider, id: 2 }]))).toHaveLength(2);
  await expect(readProviders(response([provider, provider]))).rejects.toThrow();
});
it.each(['https://example.invalid/product.png', '//example.invalid/p.png', '/uploads/../p.png', '/uploads/%2e%2e/p.png', '/uploads/p.svg', '/uploads/p.png?redirect=1', '/uploads/p.png\n', 123])('rejects unsupported or external image reference %j', async imagen_url => {
  await expect(readCatalog(response([{ ...product, imagen_url }]))).rejects.toThrow('imagen inválida');
});
it.each([null, '/uploads/older_product-123.jpeg', '/uploads/550e8400-e29b-41d4-a716-446655440000.png'])('accepts a missing or local raster image %s', async imagen_url => {
  expect((await readCatalog(response([{ ...product, imagen_url }])))[0].imagen_url).toBe(imagen_url);
});
it('derives alerts including equality from the same catalogue snapshot and groups by supplier ID and local', () => {
  const items = [
    { ...product, proveedor_id: 1, proveedor_nombre: '__proto__' },
    { ...product, id: 2, proveedor_id: 2, proveedor_nombre: '__proto__', stock_actual: 5 },
    { ...product, id: 3, proveedor_id: 1, proveedor_nombre: '__proto__', local: 'Segundo Local' },
    { ...product, id: 4, stock_actual: 6 },
    { ...product, id: 5, stock_actual: 0, stock_minimo: 0 }
  ];
  const alerts = stockAlerts(items); expect(alerts.map(item => item.id)).toEqual([1, 2, 3, 5]);
  const groups = groupStockAlerts(alerts); expect(groups).toHaveLength(4);
  expect(groups[1].providerId).toBe(2); expect(groups[2].local).toBe('Segundo Local');
  const text = stockAlertText('__proto__', 'Principal', [items[1]]);
  expect(text).toContain('5 en stock; mínimo 5; hasta el mínimo: 0'); expect(text).toContain('No registra un pedido');
});
it('renders only the configured Cloudinary account without prefixing the API or sending a referrer', async () => {
  vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'synthetic-cloud');
  const url = 'https://res.cloudinary.com/synthetic-cloud/image/upload/v123/salguacate/inventory/12345678-1234-4123-8123-123456789abc.png';
  mocks.fetchWithAuth.mockImplementation(async endpoint => response(endpoint.includes('/inventario') ? [{ ...product, imagen_url: url }] : []));
  render(<Inventory />);
  const image = await screen.findByRole('img', { name: 'Agua' });
  expect(image).toHaveAttribute('src', url); expect(image).toHaveAttribute('referrerPolicy', 'no-referrer');
});
it('does not classify a missing category as a drink and does not query a second alerts snapshot', async () => {
  render(<Inventory />); await screen.findByRole('heading', { name: 'Agua' });
  expect(screen.getByText('Sin categoría')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Bebidas', exact: true }));
  expect(screen.queryByRole('heading', { name: 'Agua' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Alertas de Stock/ }));
  expect(screen.getByText('Hasta el mínimo: 3 (Min: 5)')).toBeVisible();
  expect(mocks.fetchWithAuth.mock.calls.some(([url]) => url.includes('/inventario/alertas'))).toBe(false);
});
it('blocks both catalogue and alerts if the supplier list is invalid and recovers through GET only', async () => {
  let valid = false;
  mocks.fetchWithAuth.mockImplementation(async url => response(url.includes('/inventario') ? [product] : [{ ...provider, nombre: valid ? 'Distribuidor' : {} }]));
  render(<Inventory />);
  expect(await screen.findByRole('alert')).toHaveTextContent('proveedores contiene datos inválidos');
  expect(screen.queryByRole('button', { name: 'Sumar stock de Agua' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Alertas de Stock/ }));
  expect(screen.queryByText('Todo en orden')).not.toBeInTheDocument();
  valid = true; fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
  expect(await screen.findByRole('button', { name: 'Copiar lista de alertas' })).toBeVisible();
  expect(mocks.fetchWithAuth.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
it('supplier cards label absent category and expose no invented contact links', async () => {
  render(<Providers />); expect(await screen.findByText('Sin categoría')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('locks same-tick stock changes and blocks decrement at zero and unsafe increment', async () => {
  let finish!: (response: Response) => void;
  mocks.fetchWithAuth.mockImplementation(async (url, options) => options?.method === 'PUT' ? new Promise<Response>(resolve => { finish = resolve; }) : response(url.includes('/inventario') ? [product, { ...product, id: 2, producto: 'Vacío', stock_actual: 0 }, { ...product, id: 3, producto: 'Límite', stock_actual: Number.MAX_SAFE_INTEGER }] : []));
  render(<Inventory />); const add = await screen.findByRole('button', { name: 'Sumar stock de Agua' });
  expect(screen.getByRole('button', { name: 'Restar stock de Vacío' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sumar stock de Límite' })).toBeDisabled();
  act(() => { add.click(); add.click(); });
  expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  await act(async () => finish(response({ error: 'No actualizado' }, 409)));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Sumar stock de Agua' })).toBeEnabled());
});
it('copies an informational minimum alert without registering or opening an external app', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const copy = vi.fn().mockResolvedValue(undefined); const open = vi.spyOn(window, 'open').mockReturnValue(null);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  try {
    render(<Inventory />); fireEvent.click(await screen.findByRole('button', { name: /Alertas de Stock/ }));
    fireEvent.click(within(screen.getByRole('region')).getByRole('button', { name: 'Copiar lista de alertas' }));
    expect(await screen.findByRole('status')).toHaveTextContent('No se ha registrado un pedido ni enviado un mensaje');
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('Aguacate'));
    expect(open).not.toHaveBeenCalled(); expect(mocks.fetchWithAuth.mock.calls.every(([, options]) => !options?.method)).toBe(true);
  } finally { if (previous) Object.defineProperty(navigator, 'clipboard', previous); else Reflect.deleteProperty(navigator, 'clipboard'); }
});
