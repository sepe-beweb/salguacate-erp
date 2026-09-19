import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../apps/erp-web/src/context/AuthContext';
import { readAuthenticatedSession } from '../../apps/erp-web/src/authenticatedSession';
const body = (id = 3) => ({ success: true, token: String(id).padStart(64, 'a'), user: { id, nombre: 'María', rol: 'employee', local: 'Principal', must_change_pin: false } });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const wrapper = ({ children }: { children: React.ReactNode }) => <StrictMode><AuthProvider>{children}</AuthProvider></StrictMode>;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it.each([
  null, { ...body(), success: 1 }, { ...body(), token: 'short' }, { ...body(), token: `${'a'.repeat(64)}\n` },
  ...[{ id: '3' }, { id: 4 }, { nombre: '' }, { rol: 'unknown' }, { rol: ['owner'] }, { local: {} }, { must_change_pin: 'false' }, { must_change_pin: undefined }].map(fields => ({ ...body(), user: { ...body().user, ...fields } }))
])('rejects incomplete or mismatched authenticated identity: %j', value => expect(() => readAuthenticatedSession(value, 3)).toThrow('inválida'));
it('preserves nullable location and requires explicit renewal state', () => {
  expect(readAuthenticatedSession({ ...body(), user: { ...body().user, local: null, must_change_pin: true } }, 3).user).toEqual({ id: '3', name: 'María', role: 'employee', location: undefined, mustChangePin: true });
});
it('does not replace a valid session or pending drafts with a malformed login reply', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(body())).mockResolvedValueOnce(response({ ...body(), token: 'invalid' })));
  const { result } = renderHook(useAuth, { wrapper }); await act(async () => { await result.current.login(3, '246810'); });
  const store = result.current.pendingCreates; await expect(store.submit('/api/notas', { contenido: 'Pendiente', color: 'yellow' }, async () => { throw new Error('Sin respuesta'); })).rejects.toThrow();
  await act(async () => { expect((await result.current.login(3, '246810')).success).toBe(false); });
  expect(result.current.user?.id).toBe('3'); expect(result.current.token).toBe(body().token); expect(result.current.pendingCreates).toBe(store); expect(store.hasPending()).toBe(true);
});
it('a late earlier login cannot overwrite a newer successful identity even if transport ignores abort', async () => {
  let finish!: (value: Response) => void;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })).mockResolvedValueOnce(response(body(2))); vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(useAuth, { wrapper }); const older = result.current.login(3, '246810');
  await act(async () => { expect((await result.current.login(2, '246810')).success).toBe(true); });
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true); const store = result.current.pendingCreates;
  await act(async () => { finish(response(body(3))); expect((await older).success).toBe(false); });
  expect(result.current.user?.id).toBe('2'); expect(result.current.token).toBe(body(2).token); expect(result.current.pendingCreates).toBe(store);
});
it('logout invalidates a login whose JSON body arrives late', async () => {
  let finish!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => new Promise(resolve => { finish = resolve; }) }));
  const { result } = renderHook(useAuth, { wrapper }); let pending!: ReturnType<typeof result.current.login>;
  await act(async () => { pending = result.current.login(3, '246810'); });
  act(() => result.current.logout()); await act(async () => { finish(body()); expect((await pending).success).toBe(false); });
  expect(result.current.user).toBeNull(); expect(result.current.token).toBeNull(); expect(result.current.pendingCreates.hasPending()).toBe(false);
});
it('unmount aborts an in-flight login and refuses a later result', async () => {
  let finish!: (value: Response) => void; const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal('fetch', fetch);
  const view = renderHook(useAuth, { wrapper }); const pending = view.result.current.login(3, '246810'); view.unmount();
  expect(vi.mocked(globalThis.fetch).mock.calls[0][1]?.signal?.aborted).toBe(true); finish(response(body())); expect((await pending).success).toBe(false);
});
it('uses the accepted token for immediate logout before the next React render', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(body())).mockResolvedValueOnce(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(useAuth, { wrapper }); const initial = result.current;
  await act(async () => { await initial.login(3, '246810'); initial.logout(); });
  expect(fetch.mock.calls[1][0]).toMatch(/\/api\/logout$/); expect(fetch.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${body().token}`); expect(result.current.user).toBeNull();
});
