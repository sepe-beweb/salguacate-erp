import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../apps/erp-web/src/context/AuthContext';
import { createPendingCreates } from '../../apps/erp-web/src/pendingCreates';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const payload = { contenido: 'Solo en esta sesión', color: 'yellow' };
const loginResponse = (id: number) => response({ success: true, token: `session-${id}`, user: { id, nombre: `User ${id}`, rol: 'owner', local: 'Principal' } });
const wrapper = ({ children }: { children: React.ReactNode }) => <StrictMode><AuthProvider>{children}</AuthProvider></StrictMode>;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Pending create session boundary', () => {
  it('isolates operations and closes old stores without permitting reuse or late repopulation', async () => {
    const old = createPendingCreates();
    let finish!: (r: Response) => void;
    const send = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    const task = old.submit('/api/notas', payload, send);
    const rejected = expect(task).rejects.toThrow('sesión');
    await old.submit('/api/gastos', { total: 3 }, async () => response({ id: 4 }));
    expect(old.get('/api/gastos')?.status).toBe('confirmed');
    expect(old.get('/api/notas')?.busy).toBe(true);
    old.close();
    const fresh = createPendingCreates();
    finish(response({ id: 9 })); await rejected;
    expect(old.get('/api/notas')).toBeNull();
    expect(old.get('/api/gastos')).toBeNull();
    expect(fresh.get('/api/notas')).toBeNull();
    await expect(old.submit('/api/notas', payload, send)).rejects.toThrow('sesión');
    expect(send).toHaveBeenCalledOnce();
  });

  it('warns on reload and logout, preserves on cancellation, clears on logout and next login', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(loginResponse(1)).mockResolvedValueOnce(response({ success: true })).mockResolvedValueOnce(loginResponse(2));
    vi.stubGlobal('fetch', fetch);
    const setStorage = vi.spyOn(Storage.prototype, 'setItem');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = renderHook(useAuth, { wrapper });
    await act(async () => { expect((await result.current.login(1, '123456')).success).toBe(true); });
    const first = result.current.pendingCreates;
    await expect(first.submit('/api/notas', payload, async () => { throw new Error('Sin respuesta'); })).rejects.toThrow();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    act(() => result.current.logout());
    expect(result.current.user?.id).toBe('1');
    expect(first.hasPending()).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    confirm.mockReturnValue(true);
    act(() => result.current.logout());
    expect(result.current.user).toBeNull();
    expect(first.get('/api/notas')).toBeNull();
    await act(async () => { await result.current.login(2, '123456'); });
    expect(result.current.user?.id).toBe('2');
    expect(result.current.pendingCreates).not.toBe(first);
    expect(result.current.pendingCreates.get('/api/notas')).toBeNull();
    const noPending = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(noPending); expect(noPending.defaultPrevented).toBe(false);
    expect(setStorage).not.toHaveBeenCalled();
  });

  it('clears all drafts on current-session 401 without asking to retain them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(loginResponse(1)).mockResolvedValueOnce(response({ error: 'Caducada' }, 401)));
    const confirm = vi.spyOn(window, 'confirm');
    const { result } = renderHook(useAuth, { wrapper });
    await act(async () => { await result.current.login(1, '123456'); });
    const store = result.current.pendingCreates;
    await expect(store.submit('/api/notas', payload, async () => { throw new Error('Sin respuesta'); })).rejects.toThrow();
    await act(async () => { await result.current.fetchWithAuth('/api/notas'); });
    expect(result.current.user).toBeNull();
    expect(store.get('/api/notas')).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('ignores old-session 401 after a new login without clearing the new pending attempt', async () => {
    let finish!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(loginResponse(1))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(loginResponse(2)));
    const { result } = renderHook(useAuth, { wrapper });
    await act(async () => { await result.current.login(1, '123456'); });
    const stale = result.current.fetchWithAuth('/api/notas');
    await act(async () => { await result.current.login(2, '123456'); });
    const fresh = result.current.pendingCreates;
    await expect(fresh.submit('/api/notas', payload, async () => { throw new Error('Sin respuesta'); })).rejects.toThrow();
    await act(async () => { finish(response({ error: 'Caducada' }, 401)); await stale; });
    expect(result.current.user?.id).toBe('2');
    expect(fresh.hasPending()).toBe(true);
  });

  it('drops all handles when the auth provider unmounts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(loginResponse(1)));
    const view = renderHook(useAuth, { wrapper });
    await act(async () => { await view.result.current.login(1, '123456'); });
    const store = view.result.current.pendingCreates;
    await expect(store.submit('/api/notas', payload, async () => { throw new Error('Sin respuesta'); })).rejects.toThrow();
    view.unmount();
    expect(store.get('/api/notas')).toBeNull();
    expect(store.hasPending()).toBe(false);
  });
});
