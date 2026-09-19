import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Messages from '../../apps/erp-web/src/pages/employee/Messages';
import Requests from '../../apps/erp-web/src/pages/employee/Requests';
import Tasks from '../../apps/erp-web/src/pages/Tasks';
import { readJson, readList } from '../../apps/erp-web/src/apiResponse';

const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '3', name: 'María', role: 'employee' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  mocks.fetchWithAuth.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => response([{ id: 1, nombre: 'Propietario', rol: 'owner' }])));
});
afterEach(() => vi.unstubAllGlobals());

describe('Visible operational failures', () => {
  it('distinguishes HTTP errors and invalid list responses from empty data', async () => {
    await expect(readJson(response({ error: 'Sin permiso' }, 403))).rejects.toThrow('Sin permiso');
    await expect(readList(response({ error: 'not a list' }))).rejects.toThrow('lista válida');
    await expect(readJson(new Response('<html>error</html>', { status: 502 }))).rejects.toThrow('Respuesta inválida');
  });
  it('shows inbox load failure and allows an explicit retry', async () => {
    mocks.fetchWithAuth.mockResolvedValueOnce(response({ error: 'Buzón no disponible' }, 503)).mockResolvedValueOnce(response([]));
    render(<Messages />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Buzón no disponible');
    expect(screen.queryByText('No tienes mensajes nuevos.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(await screen.findByText('No tienes mensajes nuevos.')).toBeInTheDocument();
  });
  it('keeps the recipient, subject and message draft when sending fails', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({ error: 'Destinatario desactivado' }, 404) : response([]));
    render(<Messages />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo mensaje' }));
    fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'Mi asunto' } });
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Mi borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar Mensaje' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Destinatario desactivado');
    expect(screen.getByLabelText('Destinatario')).toHaveValue('1');
    expect(screen.getByLabelText('Asunto')).toHaveValue('Mi asunto');
    expect(screen.getByLabelText('Mensaje')).toHaveValue('Mi borrador');
  });
  it('keeps request dates and comments when the server rejects them', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({ error: 'Fechas inválidas' }, 400) : response([]));
    render(<Requests />);
    await screen.findByText('No has realizado ninguna petición anterior.');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-22' } });
    fireEvent.change(screen.getByLabelText('Comentarios (Opcional)'), { target: { value: 'Conservar comentario' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar Petición' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Fechas inválidas');
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-20');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-09-22');
    expect(screen.getByLabelText('Comentarios (Opcional)')).toHaveValue('Conservar comentario');
  });
  it('keeps the task editor open after failed creation', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({ error: 'Usuario desactivado' }, 404) : response([]));
    render(<Tasks />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    const title = screen.getByPlaceholderText('Ej. Limpiar cámara frigorífica');
    fireEvent.change(title, { target: { value: 'Tarea pendiente' } });
    fireEvent.submit(title.closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario desactivado');
    expect(title).toHaveValue('Tarea pendiente');
    expect(screen.getByText('Nueva Tarea')).toBeInTheDocument();
  });
});
