import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Dashboard from '../../apps/erp-web/src/pages/Dashboard';
import Tasks from '../../apps/erp-web/src/pages/Tasks';
import { LocalScopeProvider } from '../../apps/erp-web/src/context/LocalScopeContext';
import { locationLabel, matchesLocation } from '../../apps/erp-web/src/locations';
import { readDashboardLists } from '../../apps/erp-web/src/dashboardData';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '1', name: 'Felipe', role: 'owner', location: 'Todos' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const task = { id: 1, titulo: 'Preparar Aguacate', descripcion: '', asignado_a: null, asignado_nombre: null, fecha: '2026-09-20', prioridad: 'normal', completada: 0, local: 'Principal' };
const product = { id: 1, producto: 'Café', stock_actual: 2, stock_minimo: 5, local: 'Principal', categoria: 'Bebida', proveedor_id: null, proveedor_nombre: null, proveedor_telefono: null };
const order = { id: 1, fecha: '2026-09-19', local: 'Segundo Local', proveedor_id: null, proveedor_nombre: 'Proveedor', estado: 'pendiente', productos: JSON.stringify([{ producto_id: 1, nombre: 'Café', cantidad: 2 }]) };
const shift = { id: 1, usuario_id: 2, fecha: '2026-09-20', hora_inicio: '18:00', hora_fin: '02:00', local: 'Segundo Local', compañeros: '' };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 20, 12));
  mocks.fetchWithAuth.mockReset().mockImplementation(async (url: string) => response(
    url.endsWith('/tareas') ? [task, { ...task, id: 2, titulo: 'Revisar Salmón', local: 'Segundo Local', fecha: '2026-09-19' }, { ...task, id: 3, titulo: 'Común', local: 'Ambos' }, { ...task, id: 4, titulo: 'Mañana', fecha: '2026-09-21' }]
      : url.endsWith('/inventario') ? [product] : url.endsWith('/pedidos') ? [order] : url.endsWith('/turnos') ? [shift]
      : url.endsWith('/usuarios') ? [{ id: 2, nombre: 'Dora', rol: 'manager', local: 'Principal', telefono: null, has_pin: 1 }] : []));
});
afterEach(() => vi.useRealTimers());
it('maps display names without rewriting stored IDs or concealing unknown historic locations', () => {
  expect(locationLabel('Principal')).toBe('Aguacate'); expect(locationLabel('Segundo Local')).toBe('Salmón');
  expect(locationLabel('Histórico')).toBe('Histórico'); expect(locationLabel(null)).toBe('Local no indicado');
  expect(matchesLocation('Ambos', 'Principal', true)).toBe(true);
  expect(matchesLocation('Segundo Local', 'Principal')).toBe(false);
});
it('scopes actionable tasks, stock, orders and scheduled shifts while preserving common tasks', async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Hoy en tus locales' });
  expect(screen.getByRole('region', { name: 'Tareas del día' })).not.toHaveTextContent('Mañana');
  fireEvent.click(screen.getByRole('button', { name: 'Salmón', exact: true }));
  expect(screen.getByRole('heading', { name: 'Hoy en Salmón' })).toBeVisible();
  const due = screen.getByRole('region', { name: 'Tareas del día' });
  expect(due).toHaveTextContent('Revisar Salmón'); expect(due).toHaveTextContent('Común'); expect(due).not.toHaveTextContent('Preparar Aguacate');
  const attention = screen.getByRole('region', { name: 'Necesita atención' });
  expect(attention).toHaveTextContent('1 tarea atrasada'); expect(attention).toHaveTextContent('1 pedido pendiente'); expect(attention).not.toHaveTextContent('stock bajo');
  expect(screen.getByRole('region', { name: 'Turnos de hoy' })).toHaveTextContent('Dora');
  expect(screen.getByRole('region', { name: 'Turnos de hoy' })).toHaveTextContent('termina mañana');
  expect(screen.getByRole('region', { name: 'Cierre de hoy' })).toHaveTextContent('Sin registrar: Salmón.');
  expect(mocks.fetchWithAuth.mock.calls).toHaveLength(9);
});
it('retains the local on navigation and resets the preference with the session provider', async () => {
  const app = (session: string) => <LocalScopeProvider key={session}><MemoryRouter><Routes><Route path="/" element={<Dashboard />} /><Route path="/tareas" element={<Tasks />} /></Routes></MemoryRouter></LocalScopeProvider>;
  const view = render(app('first'));
  fireEvent.click(await screen.findByRole('button', { name: 'Salmón', exact: true }));
  fireEvent.click(screen.getByRole('link', { name: 'Organizar tareas' }));
  expect(await screen.findByText('Revisar Salmón')).toBeVisible();
  expect(screen.queryByText('Preparar Aguacate')).not.toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Local de trabajo' })).getByRole('button', { name: 'Salmón' })).toHaveAttribute('aria-pressed', 'true');
  view.rerender(app('second'));
  expect(await screen.findByRole('heading', { name: 'Hoy en tus locales' })).toBeVisible();
});
it.each(['/turnos', '/pedidos'])('blocks all dashboard figures when the new %s source fails', async source => {
  mocks.fetchWithAuth.mockImplementation(async (url: string) => url.endsWith(source) ? response({ error: 'Lectura no disponible' }, 503) : response([]));
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Lectura no disponible');
  expect(screen.queryByRole('region', { name: 'Necesita atención' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Resumen financiero mensual' })).not.toBeInTheDocument();
});
it.each([7, 8])('rejects malformed new dashboard source %i before publishing metrics', async index => {
  const rows: unknown[][] = [[], [], [], [], [], [], [], [], []]; rows[index] = [{ id: 1 }];
  await expect(readDashboardLists(rows.map(row => response(row)))).rejects.toThrow();
});
