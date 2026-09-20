import { useState, type ReactNode } from 'react';
import { LOCATIONS } from '../locations';
import { LocalScopeContext } from '../hooks/useLocalScope';

// Session-only preference: never shared with a later login or persisted on a shared device.
export function LocalScopeProvider({ children, initialLocal = 'Todos' }: { children: ReactNode; initialLocal?: string }) {
  const state = useState(LOCATIONS.some(location => location.value === initialLocal) ? initialLocal : 'Todos');
  return <LocalScopeContext.Provider value={state}>{children}</LocalScopeContext.Provider>;
}
