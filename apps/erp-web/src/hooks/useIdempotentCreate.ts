import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import type { CreatePath } from '../pendingCreates';

export function useIdempotentCreate<T = unknown>(path: CreatePath) {
  const { fetchWithAuth, pendingCreates } = useAuth();
  const attempt = useSyncExternalStore(pendingCreates.subscribe, () => pendingCreates.get(path));
  const payload = useMemo(() => attempt ? JSON.parse(attempt.body) as T : null, [attempt?.body]);
  const discard = useCallback(() => pendingCreates.discard(path), [pendingCreates, path]);
  const submit = (data: T) => pendingCreates.submit(path, data, options => fetchWithAuth(API_URL + path, options));
  return {
    submit, discard, payload,
    locked: attempt?.status === 'pending',
    inFlight: attempt?.busy ?? false,
    confirmedId: attempt?.status === 'confirmed' && !attempt.busy ? attempt.id : undefined,
    recoveryError: attempt?.error ?? '',
  };
}
