import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { readPresence, presenceTimestamp } from '../../apps/erp-web/src/presenceData';
import { readDashboardLists } from '../../apps/erp-web/src/dashboardData';
import Dashboard from '../../apps/erp-web/src/pages/Dashboard';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { name: 'Propietario' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown) => new Response(JSON.stringify(body));
const presence = { usuario_id: 3, usuario_nombre: 'María', usuario_rol: 'employee', usuario_local: null, estado_presencia: 'trabajando', ultimo_fichaje_entrada: '2024-02-29 23:30:00', ultimo_fichaje_salida: null };
const product = { id: 1, producto: 'Agua', stock_actual: 5, stock_minimo: 5, local: 'Principal', categoria: 'Bebida', proveedor_id: null, proveedor_nombre: null, proveedor_telefono: null };
const staff = { id: 1, nombre: 'Propietario', rol: 'owner', local: 'Todos', telefono: null, has_pin: 1 };
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async url => response(url.endsWith('/presencia') ? [presence] : url.endsWith('/inventario') ? [product] : url.endsWith('/usuarios') ? [staff] : [])); });
it.each([{ usuario_id: '3' }, { usuario_id: 0 }, { usuario_nombre: null }, { usuario_nombre: '' }, { usuario_rol: 'owner' }, { usuario_rol: ['employee'] }, { usuario_local: {} }, { estado_presencia: 'desconocido' }, { estado_presencia: ['fuera'] }, { ultimo_fichaje_entrada: null }, { ultimo_fichaje_entrada: '2024-02-29T23:30:00' }, { ultimo_fichaje_entrada: '2023-02-29 23:30:00' }, { ultimo_fichaje_salida: '2024-03-01T01:00:00Z' }])('rejects malformed or contradictory presence %j', async change => {
  await expect(readPresence(response([{ ...presence, ...change }]))).rejects.toThrow();
});
it('accepts only coherent active, resting, completed or absent clock records, including an overnight shift', async () => {
  const completed = { ...presence, estado_presencia: 'fuera', ultimo_fichaje_salida: '2024-03-01T02:00:00Z' };
  for (const row of [presence, { ...presence, estado_presencia: 'descanso' }, completed, { ...presence, estado_presencia: 'fuera', ultimo_fichaje_entrada: null }]) expect(await readPresence(response([row]))).toEqual([row]);
  for (const row of [{ ...completed, ultimo_fichaje_entrada: null }, { ...completed, ultimo_fichaje_salida: null }, { ...completed, ultimo_fichaje_salida: '2024-02-29T22:00:00Z' }]) await expect(readPresence(response([row]))).rejects.toThrow('no concuerda');
  expect(presenceTimestamp(presence.ultimo_fichaje_entrada).toISOString()).toBe('2024-02-29T23:30:00.000Z');
});
it('rejects duplicate users and sorts by name without mutating input', async () => {
  await expect(readPresence(response([presence, presence]))).rejects.toThrow();
  const rows = [presence, { ...presence, usuario_id: 2, usuario_nombre: 'Ana' }];
  expect((await readPresence(response(rows))).map(row => row.usuario_id)).toEqual([2, 3]); expect(rows[0].usuario_id).toBe(3);
});
it.each(['stock', 'staff', 'presence'])('rejects incomplete dashboard values from %s', async source => {
  const responses = [[], [], [], [], source === 'stock' ? [{ ...product, stock_actual: '5' }] : [product], source === 'staff' ? [{ ...staff, id: '1' }] : [staff], source === 'presence' ? [{ ...presence, estado_presencia: 'invalid' }] : [presence]].map(response);
  await expect(readDashboardLists(responses)).rejects.toThrow();
});
it('labels the query honestly, preserves missing local and refreshes counts only through GET', async () => {
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  const region = await screen.findByRole('region', { name: 'Presencia registrada' });
  expect(within(region).getByText('Local no indicado')).toBeVisible();
  expect(within(region).getByText('Trabajando')).toBeVisible();
  expect(region.querySelector('time')).toHaveAttribute('datetime', '2024-02-29T23:30:00.000Z');
  expect(screen.getByText('1 producto con stock bajo')).toBeVisible(); expect(screen.getByText('Plantilla activa')).toBeVisible();
  expect(screen.getByText('Datos de la última carga. No se actualizan automáticamente.')).toBeVisible();
  mocks.fetchWithAuth.mockImplementation(async () => response([])); fireEvent.click(screen.getByRole('button', { name: 'Actualizar resumen' }));
  expect(await screen.findByText('No hay información de turnos disponible.')).toBeVisible(); expect(screen.queryByText('1 producto con stock bajo')).not.toBeInTheDocument();
  expect(mocks.fetchWithAuth.mock.calls).toHaveLength(14); expect(mocks.fetchWithAuth.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
it('does not label unknown presence as outside or show financial totals while it fails', async () => {
  mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/presencia') ? [{ ...presence, estado_presencia: 'invisible' }] : []));
  render(<MemoryRouter><Dashboard /></MemoryRouter>); expect(await screen.findByRole('alert')).toHaveTextContent('presencia contiene datos inválidos');
  expect(screen.queryByText('Fuera')).not.toBeInTheDocument(); expect(screen.queryByRole('region', { name: 'Resumen financiero mensual' })).not.toBeInTheDocument();
});
