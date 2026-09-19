import type { User } from './context/AuthContext';

export function readAuthenticatedSession(value: unknown, expectedUserId: number): { token: string; user: User } {
  if (!value || typeof value !== 'object') throw new Error('Respuesta de acceso inválida.');
  const data = value as Record<string, unknown>;
  const user = data.user as Record<string, unknown> | null;
  if (data.success !== true || typeof data.token !== 'string' || data.token.length !== 64 || !/^[a-f0-9]{64}$/.test(data.token) || !user || typeof user !== 'object' ||
    !Number.isSafeInteger(user.id) || Number(user.id) < 1 || user.id !== expectedUserId || typeof user.nombre !== 'string' || !user.nombre.trim() ||
    typeof user.rol !== 'string' || !['owner', 'manager', 'employee'].includes(user.rol) || (user.local !== null && typeof user.local !== 'string') || typeof user.must_change_pin !== 'boolean') throw new Error('Respuesta de acceso inválida.');
  return { token: data.token, user: { id: String(user.id), name: user.nombre, role: user.rol as User['role'], location: user.local ?? undefined, mustChangePin: user.must_change_pin } };
}
