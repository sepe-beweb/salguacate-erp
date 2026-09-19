import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCivilDate, formatEuroCents, isCivilDate, sumCents, toCents } from '../../apps/erp-web/src/financialValues';
import { financialDays, financialSummary, readFinancialLists, selectFinancialPeriod, type CashClosing } from '../../apps/erp-web/src/financialData';
import Reports from '../../apps/erp-web/src/pages/Reports';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const closing: CashClosing = { id: 1, fecha: '2024-02-29', local: 'Principal', total: 0.30, efectivo: 0.10, tarjeta: 0.20, invitaciones: 1.10, descuadre: -0.01 };
const expense = { id: 1, fecha: '2024-02-29', local: 'Principal', total: 0.05, proveedor_nombre: 'Proveedor', concepto: 'Compra' };
beforeEach(() => { mocks.fetchWithAuth.mockReset(); });
afterEach(() => vi.restoreAllMocks());

describe('Civil dates and exact financial cents', () => {
  it.each(['2024-02-29', '2000-02-29', '2026-01-01', '0099-12-31'])('formats %s without a Date/locale conversion', date => {
    expect(isCivilDate(date)).toBe(true);
    expect(formatCivilDate(date)).toBe(date.split('-').reverse().join('/'));
  });
  it.each(['1900-02-29', '2025-02-29', '2026-02-30', '2026-13-01', '2026-01-00', '2026-01-01T00:00:00Z', '2026-1-1'])('rejects invalid or non-civil date %s', date => {
    expect(isCivilDate(date)).toBe(false); expect(() => formatCivilDate(date)).toThrow();
  });
  it('sums decimal amounts as cents and formats negative, zero and safe-limit cents exactly', () => {
    expect(sumCents([toCents(0.1), toCents(0.2)])).toBe(30);
    expect(formatEuroCents(30)).toBe('0,30\u00a0€');
    expect(formatEuroCents(-1)).toBe('-0,01\u00a0€');
    expect(formatEuroCents(-0)).toBe('0,00\u00a0€');
    expect(formatEuroCents(Number.MAX_SAFE_INTEGER)).toBe('90.071.992.547.409,91\u00a0€');
  });
  it.each([1.005, NaN, Infinity, Number.MAX_SAFE_INTEGER, '1.00', null])('rejects non-exact or untyped money %s', value => {
    expect(() => toCents(value as number)).toThrow();
  });
  it('rejects overflow instead of rounding a total', () => {
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow('rango seguro');
    expect(() => formatEuroCents(0.5)).toThrow();
  });
});

