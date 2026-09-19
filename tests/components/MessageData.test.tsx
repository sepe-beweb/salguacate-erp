import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Messages from '../../apps/erp-web/src/pages/employee/Messages';
import { readMessageWorkspace } from '../../apps/erp-web/src/messageData';
const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '3', role: 'employee' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const recipient = { id: 1, nombre: 'Propietario', rol: 'owner' };
const message = { id: 1, remitente_id: 1, destinatario_id: 3, remitente_nombre: 'Propietario', asunto: 'Asunto recibido', cuerpo: 'Contenido', fecha: '2024-02-29T23:30:00.000Z', leido: 0 };
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async url => response(url.endsWith('/usuarios/public') ? [recipient] : [message])); });
afterEach(() => vi.restoreAllMocks());
const writes = () => mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method);
async function compose() { render(<Messages />); await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo mensaje' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: 'Nuevo mensaje' })); }
function fill() { fireEvent.change(screen.getByLabelText('Destinatario'), { target: { value: '1' } }); fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'Borrador' } }); fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Cuerpo sin perder' } }); }
it.each([{ fecha: '2024-02-30 12:00:00' }, { fecha: '2024-02-29T23:30:00' }, { leido: '0' }, { cuerpo: {} }, { remitente_id: 0 }])('rejects malformed inbox data %j', async fields => {
  await expect(readMessageWorkspace([response([{ ...message, ...fields }]), response([recipient])])).rejects.toThrow();
});
it('orders both UTC storage formats and rejects duplicate messages and unknown recipient roles', async () => {
  const rows = [message, { ...message, id: 2, fecha: '2024-03-01 00:00:00' }];
  expect((await readMessageWorkspace([response(rows), response([recipient])]))[0].map(row => row.id)).toEqual([2, 1]);
  expect(rows[0].id).toBe(1);
  await expect(readMessageWorkspace([response([message, message]), response([recipient])])).rejects.toThrow();
  await expect(readMessageWorkspace([response([message]), response([{ ...recipient, rol: 'other' }])])).rejects.toThrow();
  await expect(readMessageWorkspace([response([message]), response([recipient, recipient])])).rejects.toThrow();
});
it('blocks partial reads and retries GET without displaying stale or fictitious empty messages', async () => {
  mocks.fetchWithAuth.mockImplementation(async url => url.endsWith('/usuarios/public') ? response({ error: 'Directorio no disponible' }, 503) : response([message]));
  render(<Messages />); expect(await screen.findByRole('alert')).toHaveTextContent('Directorio no disponible');
  expect(screen.queryByText(message.asunto)).not.toBeInTheDocument(); expect(screen.queryByText('No tienes mensajes nuevos.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Nuevo mensaje' })).toBeDisabled();
  mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/usuarios/public') ? [recipient] : [message]));
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' })); expect(await screen.findByText(message.asunto)).toBeVisible(); expect(writes()).toHaveLength(0);
  expect(screen.getByText(message.asunto).parentElement?.querySelector('time')).toHaveAttribute('datetime', message.fecha);
});
it('requires explicit recipient selection and retains a hidden draft until confirmed discard', async () => {
  await compose(); expect(screen.getByLabelText('Destinatario')).toHaveValue('0');
  fireEvent.submit(screen.getByLabelText('Asunto').closest('form')!); expect(screen.getByRole('alert')).toHaveTextContent('Selecciona un destinatario'); expect(writes()).toHaveLength(0);
  fill(); fireEvent.click(screen.getByRole('button', { name: 'Cancelar mensaje' })); fireEvent.click(screen.getByRole('button', { name: 'Nuevo mensaje' }));
  expect(screen.getByLabelText('Mensaje')).toHaveValue('Cuerpo sin perder');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); fireEvent.click(screen.getByText('Descartar borrador de mensaje')); expect(screen.getByLabelText('Mensaje')).toHaveValue('Cuerpo sin perder');
  confirm.mockReturnValue(true); fireEvent.click(screen.getByText('Descartar borrador de mensaje')); fireEvent.click(screen.getByRole('button', { name: 'Nuevo mensaje' })); expect(screen.getByLabelText('Mensaje')).toHaveValue('');
});
it('freezes the exact submitted draft and suppresses duplicate submit during a rejected send', async () => {
  await compose(); fill(); let finish!: (value: Response) => void;
  mocks.fetchWithAuth.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
  const form = screen.getByLabelText('Asunto').closest('form')!; fireEvent.submit(form); fireEvent.submit(form);
  expect(screen.getByLabelText('Destinatario')).toBeDisabled(); expect(screen.getByLabelText('Mensaje')).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cancelar mensaje' })).toBeDisabled(); expect(writes()).toHaveLength(1);
  await act(async () => finish(response({ error: 'Envío incierto' }, 503)));
  expect(screen.getByRole('alert')).toHaveTextContent('comprueba con el destinatario'); expect(screen.getByLabelText('Mensaje')).toHaveValue('Cuerpo sin perder');
});
it('does not resend or restore a successful draft when the subsequent inbox read fails', async () => {
  await compose(); fill(); mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method === 'POST' ? response({ id: 9 }) : response({ error: 'Lectura posterior fallida' }, 503));
  fireEvent.click(screen.getByRole('button', { name: 'Enviar Mensaje' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Lectura posterior fallida'); expect(screen.getByText('Mensaje enviado correctamente.')).toBeVisible(); expect(screen.queryByLabelText('Mensaje')).not.toBeInTheDocument();
  mocks.fetchWithAuth.mockImplementation(async url => response(url.endsWith('/usuarios/public') ? [recipient] : [])); fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
  await screen.findByText('No tienes mensajes nuevos.'); expect(writes()).toHaveLength(1);
});
