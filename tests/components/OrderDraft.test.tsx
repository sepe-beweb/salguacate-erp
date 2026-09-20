import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StockControl from '../../apps/erp-web/src/pages/StockControl';
import { createOrderDraft, groupOrderLines, validOrderQuantity } from '../../apps/erp-web/src/orderDraft';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const product = { id: 1, producto: 'Agua', stock_actual: 2, stock_minimo: 5, local: 'Principal', categoria: 'Bebida', proveedor_id: 1, proveedor_nombre: 'Distribuidor', proveedor_telefono: '600111111' };
const second = { ...product, id: 2, producto: 'Zumo', proveedor_id: 2, proveedor_telefono: '600222222' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const cancel = () => fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async url => response(url.includes('/inventario') ? [product, second] : [])); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
async function open() {
  render(<StockControl />);
  fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar stock bajo' }));
  fireEvent.click(screen.getByRole('button', { name: /Generar Pedido/ }));
}
it('groups homonyms by ID, treats prototype names as text, and separates no supplier from a supplier named Sin proveedor', () => {
  const items = [product, second, { ...product, id: 3, proveedor_id: 3, proveedor_nombre: '__proto__' }, { ...product, id: 4, proveedor_id: null, proveedor_nombre: null }, { ...product, id: 5, proveedor_id: 5, proveedor_nombre: 'Sin proveedor' }];
  const draft = createOrderDraft(items, new Set(items.map(item => item.id)), 'Principal', '2024-02-29');
  const groups = groupOrderLines(draft.lines);
  expect(groups.map(group => group.key)).toEqual(['provider:1', 'provider:2', 'provider:3', 'none', 'provider:5']);
  expect(groups.map(group => group.lines.length)).toEqual([1, 1, 1, 1, 1]);
  expect(groups[2].name).toBe('__proto__');
});
it.each([0, -1, 1.5, 1000001, Number.MAX_SAFE_INTEGER, NaN, Infinity])('rejects order quantity %s', quantity => { expect(validOrderQuantity(quantity)).toBe(false); });
it('accepts boundary quantities, rejects an empty or wrong-local draft and does not silently cap a large minimum', () => {
  expect(validOrderQuantity(1)).toBe(true); expect(validOrderQuantity(1000000)).toBe(true);
  expect(() => createOrderDraft([], new Set(), 'Principal', '2024-02-29')).toThrow();
  expect(() => createOrderDraft([product], new Set([1]), 'Segundo Local', '2024-02-29')).toThrow('local seleccionado');
  expect(() => createOrderDraft([{ ...product, stock_minimo: 1000003 }], new Set([1]), 'Principal', '2024-02-29')).toThrow('1000000');
});
it('enforces 500 lines per supplier rather than for the combined draft', () => {
  const items = Array.from({ length: 501 }, (_, index) => ({ ...product, id: index + 1 }));
  const ids = new Set(items.map(item => item.id));
  expect(() => createOrderDraft(items, ids, 'Principal', '2024-02-29')).toThrow('500');
  items[500].proveedor_id = 2;
  expect(createOrderDraft(items, ids, 'Principal', '2024-02-29').lines).toHaveLength(501);
});
it('retains quantities, date and original local after Escape and a local change', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2024, 1, 29, 23, 59));
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Sumar unidades de Agua' }));
  cancel(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  vi.setSystemTime(new Date(2024, 2, 1, 0, 1));
  fireEvent.click(screen.getByRole('button', { name: 'Salmón', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Retomar pedido de Aguacate' }));
  expect(screen.getByRole('dialog', { name: 'Pedido de Aguacate' })).toBeVisible();
  expect(screen.getByText('Fecha del pedido: 29/02/2024')).toBeVisible();
  expect(within(screen.getByRole('region', { name: 'Distribuidor · proveedor 1' })).getByText('4', { exact: true })).toBeVisible();
});
it('requires explicit discard and refuses replacement when confirmation is cancelled', async () => {
  await open(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador de pedido' })); expect(screen.getByRole('dialog')).toBeVisible();
  cancel(); fireEvent.click(screen.getByRole('button', { name: /Generar Pedido/ })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retomar pedido de Aguacate' }));
  confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador de pedido' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Retomar pedido de Aguacate' })).not.toBeInTheDocument();
});
it('locks a pending registration, preserves a rejected draft and independently records same-name suppliers', async () => {
  let finish!: (value: Response) => void;
  mocks.fetchWithAuth.mockImplementation(async (url, options) => options?.method === 'POST' ? new Promise<Response>(resolve => { finish = resolve; }) : response(url.includes('/inventario') ? [product, second] : []));
  await open();
  const first = within(screen.getByRole('region', { name: 'Distribuidor · proveedor 1' }));
  const other = within(screen.getByRole('region', { name: 'Distribuidor · proveedor 2' }));
  act(() => { first.getByRole('button', { name: 'Registrar pedido en historial' }).click(); first.getByRole('button', { name: 'Registrar pedido en historial' }).click(); });
  cancel(); expect(screen.getByRole('dialog')).toBeVisible(); expect(screen.getByRole('button', { name: 'Cerrar pedido' })).toBeDisabled();
  expect(other.getByRole('button', { name: 'Registrar pedido en historial' })).toBeDisabled();
  expect(first.getByRole('button', { name: 'Sumar unidades de Agua' })).toBeDisabled();
  expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  await act(async () => finish(response({ error: 'No registrado' }, 400)));
  expect(await screen.findByRole('alert')).toHaveTextContent('No registrado');
  expect(first.getByText('3', { exact: true })).toBeVisible();
  fireEvent.click(first.getByRole('button', { name: 'Registrar pedido en historial' }));
  await act(async () => finish(response({ id: 1 })));
  await waitFor(() => expect(other.getByRole('button', { name: 'Registrar pedido en historial' })).toBeEnabled());
  expect(first.getByRole('button', { name: 'Pedido registrado' })).toBeDisabled();
  fireEvent.click(other.getByRole('button', { name: 'Registrar pedido en historial' }));
  await act(async () => finish(response({ id: 2 })));
  const bodies = mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST').map(([, options]) => JSON.parse(options.body));
  expect(bodies.map(body => body.proveedor_id)).toEqual([1, 1, 2]);
  expect(bodies[2].productos).toEqual([{ producto_id: 2, nombre: 'Zumo', cantidad: 3 }]);
});
it('does not repeat a confirmed registration when its subsequent history read fails', async () => {
  let saved = false;
  mocks.fetchWithAuth.mockImplementation(async (url, options) => {
    if (options?.method === 'POST') { saved = true; return response({ id: 1 }); }
    if (saved) return response({ error: 'Lectura pendiente' }, 503);
    return response(url.includes('/inventario') ? [product] : []);
  });
  await open(); fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido en historial' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Lectura pendiente');
  expect(screen.getByRole('button', { name: 'Pedido registrado' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
  expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});
it.each([1, 1000000])('disables the quantity control at boundary %s', async quantity => {
  mocks.fetchWithAuth.mockImplementation(async url => response(url.includes('/inventario') ? [{ ...product, stock_actual: 0, stock_minimo: quantity }] : []));
  await open();
  expect(screen.getByRole('button', { name: `${quantity === 1 ? 'Restar' : 'Sumar'} unidades de Agua` })).toBeDisabled();
});
it('ignores late clipboard confirmation after closing and reopening the draft', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  let finish!: () => void;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(() => new Promise<void>(resolve => { finish = resolve; })) } });
  try {
    await open();
    fireEvent.click(within(screen.getByRole('region', { name: 'Distribuidor · proveedor 1' })).getByRole('button', { name: 'Copiar' }));
    cancel(); fireEvent.click(screen.getByRole('button', { name: 'Retomar pedido de Aguacate' }));
    await act(async () => finish());
    expect(screen.queryByText('Copiado')).not.toBeInTheDocument();
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous); else Reflect.deleteProperty(navigator, 'clipboard');
  }
});
