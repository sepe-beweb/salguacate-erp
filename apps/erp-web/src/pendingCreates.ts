export type CreatePath = '/api/notas' | '/api/gastos';
export interface CreateAttempt {
  readonly key: string;
  readonly body: string;
  readonly busy: boolean;
  readonly status: 'pending' | 'rejected' | 'confirmed';
  readonly error: string;
  readonly id?: number;
}

// Owned by one authenticated session, never by a module singleton or storage.
export function createPendingCreates() {
  const attempts = new Map<CreatePath, CreateAttempt>();
  const listeners = new Set<() => void>();
  let active = true;
  const notify = () => listeners.forEach(listener => listener());
  const get = (path: CreatePath) => attempts.get(path) ?? null;
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  const discard = (path: CreatePath) => {
    if (get(path)?.busy) return;
    attempts.delete(path); notify();
  };
  const close = () => { active = false; attempts.clear(); notify(); };
  const hasPending = () => [...attempts.values()].some(attempt => attempt.status === 'pending');

  const submit = async (path: CreatePath, payload: unknown, send: (options: RequestInit) => Promise<Response>): Promise<{ id: number }> => {
    if (!active) throw new Error('La sesión de este intento ha terminado.');
    const previous = get(path);
    if (previous?.busy) throw new Error('El guardado sigue en curso.');
    if (previous?.status === 'confirmed') throw new Error('El guardado ya está confirmado.');
    const body = JSON.stringify(payload);
    if (previous?.status === 'pending' && previous.body !== body) throw new Error('Confirma primero el intento pendiente con sus datos originales.');
    const key = previous?.status === 'pending' ? previous.key : crypto.randomUUID();
    const update = (changes: Partial<CreateAttempt>) => {
      if (active && get(path)?.key === key) {
        attempts.set(path, { ...get(path)!, ...changes }); notify();
      }
    };
    attempts.set(path, { key, body, busy: true, status: 'pending', error: '' }); notify();
    try {
      const response = await send({ method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body });
      let result: unknown;
      try { result = await response.json(); }
      catch { throw new Error('No se recibió una confirmación válida. Conservamos el intento para que puedas confirmarlo.'); }
      if (!active) throw new Error('La sesión de este intento ha terminado.');
      if (!response.ok) {
        const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : '';
        if (response.status === 400 && message) update({ status: 'rejected' });
        throw new Error(message || 'No se pudo confirmar el guardado.');
      }
      if (!result || typeof result !== 'object' || !('id' in result) || !Number.isSafeInteger(result.id) || Number(result.id) < 1) {
        throw new Error('No se recibió el identificador guardado. Conservamos el intento para que puedas confirmarlo.');
      }
      const id = Number(result.id);
      update({ status: 'confirmed', id });
      return { id };
    } catch (cause) {
      update({ error: cause instanceof Error ? cause.message : 'No se pudo confirmar el guardado.' });
      throw cause;
    } finally { update({ busy: false }); }
  };
  return { get, subscribe, submit, discard, close, hasPending };
}
