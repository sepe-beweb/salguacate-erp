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
  login: (userId: number, pin: string) => Promise<boolean>;
  loginLegacy: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Real login against the database
  const login = async (userId: number, pin: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: userId, pin })
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success && data.user) {
        setUser({
          id: String(data.user.id),
          name: data.user.nombre,
          role: data.user.rol as Role,
          location: data.user.local
        });
        return true;
      }
      return false;
    } catch {
      return false;
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
    setUser(mockUser);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loginLegacy }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
