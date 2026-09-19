import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Expenses from '../../apps/erp-web/src/pages/Expenses';
import Scanner from '../../apps/erp-web/src/pages/Scanner';
import { createPendingCreates } from '../../apps/erp-web/src/pendingCreates';
import { emptyExpense, expenseDate, readExpenses } from '../../apps/erp-web/src/expenses';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '1', role: 'owner' } }));
let pendingCreates: ReturnType<typeof createPendingCreates>;
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => ({ ...mocks, pendingCreates }) }));
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const row = { ...emptyExpense(), id: 10, proveedor_nombre: 'Proveedor uno', total: 0.10, concepto: 'Café' };
const mount = () => render(<MemoryRouter><Expenses /></MemoryRouter>);
const writes = () => mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST');
const fill = () => {
  fireEvent.change(screen.getByLabelText('Proveedor', { exact: true }), { target: { value: 'Proveedor manual' } });
  fireEvent.change(screen.getByLabelText('Importe (€)'), { target: { value: '12.50' } });
};
beforeEach(() => { pendingCreates = createPendingCreates(); mocks.fetchWithAuth.mockReset(); });
afterEach(() => vi.restoreAllMocks());

describe('Manual expense registration and read-only reconciliation', () => {
  it('filters by month, local and text and sums integer cents without writes', async () => {
    mocks.fetchWithAuth.mockImplementation(async () => response([row, { ...row, id: 11, total: 0.20, local: 'Segundo Local', proveedor_nombre: 'Proveedor dos' }, { ...row, id: 12, fecha: '2020-01-01', total: 4 }]));
    mount();
    const summary = await screen.findByLabelText('Resumen de gastos');
    expect(summary).toHaveTextContent('2 registros');
    expect(summary.textContent).toContain('0,30');
    fireEvent.change(screen.getByLabelText('Local de consulta'), { target: { value: 'Segundo Local' } });
    expect(summary).toHaveTextContent('1 registro');
    expect(screen.queryByRole('heading', { name: /Gasto n.º 10/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos los gastos' }));
    expect(summary).toHaveTextContent('3 registros');
    fireEvent.change(screen.getByLabelText('Buscar proveedor, concepto o número'), { target: { value: '12' } });
    expect(screen.getByRole('heading', { name: /Gasto n.º 12/ })).toBeVisible();
    expect(summary.textContent).toContain('4,00');
    fireEvent.change(screen.getByLabelText('Buscar proveedor, concepto o número'), { target: { value: 'inexistente' } });
    expect(screen.getByText('No hay gastos que coincidan con los filtros.')).toBeVisible();
    expect(writes()).toHaveLength(0);
    expect(expenseDate('2020-01-01')).toBe('01/01/2020');
  });

  it('does not replace a failed load with zero expenses and preserves a new form on retry', async () => {
    mocks.fetchWithAuth.mockResolvedValueOnce(response({ error: 'Lectura fallida' }, 503)).mockResolvedValueOnce(response([]));
    mount(); fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Lectura fallida');
    expect(screen.queryByLabelText('Resumen de gastos')).not.toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay gastos registrados.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await screen.findByText('Todavía no hay gastos registrados.');
    expect(screen.getByLabelText('Proveedor', { exact: true })).toHaveValue('Proveedor manual');
    expect(writes()).toHaveLength(0);
  });

  it.each([[{ ...row, total: '12' }], [{ ...row, total: 1.001 }], [{ ...row, fecha: '2026-02-30' }], [row, row], [null]].map(rows => ({ rows })))('rejects malformed expense rows without partial totals', async ({ rows }) => {
    await expect(readExpenses([response(rows)])).rejects.toThrow('datos inválidos');
  });

  it('confirms an expense once even if refreshing the list then fails', async () => {
    let saved = false;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => {
      if (options?.method === 'POST') { saved = true; return response({ id: 24 }, 201); }
      return saved ? response({ error: 'Lista temporalmente no disponible' }, 503) : response([]);
    });
    mount(); await screen.findByLabelText('Resumen de gastos'); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto', exact: true }));
    expect(await screen.findByText('Gasto registrado correctamente (n.º 24).')).toBeVisible();
    await screen.findByText('Lista temporalmente no disponible');
    expect(screen.getByLabelText('Proveedor', { exact: true })).toHaveValue('');
    expect(pendingCreates.get('/api/gastos')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await waitFor(() => expect(mocks.fetchWithAuth.mock.calls.length).toBeGreaterThanOrEqual(4));
    expect(writes()).toHaveLength(1);
  });

  it('recovers an unresolved scanner expense and confirms the exact body without analysing anything', async () => {
    const payload = { ...emptyExpense(), proveedor_nombre: 'Escaneado', total: '8.20', concepto: 'Revisado' };
    const first = vi.fn().mockRejectedValue(new Error('Perdida'));
    await expect(pendingCreates.submit('/api/gastos', payload, first)).rejects.toThrow();
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ id: 8 }) : response([]));
    mount();
    expect(screen.getByLabelText('Proveedor', { exact: true })).toHaveValue('Escaneado');
    expect(screen.getByLabelText('Proveedor', { exact: true })).toBeDisabled();
    expect(writes()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar guardado pendiente' }));
    await screen.findByText('Gasto registrado correctamente (n.º 8).');
    expect(writes()).toHaveLength(1);
    expect(writes()[0][1]).toEqual(first.mock.calls[0][0]);
    expect(mocks.fetchWithAuth.mock.calls.every(([url]) => url.endsWith('/api/gastos'))).toBe(true);
  });

  it('shares a failed manual attempt with the scanner without starting another create', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ error: 'Sin confirmación' }, 500) : response([]));
    const view = mount(); await screen.findByLabelText('Resumen de gastos'); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto', exact: true }));
    await screen.findByRole('alert'); view.unmount();
    render(<Scanner />);
    expect(screen.getByLabelText('Proveedor', { exact: true })).toHaveValue('Proveedor manual');
    expect(screen.getByLabelText('Total Detectado (€)')).toHaveValue(12.5);
    expect(screen.getByLabelText('Proveedor', { exact: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirmar guardado pendiente' })).toBeEnabled();
    expect(writes()).toHaveLength(1);
  });

  it('keeps the reviewed payload after cancelling discard and permits correction only after a definitive 400', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ error: 'Proveedor inválido' }, 400) : response([]));
    mount(); await screen.findByLabelText('Resumen de gastos'); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto', exact: true }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Proveedor', { exact: true })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Proveedor', { exact: true }), { target: { value: 'Corregido' } });
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ error: 'Resultado desconocido' }, 500) : response([]));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto', exact: true }));
    await screen.findByText('Resultado desconocido');
    expect(writes()[0][1].headers['Idempotency-Key']).not.toEqual(writes()[1][1].headers['Idempotency-Key']);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar intento pendiente' }));
    expect(screen.getByLabelText('Proveedor', { exact: true })).toHaveValue('Corregido');
    expect(screen.getByLabelText('Proveedor', { exact: true })).toBeDisabled();
  });

  it('blocks repeated submit and discard while a manual creation is in flight', async () => {
    let finish!: (r: Response) => void;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? new Promise<Response>(resolve => { finish = resolve; }) : response([]));
    mount(); await screen.findByLabelText('Resumen de gastos'); fill();
    const form = screen.getByRole('form', { name: 'Alta de gasto' });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(within(form).getByRole('button', { name: 'Registrando...' })).toBeDisabled();
    expect(within(form).getByRole('button', { name: 'Descartar intento pendiente' })).toBeDisabled();
    expect(writes()).toHaveLength(1);
    await act(async () => { finish(response({ id: 4 })); });
    await screen.findByText('Gasto registrado correctamente (n.º 4).');
  });
});
