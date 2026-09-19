import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ChangePin from '../../apps/erp-web/src/pages/ChangePin';
import { isValidNewPin } from '../../apps/erp-web/src/pinValidation';
const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), logout: vi.fn() }));
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => mocks }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { mocks.fetchWithAuth.mockReset(); mocks.logout.mockReset(); });
function fill(current = '0000', next = '135790', confirmation = next) {
  fireEvent.change(screen.getByLabelText('PIN actual'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('PIN nuevo', { exact: true }), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Confirmar PIN nuevo'), { target: { value: confirmation } });
}
it.each(['1234', '111111', '123456789', 'abcdef', ''])('rejects a new PIN outside the API policy: %s', value => expect(isValidNewPin(value)).toBe(false));
it.each(['123456', '1234567', '12345678'])('accepts a new PIN within the API policy: %s', value => expect(isValidNewPin(value)).toBe(true));
it.each([['0000', '111111', '111111'], ['135790', '135790', '135790'], ['0000', '135790', '135791']])('does not send an invalid or mismatched renewal', (current, next, confirmation) => {
  render(<ChangePin />); fill(current, next, confirmation); fireEvent.submit(screen.getByLabelText('PIN actual').closest('form')!);
  expect(screen.getByRole('alert')).toBeVisible(); expect(mocks.fetchWithAuth).not.toHaveBeenCalled(); expect(mocks.logout).not.toHaveBeenCalled();
});
it('freezes all secrets and exit while pending; submits the exact two-field contract once', async () => {
  let finish!: (value: Response) => void; mocks.fetchWithAuth.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
  render(<ChangePin />); fill(); const form = screen.getByLabelText('PIN actual').closest('form')!; fireEvent.submit(form); fireEvent.submit(form);
  for (const label of ['PIN actual', 'PIN nuevo', 'Confirmar PIN nuevo']) expect(screen.getByLabelText(label, { exact: true })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar y salir' })); expect(mocks.logout).not.toHaveBeenCalled();
  expect(mocks.fetchWithAuth).toHaveBeenCalledOnce(); expect(JSON.parse(mocks.fetchWithAuth.mock.calls[0][1].body)).toEqual({ currentPin: '0000', newPin: '135790' });
  await act(async () => finish(response({ success: true })));
  expect(mocks.logout).toHaveBeenCalledOnce(); for (const label of ['PIN actual', 'PIN nuevo', 'Confirmar PIN nuevo']) expect(screen.getByLabelText(label, { exact: true })).toHaveValue('');
});
it.each([response({ error: 'Conflicto de actualización' }, 409), response({ success: false }), response(null), new Response('<html>fallo</html>', { status: 502 })])('does not claim success or logout after failed or malformed confirmation', async result => {
  mocks.fetchWithAuth.mockResolvedValue(result); render(<ChangePin />); fill(); fireEvent.submit(screen.getByLabelText('PIN actual').closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('comprueba el acceso'); expect(mocks.logout).not.toHaveBeenCalled();
  expect(screen.getByLabelText('PIN nuevo', { exact: true })).toHaveValue('135790'); expect(mocks.fetchWithAuth).toHaveBeenCalledOnce();
});
it('clears all entered secrets when cancelling without a pending request', () => {
  render(<ChangePin />); fill(); fireEvent.click(screen.getByRole('button', { name: 'Cancelar y salir' })); expect(mocks.logout).toHaveBeenCalledOnce();
  for (const label of ['PIN actual', 'PIN nuevo', 'Confirmar PIN nuevo']) { expect(screen.getByLabelText(label, { exact: true })).toHaveValue(''); expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('type', 'password'); }
});
