import { createContext, useContext, useState } from 'react';

export const LocalScopeContext = createContext<[string, (value: string) => void] | null>(null);

export function useLocalScope(fallback = 'Todos'): [string, (value: string) => void] {
  const context = useContext(LocalScopeContext);
  const state = useState(fallback);
  return context ?? state;
}
