import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readEmployeePlanning, readShifts } from '../../apps/erp-web/src/shiftData';
import Calendar from '../../apps/erp-web/src/pages/employee/Calendar';
import EmployeeDashboard from '../../apps/erp-web/src/pages/employee/EmployeeDashboard';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '3', name: 'María', location: 'Principal' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const shift = { id: 1, usuario_id: 3, fecha: '2024-02-29', hora_inicio: '22:00', hora_fin: '02:00', local: 'Principal', compañeros: 'Equipo' };
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async url => response(url.endsWith('/turnos') ? [shift] : [])); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Civil shift lists', () => {
  it('preserves overnight and equal-hour shifts without calculating duration and sorts every record', async () => {
    const rows = [shift, { ...shift, id: 2, hora_inicio: '10:00', hora_fin: '10:00' }, { ...shift, id: 3, fecha: '2025-02-28' }];
    expect((await readShifts([response(rows)])).map(row => row.id)).toEqual([2, 1, 3]);
    expect(rows[0]).toEqual(shift);
  });
  it.each([{ fecha: '2025-02-29' }, { hora_inicio: '24:00' }, { hora_fin: '12:60' }, { usuario_id: null }, { local: {} }, { compañeros: [] }, { id: 0 }])('rejects malformed shift: %j', async fields => {
    await expect(readShifts([response([{ ...shift, ...fields }])])).rejects.toThrow('turnos inválidos');
  });
  it('rejects duplicate ids, partial reads and invalid task completion states', async () => {
    await expect(readShifts([response([shift, shift])])).rejects.toThrow();
    await expect(readEmployeePlanning([response({ error: 'Tareas pendientes' }, 503), response([shift])])).rejects.toThrow('Tareas pendientes');
    await expect(readEmployeePlanning([response([{ id: 1, completada: 'false' }]), response([shift])])).rejects.toThrow('tareas');
  });
  it('allows historic unspecified text fields without inventing a local', async () => {
    expect(await readShifts([response([{ ...shift, local: null, compañeros: null }])])).toEqual([{ ...shift, local: null, compañeros: null }]);
  });
});

describe('Employee planning views', () => {
  it('shows full dates and unchanged overnight hours in the calendar', async () => {
    render(<Calendar />);
    expect(await screen.findByText('29/02/2024')).toHaveAttribute('datetime', '2024-02-29');
    expect(screen.getByText('22:00 - 02:00')).toBeVisible();
    expect(screen.getByText('Compañeros: Equipo')).toBeVisible();
  });
  it.each([Calendar, EmployeeDashboard])('rejects malformed dates without claiming a free day, then recovers GET', async Component => {
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/turnos') ? [{ ...shift, fecha: '2024-02-30' }] : []));
    render(<MemoryRouter><Component /></MemoryRouter>);
    await screen.findByRole('alert');
    expect(screen.queryByText(/Sin turnos asignados|Sin turno registrado hoy|Sin tareas para hoy/)).not.toBeInTheDocument();
    mocks.fetchWithAuth.mockImplementation(async () => response([]));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await screen.findByText(Component === Calendar ? 'Sin turnos asignados' : 'Sin turno registrado hoy');
  });
  it('shows every shift today and leaves tomorrow out of the dashboard', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2024, 1, 29, 12));
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/turnos') ? [shift, { ...shift, id: 2, hora_inicio: '10:00', hora_fin: '14:00' }, { ...shift, id: 3, fecha: '2024-03-01', hora_inicio: '08:00' }] : []));
    render(<MemoryRouter><EmployeeDashboard /></MemoryRouter>);
    expect(await screen.findByText('Tus Turnos de Hoy')).toBeVisible();
    expect(screen.getByText('10:00 - 14:00')).toBeVisible(); expect(screen.getByText('22:00 - 02:00')).toBeVisible();
    expect(screen.queryByText('08:00 - 02:00')).not.toBeInTheDocument();
  });
});
