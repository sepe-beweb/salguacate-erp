import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { errorMessage, readList } from '../apiResponse';

// GET-only loader: all required lists succeed together; older loads cannot replace newer filters.
export function useApiLists<T extends unknown[]>(paths: { [K in keyof T]: string }) {
  type Lists = { [K in keyof T]: T[K][] };
  const { fetchWithAuth } = useAuth();
  const fetchRef = useRef(fetchWithAuth);
  useEffect(() => { fetchRef.current = fetchWithAuth; }, [fetchWithAuth]);
  const key = JSON.stringify(paths);
  const activeKey = useRef(key);
  const mounted = useRef(false);
  useEffect(() => { activeKey.current = key; }, [key]);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ key: string; data: Lists | null; loading: boolean; error: string }>({ key, data: null, loading: true, error: '' });
  const reload = useCallback(async () => {
    if (!mounted.current || activeKey.current !== key) return;
    const request = ++sequence.current;
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setState({ key, data: null, loading: true, error: '' });
    try {
      const data = await Promise.all((JSON.parse(key) as string[]).map(path =>
        fetchRef.current(`${API_URL}${path}`, { signal: pending.signal }).then(readList)
      )) as Lists;
      if (sequence.current === request) setState({ key, data, loading: false, error: '' });
    } catch (cause) {
      if (sequence.current === request) setState({ key, data: null, loading: false, error: errorMessage(cause) });
    }
  }, [key]);
  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { mounted.current = false; sequence.current++; controller.current?.abort(); };
  }, [reload]);
  return { data: state.key === key ? state.data : null, loading: state.key !== key || state.loading, error: state.key === key ? state.error : '', reload };
}
