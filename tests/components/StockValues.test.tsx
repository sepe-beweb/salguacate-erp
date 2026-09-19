import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { readOrders, readStock, readStockWorkspace } from '../../apps/erp-web/src/stockData';
import StockControl from '../../apps/erp-web/src/pages/StockControl';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown) => new Response(JSON.stringify(body));
const product = { id: 1, producto: 'Agua', stock_actual: 2, stock_minimo: 5, local: 'Principal', categoria: null, proveedor_id: null, proveedor_nombre: null, proveedor_telefono: null };
const line = { producto_id: 1, nombre: 'Agua', cantidad: 3 };
const order = { id: 1, fecha: '2024-02-29', local: 'Segundo Local', proveedor_id: null, proveedor_nombre: 'Distribuidor', productos: JSON.stringify([line]), estado: 'pendiente' };
beforeEach(() => { mocks.fetchWithAuth.mockReset(); });

it.each([
  { id: '1' }, { producto: ' ' }, { stock_actual: -1 }, { stock_actual: '2' }, { stock_actual: 1.2 },
  { stock_actual: Number.MAX_SAFE_INTEGER + 1 }, { stock_minimo: null }, { local: null }, { categoria: {} }, { proveedor_id: 0 }, { proveedor_nombre: 2 }, { proveedor_telefono: [] }
])('rejects unsafe stock fields %j', async change => {
  await expect(readStock(response([{ ...product, ...change }]))).rejects.toThrow('stock contiene datos inválidos');
});
it('keeps large accumulated stock and nullable category without inventing a category', async () => {
  const item = { ...product, stock_actual: 2000001 };
  expect(await readStock(response([item]))).toEqual([item]);
});
it('rejects duplicate inventory IDs', async () => {
  await expect(readStock(response([product, product]))).rejects.toThrow();
});
it.each([
  { id: '1' }, { fecha: '2023-02-29' }, { fecha: '2024-02-29T00:00:00Z' }, { local: 'Desconocido' },
  { proveedor_id: '2' }, { proveedor_nombre: null }, { estado: 'cancelado' }, { estado: ['recibido'] },
  { productos: '{' }, { productos: '{}' }, { productos: '[]' }, { productos: [line] },
  { productos: JSON.stringify([null]) }, { productos: JSON.stringify([{ ...line, producto_id: '1' }]) },
  { productos: JSON.stringify([{ ...line, cantidad: 0 }]) }, { productos: JSON.stringify([{ ...line, cantidad: 1.5 }]) },
  { productos: JSON.stringify([{ ...line, cantidad: 1000001 }]) }, { productos: JSON.stringify([{ ...line, nombre: '' }]) },
  { productos: JSON.stringify(Array(501).fill(line)) }
])('rejects malformed order fields %j', async change => {
  await expect(readOrders(response([{ ...order, ...change }]))).rejects.toThrow('historial contiene pedidos inválidos');
});
it('orders history by civil date then ID, preserves repeated lines and does not require current inventory joins', async () => {
  const old = { ...order, id: 3, fecha: '2024-02-28' };
  const latest = { ...order, id: 2, productos: JSON.stringify([line, line]) };
  const [stock, orders] = await readStockWorkspace([response([]), response([old, order, latest])]);
  expect(stock).toEqual([]); expect(orders.map(item => item.id)).toEqual([2, 1, 3]);
  expect(orders[0].productos).toEqual([line, line]);
});
it('rejects duplicate order IDs even when individual orders are valid', async () => {
  await expect(readOrders(response([order, order]))).rejects.toThrow();
});
it('does not expose stock or receipt controls when order data is invalid; retry only rereads', async () => {
  let corrupt = true;
  mocks.fetchWithAuth.mockImplementation(async url => response(url.includes('/inventario') ? [product] : [{ ...order, estado: corrupt ? 'desconocido' : 'pendiente' }]));
  render(<StockControl />);
  expect(await screen.findByRole('alert')).toHaveTextContent('historial contiene pedidos inválidos');
  expect(screen.queryByRole('button', { name: /Agua/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
  expect(screen.queryByRole('button', { name: '✓ Recibir' })).not.toBeInTheDocument();
  expect(screen.queryByText('✓ Recibido')).not.toBeInTheDocument();
  corrupt = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
  expect(await screen.findByText('Segundo Local · 29/02/2024')).toBeVisible();
  expect(screen.getByText('Agua ×3')).toBeVisible();
  expect(screen.getByRole('button', { name: '✓ Recibir' })).toBeEnabled();
  expect(mocks.fetchWithAuth.mock.calls.every(([, options]) => !options.method)).toBe(true);
});
it('labels missing categories and exposes selection state', async () => {
  mocks.fetchWithAuth.mockImplementation(async url => response(url.includes('/inventario') ? [product] : []));
  render(<StockControl />);
  const row = await screen.findByRole('button', { name: /Agua/ });
  expect(row).toHaveTextContent('Sin categoría'); expect(row).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(row); expect(row).toHaveAttribute('aria-pressed', 'true');
});
