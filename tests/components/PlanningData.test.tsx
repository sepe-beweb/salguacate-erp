import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyTask, eventHasPassed, readEvents, readTasks, readTaskWorkspace } from '../../apps/erp-web/src/planningData';
import Tasks from '../../apps/erp-web/src/pages/Tasks';
import ManagerCalendar from '../../apps/erp-web/src/pages/ManagerCalendar';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const event = { id: 1, titulo: 'Evento civil', fecha: '2024-02-29', hora: '10:00', tipo: 'General', descripcion: '' };
const task = { id: 1, titulo: 'Tarea civil', fecha: '2024-02-29', prioridad: 'normal', descripcion: '', asignado_a: null, asignado_nombre: null, completada: 0, local: 'Ambos' };
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async url => response(url.endsWith('/tareas') ? [task] : url.endsWith('/eventos') ? [event] : [])); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Validated planning lists and civil values', () => {
  it.each([undefined, false, {}])('rejects missing or malformed employee local before offering assignments: %j', async local => {
    await expect(readTaskWorkspace([response([]), response([{ id: 3, nombre: 'María', rol: 'employee', local }])])).rejects.toThrow('personas');
  });
  it('sorts a copy of events by civil date/time/id and retains unknown historical event types', async () => {
    const rows = [{ ...event, id: 3, hora: '12:00', tipo: 'Histórico' }, { ...event, id: 2 }, event];
    expect((await readEvents([response(rows)])).map(row => row.id)).toEqual([1, 2, 3]);
    expect(rows[0].id).toBe(3);
  });
  it.each([{ fecha: '2025-02-29' }, { hora: '24:00' }, { id: 0 }, { titulo: null }, { descripcion: {} }])('rejects a malformed event: %j', async fields => {
    await expect(readEvents([response([{ ...event, ...fields }])])).rejects.toThrow('agenda');
  });
  it.each([{ completada: '0' }, { fecha: '2026-02-30' }, { asignado_a: -1 }, { prioridad: 'urgente' }, { local: {} }])('rejects a malformed task: %j', async fields => {
    await expect(readTasks([response([{ ...task, ...fields }])])).rejects.toThrow('tareas');
  });
  it('normalizes only valid persisted booleans without truthy strings or duplicate ids', async () => {
    expect((await readTasks([response([task, { ...task, id: 2, completada: 1 }])])).map(row => row.completada)).toEqual([false, true]);
    await expect(readTasks([response([task, task])])).rejects.toThrow();
    await expect(readEvents([response([event, event])])).rejects.toThrow();
  });
  it('rejects incomplete related reads or invalid employee identities', async () => {
    await expect(readTaskWorkspace([response([task]), response({ error: 'Personas pendientes' }, 503)])).rejects.toThrow('Personas pendientes');
    await expect(readTaskWorkspace([response([task]), response([{ id: '1', nombre: 'Persona', rol: 'employee' }])])).rejects.toThrow('personas');
  });
  it('compares event wall clocks, including the exact start second, without time-zone conversion', () => {
    expect(eventHasPassed(event, new Date(2024, 1, 29, 9, 59, 59))).toBe(false);
    expect(eventHasPassed(event, new Date(2024, 1, 29, 10, 0, 0))).toBe(false);
    expect(eventHasPassed(event, new Date(2024, 1, 29, 10, 0, 1))).toBe(true);
    expect(eventHasPassed(event, new Date(2024, 2, 1))).toBe(true);
  });
  it('creates today at invocation time, not module-import time', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2024, 1, 29, 23, 59));
    expect(emptyTask().fecha).toBe('2024-02-29');
    vi.setSystemTime(new Date(2024, 2, 1, 0, 1)); expect(emptyTask().fecha).toBe('2024-03-01');
  });
});

describe('Task and event screen recovery', () => {
  it('does not show empty task counters or actions on failed load and can recover GET', async () => {
    mocks.fetchWithAuth.mockImplementation(async () => response({ error: 'Lectura pendiente' }, 503));
    render(<Tasks />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Lectura pendiente');
    expect(screen.queryByText('Sin tareas pendientes')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pendientes/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva' })).toBeDisabled();
    mocks.fetchWithAuth.mockImplementation(async () => response([]));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(await screen.findByText('Sin tareas pendientes')).toBeVisible();
  });
  it('preserves complete fields, locks duplicate submits and keeps the civil date on rejection', async () => {
    let finish!: (value: Response) => void;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? new Promise<Response>(resolve => { finish = resolve; }) : response([]));
    render(<Tasks />); await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    for (const [label, value] of [['Tarea', 'Borrador'], ['Detalles (Opcional)', 'Detalles completos'], ['Fecha', '2024-02-29'], ['Prioridad', 'alta'], ['Local', 'Segundo Local']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Tarea' }));
    expect(screen.getByLabelText('Tarea')).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cerrar tarea' })).toBeDisabled();
    await act(async () => finish(response({ error: 'No guardada' }, 400)));
    expect(await screen.findByRole('alert')).toHaveTextContent('No guardada');
    expect(screen.getByLabelText('Fecha')).toHaveValue('2024-02-29');
    expect(screen.getByLabelText('Detalles (Opcional)')).toHaveValue('Detalles completos');
    const calls = mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(calls).toHaveLength(1); expect(JSON.parse(calls[0][1].body)).toMatchObject({ local: 'Segundo Local', prioridad: 'alta', fecha: '2024-02-29', asignado_a: null });
  });
  it('does not delete on cancellation and locks toggle until its follow-up read finishes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Tasks />); const toggle = await screen.findByRole('button', { name: 'Completar: Tarea civil' });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar tarea: Tarea civil' }));
    expect(confirm).toHaveBeenCalled(); expect(mocks.fetchWithAuth.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
    let finish!: (value: Response) => void;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'PUT' ? new Promise<Response>(resolve => { finish = resolve; }) : response([]));
    fireEvent.click(toggle); expect(toggle).toBeDisabled();
    await act(async () => finish(response({ error: 'Cambio incierto' }, 503)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Comprueba el estado');
    expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  });
  it('renders dates without converting them and does not mark a task due today overdue', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2024, 1, 29, 23, 59));
    render(<Tasks />); expect(await screen.findByText('29/02/2024')).toBeVisible();
    expect(screen.queryByText(/Atrasada/)).not.toBeInTheDocument();
  });
  it('shows invalid events as a load error rather than editable cards', async () => {
    mocks.fetchWithAuth.mockImplementation(async () => response([{ ...event, hora: '99:00' }]));
    render(<ManagerCalendar />); await screen.findByRole('alert');
    expect(screen.queryByText(event.titulo)).not.toBeInTheDocument();
    mocks.fetchWithAuth.mockImplementation(async () => response([event]));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(await screen.findByText('29/02/2024')).toBeVisible();
  });
});
