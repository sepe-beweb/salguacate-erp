import React, { createContext, useContext, useState } from 'react';
import { API_URL } from '../config';

export type Role = 'owner' | 'manager' | 'employee';

export interface User {
  id: string;
  name: string;
  role: Role;
  location?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userId: number, pin: string) => Promise<{ success: boolean; error?: string }>;
  loginLegacy: (role: Role) => void;
  logout: () => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

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
      
      if (!res.ok) {
        return { success: false, error: 'Servidor no disponible. Reintente.' };
      }
      
      const data = await res.json();
      if (data.success && data.user && data.token) {
        setToken(data.token);
        setUser({
          id: String(data.user.id),
          name: data.user.nombre,
          role: data.user.rol as Role,
          location: data.user.local
        });
        return { success: true };
      }
      return { success: false, error: 'Respuesta inválida del servidor' };
    } catch {
      return { success: false, error: 'Error de red o conexión al servidor' };
    }
  };

  // Legacy fallback (for development only)
  const loginLegacy = (role: Role) => {
    let mockUser: User;
    if (role === 'owner') {
      mockUser = { id: '1', name: 'Jefe (Admin)', role: 'owner' };
    } else if (role === 'manager') {
      mockUser = { id: '2', name: 'Encargado Principal', role: 'manager', location: 'Principal' };
    } else {
      mockUser = { id: '3', name: 'Camarero / Cocinero', role: 'employee', location: 'Principal' };
    }
    setToken('legacy-token-12345');
    setUser(mockUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  // Wrapper para realizar llamadas HTTP autorizadas de forma transparente
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token || ''}`,
    } as Record<string, string>;
    
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loginLegacy, fetchWithAuth }}>
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
