import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPersonnelRequests, readPersonnelWorkspace, requestCreatedAt } from '../../apps/erp-web/src/personnelData';
import Requests from '../../apps/erp-web/src/pages/employee/Requests';
import HRManagement from '../../apps/erp-web/src/pages/HRManagement';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '1', role: 'owner' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const request = { id: 1, usuario_id: 3, tipo: 'vacaciones', fecha_inicio: '2024-02-29', fecha_fin: '2024-03-01', comentarios: 'Borrador', estado: 'pendiente', empleado_nombre: 'María', empleado_rol: 'employee', empleado_local: 'Principal', creado_en: '2024-02-01 23:30:00' };
const staff = { id: 3, nombre: 'María', rol: 'employee', local: 'Principal', telefono: null, has_pin: 1 };
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async url => response(url.endsWith('/peticiones') ? [request] : url.endsWith('/usuarios') ? [staff] : [])); });
afterEach(() => vi.restoreAllMocks());

describe('Personnel read contracts', () => {
  it('reads SQLite creation timestamps as UTC while retaining civil request dates', async () => {
    expect(requestCreatedAt(request.creado_en).toISOString()).toBe('2024-02-01T23:30:00.000Z');
    expect(requestCreatedAt('2024-02-01T23:30:00Z').toISOString()).toBe('2024-02-01T23:30:00.000Z');
    expect((await readPersonnelRequests([response([request])]))[0].fecha_inicio).toBe('2024-02-29');
  });
  it.each(['2024-02-30 10:00:00', '2024-02-01 24:00:00', '2024-02-01T23:30:00', 'ayer', '2024-02-01 23:30:60'])('rejects ambiguous or invalid creation timestamp %s', value => {
    expect(() => requestCreatedAt(value)).toThrow();
  });
  it.each([{ estado: 'desconocido' }, { tipo: 'otro' }, { fecha_fin: '2024-02-28' }, { fecha_inicio: '2024-02-30' }, { usuario_id: 0 }, { comentarios: {} }])('rejects malformed request: %j', async fields => {
    await expect(readPersonnelRequests([response([{ ...request, ...fields }])])).rejects.toThrow();
  });
  it('rejects duplicates and incomplete workspaces; permits null optional end and comments', async () => {
    await expect(readPersonnelRequests([response([request, request])])).rejects.toThrow();
    expect((await readPersonnelRequests([response([{ ...request, fecha_fin: null, comentarios: null }])]))[0].fecha_fin).toBeNull();
    await expect(readPersonnelWorkspace([response([staff]), response({ error: 'Turnos pendientes' }, 503), response([request])])).rejects.toThrow('Turnos pendientes');
  });
  it('rejects malformed personnel identities instead of inventing roles or PIN state', async () => {
    await expect(readPersonnelWorkspace([response([{ ...staff, rol: 'unknown' }]), response([]), response([])])).rejects.toThrow('plantilla');
    await expect(readPersonnelWorkspace([response([{ ...staff, has_pin: '1' }]), response([]), response([])])).rejects.toThrow('plantilla');
  });
});

describe('Personnel screen recovery', () => {
  it.each([Requests, HRManagement])('shows the same civil date range on either side', async Component => {
    render(<Component />);
    if (Component === HRManagement) fireEvent.click(await screen.findByRole('button', { name: /Peticiones de Personal/ }));
    expect(await screen.findByText(/29\/02\/2024/)).toBeVisible(); expect(screen.getByText(/01\/03\/2024/)).toBeVisible();
  });
  it.each([Requests, HRManagement])('blocks invalid request history and recovers only GET', async Component => {
    mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/peticiones') ? [{ ...request, estado: 'otro' }] : []));
    render(<Component />); await screen.findByRole('alert');
    expect(screen.queryByText('Pendiente', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    mocks.fetchWithAuth.mockImplementation(async () => response([])); fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(mocks.fetchWithAuth.mock.calls.some(([, options]) => options?.method)).toBe(false);
  });
  it('freezes a submitted request and preserves every field on rejection', async () => {
    let finish!: (value: Response) => void;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? new Promise<Response>(resolve => { finish = resolve; }) : response([]));
    render(<Requests />);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2024-02-29' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2024-03-01' } });
    fireEvent.change(screen.getByLabelText('Comentarios (Opcional)'), { target: { value: 'Conservar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar Petición' }));
    expect(screen.getByLabelText('Desde')).toBeDisabled(); expect(screen.getByLabelText('Tipo de Petición')).toBeDisabled();
    await act(async () => finish(response({ error: 'No enviada' }, 503)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Consulta el historial');
    expect(screen.getByLabelText('Desde')).toHaveValue('2024-02-29'); expect(screen.getByLabelText('Hasta')).toHaveValue('2024-03-01');
    expect(screen.getByLabelText('Comentarios (Opcional)')).toHaveValue('Conservar');
    expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });
  it('does not send a reversed civil date range when native validation is bypassed', async () => {
    render(<Requests />); fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2024-03-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2024-02-29' } });
    fireEvent.submit(screen.getByLabelText('Desde').closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('anterior al inicio');
    expect(mocks.fetchWithAuth.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
  it('locks approval/rejection and reconciles the authoritative state after a conflict without retrying PATCH', async () => {
    let finish!: (value: Response) => void; let resolved = false;
    mocks.fetchWithAuth.mockImplementation(async (url, options) => options?.method === 'PATCH' ? new Promise<Response>(resolve => { finish = resolve; }) : response(url.endsWith('/peticiones') ? [{ ...request, estado: resolved ? 'rechazado' : 'pendiente' }] : url.endsWith('/usuarios') ? [staff] : []));
    render(<HRManagement />); fireEvent.click(await screen.findByRole('button', { name: /Peticiones de Personal/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' })); expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled();
    resolved = true; await act(async () => finish(response({ error: 'La petición ya está resuelta' }, 409)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Comprueba la petición');
    expect(await screen.findByText('❌ Rechazada')).toBeVisible(); expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1);
  });
});
