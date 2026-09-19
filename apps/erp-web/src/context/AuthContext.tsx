import React, { createContext, useContext, useState, useRef } from 'react';
import { API_URL } from '../config';

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
  login: (userId: number, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const currentToken = useRef<string | null>(null);

  // Real login against the database
  const login = async (userId: number, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: userId, pin })
      });
      
      if (res.status === 401) {
        return { success: false, error: 'PIN incorrecto' };
      }
      if (res.status === 429) return { success: false, error: 'Demasiados intentos. Espera 15 minutos.' };
      
      if (!res.ok) {
        return { success: false, error: 'Servidor no disponible. Reintente.' };
      }
      
      const data = await res.json();
      if (data.success && data.user && data.token) {
        currentToken.current = data.token;
        setToken(data.token);
        setUser({
          id: String(data.user.id),
          name: data.user.nombre,
          role: data.user.rol as Role,
          location: data.user.local,
          mustChangePin: Boolean(data.user.must_change_pin)
        });
        return { success: true };
      }
      return { success: false, error: 'Respuesta inválida del servidor' };
    } catch {
      return { success: false, error: 'Error de red o conexión al servidor' };
    }
  };

  const logout = () => {
    if (token) void fetch(`${API_URL}/api/logout`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    }).catch(() => { /* Local session cleared even offline; server expiry remains. */ });
    currentToken.current = null;
    setToken(null);
    setUser(null);
  };

  // Wrapper para realizar llamadas HTTP autorizadas de forma transparente
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token || ''}`);
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 && currentToken.current === token) {
      currentToken.current = null; setToken(null); setUser(null);
    }
    return response;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, fetchWithAuth }}>
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
