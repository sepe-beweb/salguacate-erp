import { act, renderHook, render, fireEvent, screen } from '@testing-library/react';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useIdempotentCreate } from '../../apps/erp-web/src/hooks/useIdempotentCreate';
import Notes from '../../apps/erp-web/src/pages/Notes';
import Scanner from '../../apps/erp-web/src/pages/Scanner';
import { createPendingCreates } from '../../apps/erp-web/src/pendingCreates';
const mocks = vi.hoisted(() => ({ fetchWithAuth: vi.fn(), user: { id: '1', name: 'Jefe', role: 'owner' } }));
let pendingCreates: ReturnType<typeof createPendingCreates>;
vi.mock('../../apps/erp-web/src/context/AuthContext', () => ({ useAuth: () => ({ ...mocks, pendingCreates }) }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const body = { contenido: 'Mantener intento', color: 'blue' };
beforeEach(() => { mocks.fetchWithAuth.mockReset(); pendingCreates = createPendingCreates(); });
afterEach(() => { vi.restoreAllMocks(); });
const dialogMethods = Object.fromEntries(['showModal', 'close'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]));
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function () { this.setAttribute('open', ''); } },
    close: { configurable: true, value: function () { this.removeAttribute('open'); } }
  });
});
afterAll(() => {
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

describe('One immutable creation attempt', () => {
  it('recovers an unresolved note after full page unmount without sending on mount', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ error: 'Conexión interrumpida' }, 503) : response([]));
    const first = render(<Notes />);
    await screen.findByText('Sin notas');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    fireEvent.change(screen.getByLabelText('Contenido de la nota'), { target: { value: body.contenido } });
    fireEvent.click(screen.getByRole('button', { name: 'Color blue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Nota' }));
    await screen.findByRole('alert');
    const original = pendingCreates.get('/api/notas');
    first.unmount();
    render(<Notes />);
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar nota pendiente' }));
    expect(screen.getByLabelText('Contenido de la nota')).toHaveValue(body.contenido);
    expect(screen.getByLabelText('Contenido de la nota')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Color blue' })).toHaveAttribute('aria-pressed', 'true');
    expect(pendingCreates.get('/api/notas')).toBe(original);
    expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method)).toHaveLength(1);
  });

  it('shares the in-flight lock across unmount and delivers a late success to the new screen', async () => {
    let finish!: (r: Response) => void;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? new Promise<Response>(resolve => { finish = resolve; }) : response([]));
    const first = renderHook(() => useIdempotentCreate('/api/notas'));
    let sending!: Promise<{ id: number }>;
    act(() => { sending = first.result.current.submit(body); });
    first.unmount();
    render(<Notes />);
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar nota pendiente' }));
    expect(screen.getByLabelText('Contenido de la nota')).toBeDisabled();
    expect(screen.getByText(/Esperando la respuesta/)).toBeVisible();
    await act(async () => { finish(response({ id: 71 })); await sending; });
    expect(screen.getByText('Nota guardada correctamente (n.º 71).')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pendingCreates.get('/api/notas')).toBeNull();
    expect(mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method)).toHaveLength(1);
  });

  it('recovers the exact expense form without keeping the image or requesting AI consent again', async () => {
    const expense = { fecha: '2026-09-19', local: 'Segundo Local', proveedor_nombre: 'Proveedor', total: '12.50', concepto: 'Compra revisada' };
    mocks.fetchWithAuth.mockRejectedValueOnce(new Error('Respuesta perdida')).mockResolvedValueOnce(response({ id: 22 }));
    const first = renderHook(() => useIdempotentCreate('/api/gastos'));
    await act(async () => { await expect(first.result.current.submit(expense)).rejects.toThrow(); });
    first.unmount();
    render(<Scanner />);
    expect(screen.getByLabelText('Proveedor')).toHaveValue(expense.proveedor_nombre);
    expect(screen.getByLabelText('Fecha')).toHaveValue(expense.fecha);
    expect(screen.getByLabelText('Local')).toHaveValue(expense.local);
    expect(screen.getByLabelText('Concepto')).toHaveValue(expense.concepto);
    expect(screen.getByLabelText('Total Detectado (€)')).toHaveValue(12.5);
    expect(screen.getByLabelText('Proveedor')).toBeDisabled();
    expect(screen.queryByAltText('Vista previa')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(mocks.fetchWithAuth).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar guardado pendiente' }));
    await screen.findByText('Gasto registrado correctamente.');
    expect(mocks.fetchWithAuth.mock.calls[0]).toEqual(mocks.fetchWithAuth.mock.calls[1]);
    expect(screen.queryByLabelText('Proveedor')).not.toBeInTheDocument();
  });

  it('retains a success received while away until the screen consumes it without resending', async () => {
    mocks.fetchWithAuth.mockResolvedValue(response({ id: 25 }));
    await pendingCreates.submit('/api/gastos', { total: '7' }, mocks.fetchWithAuth);
    render(<Scanner />);
    expect(await screen.findByText('Gasto registrado correctamente.')).toBeVisible();
    expect(mocks.fetchWithAuth).toHaveBeenCalledOnce();
    expect(pendingCreates.get('/api/gastos')).toBeNull();
  });

  it('keeps a late failure after unmount and blocks a second mounted consumer until it settles', async () => {
    let fail!: (cause: Error) => void;
    mocks.fetchWithAuth.mockImplementationOnce(() => new Promise<Response>((_resolve, reject) => { fail = reject; }))
      .mockResolvedValueOnce(response({ id: 19 }));
    const first = renderHook(() => useIdempotentCreate('/api/notas'));
    let sending!: Promise<{ id: number }>;
    act(() => { sending = first.result.current.submit(body); });
    const failed = expect(sending).rejects.toThrow('Respuesta perdida');
    first.unmount();
    const second = renderHook(() => useIdempotentCreate('/api/notas'));
    expect(second.result.current.inFlight).toBe(true);
    await act(async () => { await expect(second.result.current.submit(body)).rejects.toThrow('en curso'); });
    await act(async () => { fail(new Error('Respuesta perdida')); await failed; });
    expect(second.result.current.inFlight).toBe(false);
    expect(second.result.current.locked).toBe(true);
    expect(second.result.current.recoveryError).toBe('Respuesta perdida');
    expect(second.result.current.payload).toEqual(body);
    expect(mocks.fetchWithAuth).toHaveBeenCalledOnce();
    await act(async () => { await second.result.current.submit(body); });
    expect(mocks.fetchWithAuth.mock.calls[0]).toEqual(mocks.fetchWithAuth.mock.calls[1]);
  });

  it('recovers a validation-rejected draft as editable after navigating', async () => {
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ error: 'Dato inválido' }, 400) : response([]));
    const first = renderHook(() => useIdempotentCreate('/api/notas'));
    await act(async () => { await expect(first.result.current.submit(body)).rejects.toThrow(); });
    first.unmount();
    render(<Notes />);
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar nota pendiente' }));
    expect(screen.getByLabelText('Contenido de la nota')).toHaveValue(body.contenido);
    expect(screen.getByLabelText('Contenido de la nota')).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Dato inválido');
  });

  it('keeps key and body after lost response and sends only on explicit confirmation', async () => {
    mocks.fetchWithAuth.mockRejectedValueOnce(new Error('Respuesta perdida')).mockResolvedValueOnce(response({ id: 3 }));
    const { result } = renderHook(() => useIdempotentCreate('/api/notas'));
    await act(async () => { await expect(result.current.submit(body)).rejects.toThrow('Respuesta perdida'); });
    expect(result.current.locked).toBe(true);
    expect(mocks.fetchWithAuth).toHaveBeenCalledOnce();
    await act(async () => { expect(await result.current.submit(body)).toEqual({ id: 3 }); });
    const options = mocks.fetchWithAuth.mock.calls.map(([, options]) => options);
    expect(options[0]).toEqual(options[1]);
    expect(options[0].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.current.locked).toBe(false);
  });

  it('refuses edits to an unresolved attempt without sending them under a fresh key', async () => {
    mocks.fetchWithAuth.mockRejectedValue(new Error('Sin conexión'));
    const { result } = renderHook(() => useIdempotentCreate('/api/notas'));
    await act(async () => { await expect(result.current.submit(body)).rejects.toThrow(); });
    await act(async () => { await expect(result.current.submit({ ...body, contenido: 'Cambiado' })).rejects.toThrow('originales'); });
    expect(mocks.fetchWithAuth).toHaveBeenCalledOnce();
    expect(result.current.locked).toBe(true);
  });

  it.each([response({}, 200), response({ id: '3' }), new Response('broken-json'), response({ error: 'Conflicto', code: 'IDEMPOTENCY_CONFLICT' }, 409)])('keeps uncertain or conflicting results locked', async failed => {
    mocks.fetchWithAuth.mockResolvedValue(failed);
    const { result } = renderHook(() => useIdempotentCreate('/api/gastos'));
    await act(async () => { await expect(result.current.submit({ total: '3' })).rejects.toThrow(); });
    expect(result.current.locked).toBe(true);
    expect(mocks.fetchWithAuth).toHaveBeenCalledOnce();
  });

  it('permits correcting a definitive validation rejection with a new attempt', async () => {
    mocks.fetchWithAuth.mockResolvedValueOnce(response({ error: 'Dato inválido' }, 400)).mockResolvedValueOnce(response({ id: 9 }));
    const { result } = renderHook(() => useIdempotentCreate('/api/gastos'));
    await act(async () => { await expect(result.current.submit({ total: '-1' })).rejects.toThrow('Dato inválido'); });
    expect(result.current.locked).toBe(false);
    await act(async () => { await result.current.submit({ total: '1' }); });
    expect(mocks.fetchWithAuth.mock.calls[0][1].headers['Idempotency-Key']).not.toBe(mocks.fetchWithAuth.mock.calls[1][1].headers['Idempotency-Key']);
  });

  it('blocks overlapping submits and does not discard an in-flight attempt', async () => {
    let finish!: (r: Response) => void;
    mocks.fetchWithAuth.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useIdempotentCreate('/api/notas'));
    let pending!: Promise<{ id: number }>;
    act(() => { pending = result.current.submit(body); result.current.discard(); });
    await act(async () => { await expect(result.current.submit(body)).rejects.toThrow('en curso'); });
    expect(mocks.fetchWithAuth).toHaveBeenCalledOnce();
    expect(result.current.locked).toBe(true);
    await act(async () => { finish(response({ id: 7 })); await pending; });
  });

  it('notes preserve the pending attempt across modal close and explicit confirmation', async () => {
    let postCount = 0;
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => {
      if (!options?.method) return response([]);
      if (++postCount === 1) throw new Error('Respuesta perdida');
      return response({ id: 7 });
    });
    render(<Notes />);
    await screen.findByText('Sin notas');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    fireEvent.change(screen.getByLabelText('Contenido de la nota'), { target: { value: body.contenido } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Nota' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Contenido de la nota')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar nota' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    expect(screen.getByLabelText('Contenido de la nota')).toHaveValue(body.contenido);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar guardado pendiente' }));
    await screen.findByText('Sin notas');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const writes = mocks.fetchWithAuth.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(writes).toHaveLength(2);
    expect(writes[0][1]).toEqual(writes[1][1]);
  });

  it('cancelling discard keeps the original protected note draft', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mocks.fetchWithAuth.mockImplementation(async (_url, options) => options?.method ? response({ error: 'Fallo' }, 500) : response([]));
    render(<Notes />);
    await screen.findByText('Sin notas');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    fireEvent.change(screen.getByLabelText('Contenido de la nota'), { target: { value: body.contenido } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Nota' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar intento pendiente' }));
    expect(screen.getByLabelText('Contenido de la nota')).toHaveValue(body.contenido);
    expect(screen.getByLabelText('Contenido de la nota')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirmar guardado pendiente' })).toBeEnabled();
  });
});