describe('Financial reads and aggregation', () => {
  it('groups both locals per civil day and counts expenses once, including expense-only days', () => {
    const cierres = [closing, { ...closing, id: 2, local: 'Segundo Local', total: 0.20, efectivo: 0.20, tarjeta: 0, descuadre: 0 }];
    const gastos = [expense, { ...expense, id: 2, fecha: '2024-03-01', total: 0.90 }];
    const rows = financialDays(cierres, gastos);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: '29/02/2024', Ingresos: 50, Gastos: 5, Saldo: 45, Descuadre: -1 });
    expect(rows[1]).toMatchObject({ name: '01/03/2024', Ingresos: 0, Gastos: 90, Saldo: -90 });
    expect(financialSummary(cierres, gastos)).toMatchObject({ income: 50, expenses: 95, balance: -45, invitations: 220 });
  });
  it('filters exact civil month/local without changing source arrays and separates years', () => {
    const cierres = [closing, { ...closing, id: 2, fecha: '2025-02-28', local: 'Segundo Local' }];
    const selected = selectFinancialPeriod([cierres, [expense]], 'Principal', '2024-02');
    expect(selected).toEqual([[closing], [expense]]);
    expect(cierres).toHaveLength(2);
    expect(financialDays(cierres, []).map(row => row.name)).toEqual(['29/02/2024', '28/02/2025']);
    expect(selectFinancialPeriod([cierres, [expense]], 'Otro local')).toEqual([[], []]);
  });
  it('uses recorded totals, flags inconsistent payment breakdown and never adds invitations as income', async () => {
    const historic = { ...closing, total: 5 };
    const lists = await readFinancialLists([response([historic]), response([expense])]);
    expect(financialSummary(...lists)).toMatchObject({ income: 500, cash: 10, card: 20, invitations: 110, balance: 495, inconsistent: true });
    expect(lists[0][0].total).toBe(5);
  });
  it.each([{ ...closing, efectivo: '0.10' }, { ...closing, descuadre: null }, { ...closing, total: -1 }, { ...closing, fecha: '2026-02-30' }, { ...closing, id: 0 }])('rejects malformed closing data before publishing the lists', async bad => {
    await expect(readFinancialLists([response([bad]), response([expense])])).rejects.toThrow();
  });
  it('rejects duplicate closing ids and a failed expense read without publishing partial income', async () => {
    await expect(readFinancialLists([response([closing, closing]), response([])])).rejects.toThrow('datos inválidos');
    await expect(readFinancialLists([response([closing]), response({ error: 'Sin gastos' }, 503)])).rejects.toThrow('Sin gastos');
  });
  it('rejects a dataset whose totals would overflow, even when individual records are valid', async () => {
    const large = { ...closing, total: 50000000000000, efectivo: 50000000000000, tarjeta: 0 };
    await expect(readFinancialLists([response([large, { ...large, id: 2 }]), response([])])).rejects.toThrow('rango seguro');
  });
});

describe('Monthly report display and print agreement', () => {
  it('warns about an inconsistent recorded total in both screen and print without changing it', async () => {
    const write = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({ document: { write, close: vi.fn() } } as unknown as Window);
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/api/cierres') ? [{ ...closing, total: 5 }] : []));
    render(<Reports />);
    await screen.findByRole('button', { name: /Exportar Informe/ });
    fireEvent.change(screen.getByLabelText('Año del informe'), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText('Mes del informe'), { target: { value: '1' } });
    expect(screen.getByText(/Hay cierres cuyo total no coincide/)).toBeVisible();
    expect(screen.getAllByText('5,00 €', { exact: true })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Exportar Informe/ }));
    expect(write.mock.calls[0][0]).toContain('Hay cierres cuyo total no coincide');
    expect(write.mock.calls[0][0]).toContain('5,00\u00a0€');
  });
  it('prints the same civil dates and cents as the monthly view and preserves HTML escaping', async () => {
    const write = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({ document: { write, close: vi.fn() } } as unknown as Window);
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/api/cierres') ? [closing] : [{ ...expense, proveedor_nombre: '<img src=x onerror=alert(1)>' }]));
    render(<Reports />);
    await screen.findByRole('button', { name: /Exportar Informe/ });
    fireEvent.change(screen.getByLabelText('Año del informe'), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText('Mes del informe'), { target: { value: '1' } });
    expect(screen.getByText('0,30 €', { exact: true })).toBeVisible();
    expect(screen.getByText('0,05 €', { exact: true })).toBeVisible();
    expect(screen.getByText('0,25 €', { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Exportar Informe/ }));
    const html = write.mock.calls[0][0];
    expect(html).toContain('29/02/2024'); expect(html).not.toContain('28/02/2024');
    expect(html).toContain('0,30\u00a0€'); expect(html).toContain('-0,01\u00a0€');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;'); expect(html).not.toContain('<img src=x');
  });
  it('blocks totals and export for malformed data, then recovers by GET', async () => {
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/api/cierres') ? [{ ...closing, total: '0.3' }] : []));
    render(<Reports />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /Exportar Informe/ })).not.toBeInTheDocument();
    expect(screen.queryByText('0,00 €')).not.toBeInTheDocument();
    mocks.fetchWithAuth.mockImplementation(async () => response([]));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await screen.findByRole('button', { name: /Exportar Informe/ });
    expect(mocks.fetchWithAuth.mock.calls.every(([, options]) => !options?.method)).toBe(true);
  });
});
