import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closingPreview, emptyClosing } from '../../apps/erp-web/src/closingDraft';
import { closingHistory, readCashClosings, type CashClosing } from '../../apps/erp-web/src/financialData';
import { dashboardFinancialSummary } from '../../apps/erp-web/src/dashboardData';
import Dashboard from '../../apps/erp-web/src/pages/Dashboard';
import Sales from '../../apps/erp-web/src/pages/Sales';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { name: 'Propietario' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const closing: CashClosing = { id: 1, fecha: '2026-01-01', local: 'Principal', efectivo: 0.1, tarjeta: 0.2, total: 0.3, invitaciones: 2, descuadre: -0.01 };
const expense = { id: 1, fecha: closing.fecha, local: 'Principal', total: 0.05, proveedor_nombre: 'Proveedor', concepto: 'Prueba' };
const draft = { fecha: '2024-02-29', local: 'Principal', efectivo: '0.10', tarjeta: '0.20', invitaciones: '2.00', descuadre: '-0.01' };
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async () => response([])); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function fillDraft() {
  for (const [label, value] of [['Fecha del Cierre', draft.fecha], ['Total Efectivo', draft.efectivo], ['Total Tarjeta', draft.tarjeta], ['Invitaciones (Valor)', draft.invitaciones], ['Descuadre de Caja', draft.descuadre]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('Closing values and monthly dashboard', () => {
  it('orders history by civil date then id on a copy, including the selected local', () => {
    const rows = [closing, { ...closing, id: 3, local: 'Segundo Local' }, { ...closing, id: 2, fecha: '2025-12-31' }];
    expect(closingHistory(rows).map(row => row.id)).toEqual([3, 1, 2]);
    expect(closingHistory(rows, 'Principal').map(row => row.id)).toEqual([1, 2]);
    expect(rows.map(row => row.id)).toEqual([1, 3, 2]);
  });
  it('compares January with December, excludes other years and retains the recorded latest total', () => {
    const historic = { ...closing, id: 9, local: 'Segundo Local', total: 5 };
    const rows = [{ ...closing, id: 2, fecha: '2025-12-31' }, closing, { ...closing, id: 3, fecha: '2025-01-01' }, historic];
    expect(dashboardFinancialSummary([rows, [expense]], '2026-01-15')).toMatchObject({ income: 530, expenses: 5, balance: 525, previousIncome: 30, closingCount: 2, latest: historic, inconsistentHistory: true });
  });
  it('handles empty history and expense-only months without fictitious last closing', () => {
    expect(dashboardFinancialSummary([[], [expense]], '2026-01-01')).toMatchObject({ income: 0, balance: -5, latest: null, closingCount: 0 });
    expect(() => dashboardFinancialSummary([[], []], '2026-02-30')).toThrow();
  });
  it('rejects malformed and overflowing history before display', async () => {
    await expect(readCashClosings([response([{ ...closing, total: '0.30' }])])).rejects.toThrow();
    const large = { ...closing, efectivo: 50000000000000, tarjeta: 0, total: 50000000000000 };
    await expect(readCashClosings([response([large, { ...large, id: 2 }])])).rejects.toThrow('rango seguro');
  });
  it('previews only cash and card, with optional fields blank and API maximum amounts', () => {
    expect(closingPreview(draft)).toEqual({ valid: true, total: 30 });
    expect(closingPreview({ ...draft, invitaciones: '', descuadre: '', efectivo: '1000000', tarjeta: '1000000' })).toEqual({ valid: true, total: 200000000 });
    expect(closingPreview(emptyClosing()).valid).toBe(false);
  });
  it.each([
    { efectivo: '' }, { efectivo: '-0.01' }, { tarjeta: '0.001' }, { tarjeta: '1e2' }, { invitaciones: '-1' },
    { descuadre: '-1000000.01' }, { efectivo: '1000000.01' }, { tarjeta: '0,20' }, { efectivo: 'Infinity' },
    { fecha: '2025-02-29' }, { local: 'Otro' }
  ])('rejects an invalid draft without rounding it: %j', fields => {
    expect(closingPreview({ ...draft, ...fields }).valid).toBe(false);
  });
});

describe('Closing editor and history', () => {
  it('shows exact preview, preserves strings on rejection and never sends a client total', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({ error: 'Ya existe un cierre' }, 409) : response([]));
    render(<Sales />); fillDraft();
    expect(screen.getByLabelText('Total previsto del cierre')).toHaveTextContent('0,30 €');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cierre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un cierre');
    expect(screen.getByLabelText('Descuadre de Caja')).toHaveValue(-0.01);
    expect(screen.getByLabelText('Fecha del Cierre')).toHaveValue(draft.fecha);
    const calls = mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(calls).toHaveLength(1); expect(JSON.parse(calls[0][1].body)).toEqual(draft);
  });
  it('blocks invalid values even if native form validation is bypassed', async () => {
    render(<Sales />); fillDraft();
    fireEvent.change(screen.getByLabelText('Total Efectivo'), { target: { value: '0.001' } });
    fireEvent.submit(screen.getByLabelText('Total Efectivo').closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('dos decimales');
    expect(mocks.fetchWithAuth.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    expect(screen.getByLabelText('Total Efectivo')).toHaveValue(0.001);
  });
  it('keeps a pending POST locked and does not retry when the post-save GET fails', async () => {
    let finish!: (value: Response) => void;
    let saved = false;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? new Promise<Response>(resolve => { finish = resolve; }) : saved ? response({ error: 'Historial no disponible' }, 503) : response([]));
    render(<Sales />); fillDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cierre' }));
    expect(screen.getByLabelText('Total Efectivo')).toBeDisabled();
    saved = true; await act(async () => finish(response({ id: 2 }, 201)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Historial no disponible');
    expect(screen.getByText('Cierre registrado correctamente.')).toBeVisible();
    saved = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await screen.findByText('No hay cierres registrados para este filtro.');
    expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });
  it('shows civil dates, recorded totals, breakdown and inconsistency only for the selected history', async () => {
    mocks.fetchWithAuth.mockImplementation(async () => response([{ ...closing, fecha: '2024-02-29', total: 5 }, { ...closing, id: 2, local: 'Segundo Local' }]));
    render(<Sales />); fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    const row = await screen.findByRole('article', { name: 'Cierre 29/02/2024 · Principal' });
    expect(within(row).getByText('5,00 €')).toBeVisible();
    expect(within(row).getByText('0,10 €')).toBeVisible();
    expect(within(row).getByText('Descuadre: -0,01 €')).toBeVisible();
    expect(within(row).getByRole('alert')).toHaveTextContent('Se conserva el histórico');
    fireEvent.click(screen.getByRole('button', { name: 'Segundo Local', exact: true }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
  it('does not publish malformed history and allows GET recovery while retaining the draft', async () => {
    mocks.fetchWithAuth.mockImplementation(async () => response([{ ...closing, fecha: '2024-02-30' }]));
    render(<Sales />); fillDraft(); fireEvent.click(screen.getByRole('button', { name: 'Historial' }));
    await screen.findByRole('alert'); expect(screen.queryByRole('article')).not.toBeInTheDocument();
    mocks.fetchWithAuth.mockImplementation(async () => response([closing]));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await screen.findByRole('article');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo Cierre (Z)' }));
    expect(screen.getByLabelText('Total Efectivo')).toHaveValue(0.1);
  });
});

describe('Dashboard boundaries', () => {
  it('renders shared cents, a deterministic latest closing and civil event dates', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/cierres') ? [{ ...closing, id: 2, fecha: '2025-12-31' }, { ...closing, total: 5 }] : url.endsWith('/gastos') ? [expense] : url.endsWith('/eventos') ? [{ id: 1, titulo: 'Próximo evento', fecha: '2026-01-16', hora: '10:00', descripcion: '', tipo: 'Evento' }] : []));
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    const summary = await screen.findByRole('region', { name: 'Resumen financiero mensual' });
    expect(summary).toHaveTextContent('5,00 €'); expect(summary).toHaveTextContent('4,95 €');
    expect(summary).toHaveTextContent('5,00 € · 01/01/2026 · Principal');
    expect(screen.getByRole('alert')).toHaveTextContent('Se conservan los totales registrados');
    expect(screen.getByText('16/01/2026 · Evento')).toBeVisible();
  });
  it.each(['invalid closing', 'failed expenses', 'invalid event'])('blocks the entire dashboard on %s and can reload', async failure => {
    mocks.fetchWithAuth.mockImplementation(async url => url.endsWith('/gastos') && failure === 'failed expenses' ? response({ error: 'Gastos pendientes' }, 503) : response(url.endsWith('/cierres') ? [{ ...closing, ...(failure === 'invalid closing' ? { total: null } : {}) }] : url.endsWith('/eventos') && failure === 'invalid event' ? [{ fecha: '2026-02-30' }] : []));
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await screen.findByRole('alert'); expect(screen.queryByRole('region', { name: 'Resumen financiero mensual' })).not.toBeInTheDocument();
    mocks.fetchWithAuth.mockImplementation(async () => response([]));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(await screen.findByRole('region', { name: 'Resumen financiero mensual' })).toHaveTextContent('Sin cierres');
  });
});
