import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { API_URL } from '../config';
import { createPendingCreates } from '../pendingCreates';
import { readAuthenticatedSession } from '../authenticatedSession';

export type Role = 'owner' | 'manager' | 'employee';

export interface User {
  id: string;
  name: string;
  role: Role;
  location?: string;
  mustChangePin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  pendingCreates: ReturnType<typeof createPendingCreates>;
  login: (userId: number, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const currentToken = useRef<string | null>(null);
  const [pendingCreates, setPendingCreates] = useState(createPendingCreates);
  const currentCreates = useRef(pendingCreates);
  const mounted = useRef(false);
  const loginGeneration = useRef(0);
  const loginController = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    const warn = (event: BeforeUnloadEvent) => {
      if (currentCreates.current.hasPending()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => { mounted.current = false; loginGeneration.current++; loginController.current?.abort(); window.removeEventListener('beforeunload', warn); currentCreates.current.close(); };
  }, []);

  // Real login against the database
  const login = async (userId: number, pin: string): Promise<{ success: boolean; error?: string }> => {
    const generation = ++loginGeneration.current;
    loginController.current?.abort(); loginController.current = null;
    const cancelled = () => !mounted.current || generation !== loginGeneration.current;
    const cancelledResult = { success: false, error: 'Intento de acceso cancelado.' };
    if (cancelled()) return cancelledResult;
    if (!Number.isSafeInteger(userId) || userId < 1 || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return { success: false, error: 'Usuario o PIN inválido.' };
    const controller = new AbortController(); loginController.current = controller;
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: userId, pin })
      });
      if (cancelled()) return cancelledResult;
      
      if (res.status === 401) {
        return { success: false, error: 'PIN incorrecto' };
      }
      if (res.status === 429) return { success: false, error: 'Demasiados intentos. Espera 15 minutos.' };
      
      if (!res.ok) {
        return { success: false, error: 'Servidor no disponible. Reintente.' };
      }
      
      let session;
      try { session = readAuthenticatedSession(await res.json(), userId); }
      catch { return cancelled() ? cancelledResult : { success: false, error: 'Respuesta inválida del servidor' }; }
      if (cancelled()) return cancelledResult;
      currentCreates.current.close();
      const creates = createPendingCreates();
      currentCreates.current = creates; setPendingCreates(creates);
      currentToken.current = session.token;
      setToken(session.token);
      setUser(session.user);
      return { success: true };
    } catch {
      return cancelled() ? cancelledResult : { success: false, error: 'Error de red o conexión al servidor' };
    } finally {
      if (loginController.current === controller) loginController.current = null;
    }
  };

  const logout = () => {
    if (currentCreates.current.hasPending() && !window.confirm('Hay guardados sin confirmar. Cerrar sesión perderá sus borradores y claves en este dispositivo. El servidor puede haberlos guardado: comprueba las listas antes de repetirlos. ¿Cerrar sesión?')) return;
    loginGeneration.current++; loginController.current?.abort(); loginController.current = null;
    const activeToken = currentToken.current;
    if (activeToken) void fetch(`${API_URL}/api/logout`, {
      method: 'POST', headers: { Authorization: `Bearer ${activeToken}` }
    }).catch(() => { /* Local session cleared even offline; server expiry remains. */ });
    currentToken.current = null;
    currentCreates.current.close();
    setToken(null);
    setUser(null);
  };

  // Wrapper para realizar llamadas HTTP autorizadas de forma transparente
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token || ''}`);
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 && currentToken.current === token) {
      loginGeneration.current++; loginController.current?.abort(); loginController.current = null;
      currentCreates.current.close();
      currentToken.current = null; setToken(null); setUser(null);
    }
    return response;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, fetchWithAuth, pendingCreates }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
