import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

// One key and immutable payload per unresolved user attempt. No automatic sends
// and no token/draft persistence: leaving the page loses this recovery handle.
export function useIdempotentCreate(path: '/api/notas' | '/api/gastos') {
  const { fetchWithAuth } = useAuth();
  const attempt = useRef<{ key: string; body: string } | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const [locked, setLocked] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const discard = () => {
    if (busy.current) return;
    attempt.current = null;
    if (mounted.current) setLocked(false);
  };
  const submit = async (payload: unknown): Promise<{ id: number }> => {
    if (busy.current) throw new Error('El guardado sigue en curso.');
    const body = JSON.stringify(payload);
    if (attempt.current && attempt.current.body !== body) throw new Error('Confirma primero el intento pendiente con sus datos originales.');
    if (!attempt.current) attempt.current = { key: crypto.randomUUID(), body };
    busy.current = true;
    if (mounted.current) setLocked(true);
    try {
      const response = await fetchWithAuth(API_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key },
        body: attempt.current.body
      });
      let result: unknown;
      try { result = await response.json(); }
      catch { throw new Error('No se recibió una confirmación válida. Conservamos el intento para que puedas confirmarlo.'); }
      if (!response.ok) {
        // Only a well-formed validation rejection is known not to have written.
        if (response.status === 400 && result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
          attempt.current = null;
          if (mounted.current) setLocked(false);
        }
        throw new Error(result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : 'No se pudo confirmar el guardado.');
      }
      if (!result || typeof result !== 'object' || !('id' in result) || !Number.isSafeInteger(result.id) || Number(result.id) < 1) {
        throw new Error('No se recibió el identificador guardado. Conservamos el intento para que puedas confirmarlo.');
      }
      attempt.current = null;
      if (mounted.current) setLocked(false);
      return { id: Number(result.id) };
    } finally { busy.current = false; }
  };
  return { submit, locked, discard };
}
