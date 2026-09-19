import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Inventory from '../../apps/erp-web/src/pages/Inventory';
import Providers from '../../apps/erp-web/src/pages/Providers';
import Sales from '../../apps/erp-web/src/pages/Sales';
import StockControl from '../../apps/erp-web/src/pages/StockControl';
import ManagerCalendar from '../../apps/erp-web/src/pages/ManagerCalendar';
import Dashboard from '../../apps/erp-web/src/pages/Dashboard';
import Analytics from '../../apps/erp-web/src/pages/Analytics';
import Reports from '../../apps/erp-web/src/pages/Reports';
import { useApiLists } from '../../apps/erp-web/src/hooks/useApiLists';
import { localDate } from '../../apps/erp-web/src/localDate';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '1', name: 'Propietario', role: 'owner' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const product = { id: 1, producto: 'Agua', stock_actual: 2, stock_minimo: 5, local: 'Principal' };
const order = { id: 1, fecha: '2026-09-19', local: 'Principal', proveedor_nombre: 'Distribuidor', productos: '[]', estado: 'pendiente' };
const dialogMethods = Object.fromEntries(['showModal', 'close'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]));
beforeAll(() => {
  // jsdom has no native modal implementation. Real focus/cancel behavior is covered in browser tests.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function () { this.setAttribute('open', ''); } },
    close: { configurable: true, value: function () { this.removeAttribute('open'); } }
  });
});
afterAll(() => {
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
beforeEach(() => {
  mocks.fetchWithAuth.mockReset().mockImplementation(async () => response([]));
});
afterEach(() => vi.restoreAllMocks());

describe('Management loading and mutation recovery', () => {
  it.each([
    ['catalogue', Inventory], ['providers', Providers], ['cash', Sales], ['orders', StockControl],
    ['agenda', ManagerCalendar], ['dashboard', Dashboard], ['analytics', Analytics], ['reports', Reports]
  ] as const)('%s displays failed loads, not empty data, and can retry GET', async (_name, Component) => {
    mocks.fetchWithAuth.mockImplementation(async () => response({ error: 'Servicio no disponible' }, 503));
    render(<MemoryRouter><Component /></MemoryRouter>);
    if (Component === Sales) fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible');
    expect(screen.queryByText(/Todo en orden|Agenda Libre|No hay proveedores|No hay datos suficientes|Sin pedidos registrados/)).not.toBeInTheDocument();
    expect(screen.queryByText('€0.00')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Exportar Informe/ })).not.toBeInTheDocument();
    mocks.fetchWithAuth.mockImplementation(async () => response([]));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it.each([
    ['product', Inventory, 'Nuevo producto', 'Nombre del Producto', 'Guardar Producto'],
    ['provider', Providers, 'Nuevo proveedor', 'Nombre / Empresa', 'Guardar Proveedor'],
    ['event', ManagerCalendar, 'Nuevo', 'Título', 'Guardar Evento']
  ] as const)('preserves the %s editor and submitted fields on rejection', async (_name, Component, open, label, save) => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({ error: 'Datos rechazados' }, 400) : response([]));
    render(<Component />);
    fireEvent.click(await screen.findByRole('button', { name: open, exact: true }));
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value: 'Borrador completo' } });
    fireEvent.click(screen.getByRole('button', { name: save }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Datos rechazados');
    expect(screen.getByLabelText(label)).toHaveValue('Borrador completo');
    expect(screen.getByRole('button', { name: save })).toBeEnabled();
  });

  it('retains all closing amounts, date and local after a duplicate closing', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({ error: 'Ya existe un cierre' }, 409) : response([]));
    render(<Sales />);
    const fields = { 'Fecha del Cierre': '2026-10-03', Local: 'Segundo Local', 'Total Efectivo': '31.25', 'Total Tarjeta': '20.50', 'Invitaciones (Valor)': '2.25', 'Descuadre de Caja': '-1.75' };
    for (const [label, value] of Object.entries(fields)) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cierre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un cierre');
    for (const [label, value] of Object.entries(fields)) expect(screen.getByLabelText(label)).toHaveValue(label === 'Local' || label === 'Fecha del Cierre' ? value : Number(value));
  });

  it('does not optimistically change stock and locks another adjustment while pending', async () => {
    let finish!: (response: Response) => void;
    mocks.fetchWithAuth.mockImplementation(async (url, options) => options?.method === 'PUT' ? new Promise<Response>(resolve => { finish = resolve; }) : response(url.endsWith('/api/inventario') ? [product] : []));
    render(<Inventory />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sumar stock de Agua' }));
    expect(screen.getByRole('button', { name: 'Sumar stock de Agua' })).toBeDisabled();
    expect(screen.getByText('2', { exact: true })).toBeInTheDocument();
    await act(async () => finish(response({ error: 'Stock no actualizado' }, 500)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stock no actualizado');
    expect(await screen.findByText('2', { exact: true })).toBeInTheDocument();
    expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  });

  it('cancelling receipt makes no request', async () => {
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/api/pedidos') ? [order] : []));
    render(<StockControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    fireEvent.click(await screen.findByRole('button', { name: '✓ Recibir', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar', exact: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.fetchWithAuth.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
  });

  it('opening WhatsApp formats the phone but never registers the order automatically', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mocks.fetchWithAuth.mockImplementation(async url => response(url.includes('/api/inventario') ? [{ ...product, proveedor_nombre: 'Distribuidor', proveedor_telefono: '+34 600 123 456' }] : []));
    render(<StockControl />);
    fireEvent.click(await screen.findByRole('button', { name: /Agua/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar Pedido/ }));
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp', exact: true }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/34600123456?text='), '_blank', 'noopener,noreferrer');
    expect(mocks.fetchWithAuth.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    expect(screen.getByRole('button', { name: 'Registrar pedido en historial' })).toBeEnabled();
  });

  it('does not claim clipboard success when access is denied', async () => {
    const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Portapapeles bloqueado')) } });
    try {
      mocks.fetchWithAuth.mockImplementation(async url => response(url.includes('/api/inventario') ? [product] : []));
      render(<StockControl />);
      fireEvent.click(await screen.findByRole('button', { name: /Agua/ }));
      fireEvent.click(screen.getByRole('button', { name: /Generar Pedido/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Copiar', exact: true }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Portapapeles bloqueado');
      expect(screen.queryByText('Copiado', { exact: true })).not.toBeInTheDocument();
    } finally {
      if (previous) Object.defineProperty(navigator, 'clipboard', previous);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it.each([true, false])('requires explicit stock choice %s and keeps failed receipt open', async (sumStock) => {
    mocks.fetchWithAuth.mockImplementation(async (url, options) => options?.method === 'PATCH' ? response({ error: 'Recepción rechazada' }, 409) : response(url.endsWith('/api/pedidos') ? [order] : []));
    render(<StockControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    fireEvent.click(await screen.findByRole('button', { name: '✓ Recibir', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: sumStock ? 'Recibir y sumar stock' : 'Recibir sin cambiar stock' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Recepción rechazada');
    expect(screen.getByRole('dialog')).toBeVisible();
    const request = mocks.fetchWithAuth.mock.calls.find(([, options]) => options?.method === 'PATCH');
    expect(JSON.parse(request![1].body)).toEqual({ sumar_stock: sumStock });
  });
});

describe('Load ordering and civil dates', () => {
  it('ignores a late response for the previous local even if transport ignores abort', async () => {
    const finish = new Map<string, (response: Response) => void>();
    mocks.fetchWithAuth.mockImplementation(url => new Promise<Response>(resolve => finish.set(url, resolve)));
    const { result, rerender } = renderHook(({ local }) => useApiLists<[string]>([`/api/inventario?local=${local}`]), { initialProps: { local: 'Principal' } });
    const oldUrl = mocks.fetchWithAuth.mock.calls[0][0];
    const oldSignal = mocks.fetchWithAuth.mock.calls[0][1].signal;
    const previousReload = result.current.reload;
    rerender({ local: 'Segundo' });
    expect(oldSignal.aborted).toBe(true);
    const newUrl = mocks.fetchWithAuth.mock.calls[1][0];
    await act(async () => finish.get(newUrl)!(response(['Segundo'])));
    expect(result.current.data).toEqual([['Segundo']]);
    await act(async () => finish.get(oldUrl)!(response(['Principal'])));
    expect(result.current.data).toEqual([['Segundo']]);
    await act(async () => previousReload());
    expect(mocks.fetchWithAuth).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual([['Segundo']]);
  });
  it('does not expose a partially successful set of lists', async () => {
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/good') ? [{ total: 500 }] : { error: 'Gastos pendientes' }, url.endsWith('/good') ? 200 : 503));
    const { result } = renderHook(() => useApiLists<[unknown, unknown]>(['/good', '/bad']));
    await waitFor(() => expect(result.current.error).toBe('Gastos pendientes'));
    expect(result.current.data).toBeNull();
  });
  it('formats the local civil date, including month boundaries', () => {
    expect(localDate(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01');
    expect(localDate(new Date(2026, 2, 31, 23, 45))).toBe('2026-03-31');
  });
});
