import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import HRManagement from '../../apps/erp-web/src/pages/HRManagement';
const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '1', role: 'owner' } }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const staff = [{ id: 3, nombre: 'María', rol: 'employee', local: 'Principal', telefono: null, has_pin: 1 }, { id: 4, nombre: 'Pedro', rol: 'employee', local: 'Principal', telefono: null, has_pin: 1 }];
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { mocks.fetchWithAuth.mockReset().mockImplementation(async url => response(url.endsWith('/usuarios') ? staff : [])); });
afterEach(() => vi.restoreAllMocks());
const writes = () => mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method);
const cancel = () => fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
async function open() { render(<HRManagement />); fireEvent.click(await screen.findByRole('button', { name: 'Empleado', exact: true })); }

it.each(['1234', '111111', '123456789'])('rejects invalid PIN %s before transport even without native validation', async pin => {
  await open(); fireEvent.change(screen.getByLabelText('Nombre Completo'), { target: { value: 'Nueva' } });
  fireEvent.change(screen.getByLabelText('PIN de Acceso'), { target: { value: pin } });
  fireEvent.submit(screen.getByLabelText('Nombre Completo').closest('form')!);
  expect(screen.getByRole('alert')).toHaveTextContent('6 a 8 dígitos'); expect(writes()).toHaveLength(0);
});
it('retains ordinary fields after closing but clears the secret and confirms discard', async () => {
  await open(); fireEvent.change(screen.getByLabelText('Nombre Completo'), { target: { value: 'Borrador' } });
  fireEvent.change(screen.getByLabelText('PIN de Acceso'), { target: { value: '135790' } });
  expect(screen.getByLabelText('PIN de Acceso')).toHaveAttribute('type', 'password');
  cancel(); fireEvent.click(screen.getByRole('button', { name: 'Retomar borrador de empleado' }));
  expect(screen.getByLabelText('Nombre Completo')).toHaveValue('Borrador'); expect(screen.getByLabelText('PIN de Acceso')).toHaveValue('');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); fireEvent.click(screen.getByText('Descartar borrador de empleado'));
  expect(screen.getByRole('dialog')).toBeVisible(); confirm.mockReturnValue(true); fireEvent.click(screen.getByText('Descartar borrador de empleado'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(writes()).toHaveLength(0);
});
it('does not silently change the destination of an edit draft and preserves an empty existing PIN', async () => {
  render(<HRManagement />); fireEvent.click((await screen.findAllByTitle('Editar empleado'))[0]);
  fireEvent.change(screen.getByLabelText('Nombre Completo'), { target: { value: 'María editada' } });
  cancel(); vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getAllByTitle('Editar empleado')[1]); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Retomar borrador de empleado'));
  mocks.fetchWithAuth.mockImplementation(async (url, options) => options?.method ? response({ error: 'Rechazado' }, 409) : response(url.endsWith('/usuarios') ? staff : []));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' })); await screen.findByRole('alert');
  expect(writes()).toHaveLength(1); expect(writes()[0][0]).toMatch(/\/usuarios\/3$/);
  expect(JSON.parse(writes()[0][1].body)).toMatchObject({ nombre: 'María editada', pin: '' });
  expect(screen.getByLabelText('Nombre Completo')).toHaveValue('María editada');
});
it('locks the shift dialog while pending and retains an overnight shift on failure', async () => {
  render(<HRManagement />); fireEvent.click(await screen.findByRole('button', { name: /Crear Cuadrante/ }));
  fireEvent.change(screen.getByLabelText('Empleado'), { target: { value: '3' } }); fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2024-02-29' } });
  cancel(); fireEvent.click(screen.getByRole('button', { name: /Crear Cuadrante/ }));
  expect(screen.getByLabelText('Fecha')).toHaveValue('2024-02-29');
  let finish!: (value: Response) => void; mocks.fetchWithAuth.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar Turno' })); expect(screen.getByLabelText('Empleado')).toBeDisabled();
  cancel(); expect(screen.getByRole('dialog')).toBeVisible();
  await act(async () => finish(response({ error: 'Sin conexión' }, 503)));
  expect(screen.getByRole('alert')).toHaveTextContent('Consulta los turnos'); expect(screen.getByLabelText('Hora Inicio')).toHaveValue('18:00'); expect(screen.getByLabelText('Hora Fin')).toHaveValue('02:00'); expect(writes()).toHaveLength(1);
});
