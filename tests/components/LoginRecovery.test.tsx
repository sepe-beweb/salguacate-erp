import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Login from '../../apps/erp-web/src/pages/Login';
import { readPublicUsers } from '../../apps/erp-web/src/publicUsers';
const mocks = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const profile = { id: 3, nombre: 'María', rol: 'employee' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { mocks.login.mockReset(); vi.stubGlobal('fetch', vi.fn(async () => response([profile]))); });
afterEach(() => vi.unstubAllGlobals());
it.each([[{ ...profile, rol: 'unknown' }], [{ ...profile, id: 0 }], [{ ...profile, nombre: null }], [{ ...profile, nombre: ' ' }], [profile, profile], { profiles: [] }])('rejects unusable public profile data: %j', async rows => {
  await expect(readPublicUsers([response(rows)])).rejects.toThrow();
});
it('distinguishes a valid empty directory from a server failure', async () => {
  vi.mocked(fetch).mockImplementation(async () => response([])); render(<Login />);
  expect(await screen.findByText('No hay perfiles activos configurados.')).toBeVisible(); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(mocks.login).not.toHaveBeenCalled();
});
it('applies HTTP and shape validation to every retry and only uses anonymous GET', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response({ error: 'Directorio caído' }, 503)).mockResolvedValueOnce(response({ error: 'Sin permiso' }, 403)).mockResolvedValueOnce(response({ profiles: [] })).mockImplementation(async () => response([profile]));
  render(<Login />); expect(await screen.findByRole('alert')).toHaveTextContent('Directorio caído');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar Conexión' })); expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar Conexión' })); expect(await screen.findByRole('alert')).toHaveTextContent('lista válida');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar Conexión' })); expect(await screen.findByRole('button', { name: /María/ })).toBeVisible();
  expect(mocks.login).not.toHaveBeenCalled();
  for (const [, options] of vi.mocked(fetch).mock.calls) { expect(options?.method).toBeUndefined(); expect(options?.headers).toBeUndefined(); }
});
it('locks the selected identity and PIN and ignores duplicate submits until the attempt finishes', async () => {
  let finish!: (value: { success: boolean; error: string }) => void; mocks.login.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<Login />); fireEvent.click(await screen.findByRole('button', { name: /María/ })); fireEvent.change(screen.getByLabelText('PIN de acceso'), { target: { value: '246810' } });
  const form = screen.getByRole('form', { name: 'Acceso con PIN' }); fireEvent.submit(form); fireEvent.submit(form);
  expect(screen.getByLabelText('PIN de acceso')).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cambiar usuario' })).toBeDisabled();
  expect(mocks.login).toHaveBeenCalledExactlyOnceWith(3, '246810');
  await act(async () => finish({ success: false, error: 'PIN incorrecto' }));
  expect(screen.getByRole('alert')).toHaveTextContent('PIN incorrecto'); expect(screen.getByLabelText('PIN de acceso')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Cambiar usuario' })).toBeEnabled(); expect(screen.getByText('María')).toBeVisible();
});
it('recovers from an unexpected login rejection and clears the secret', async () => {
  mocks.login.mockRejectedValue(new Error('transport')); render(<Login />); fireEvent.click(await screen.findByRole('button', { name: /María/ }));
  fireEvent.change(screen.getByLabelText('PIN de acceso'), { target: { value: '246810' } }); fireEvent.submit(screen.getByRole('form', { name: 'Acceso con PIN' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Comprueba la conexión'); expect(screen.getByLabelText('PIN de acceso')).toHaveValue('');
});
it('blocks a short PIN even if the native form validation is bypassed and clears it when changing identity', async () => {
  render(<Login />); fireEvent.click(await screen.findByRole('button', { name: /María/ })); fireEvent.change(screen.getByLabelText('PIN de acceso'), { target: { value: '123' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Acceso con PIN' })); expect(mocks.login).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar usuario' })); fireEvent.click(screen.getByRole('button', { name: /María/ })); expect(screen.getByLabelText('PIN de acceso')).toHaveValue('');
});
it('aborts the anonymous directory request when leaving the login screen', async () => {
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {})); const view = render(<Login />);
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce()); const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  view.unmount(); expect(signal?.aborted).toBe(true);
});
